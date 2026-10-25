import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../scripts/memory-store.mjs";
import { createRepository } from "../netlify/lib/shop-store.mjs";
import {
  initialState,
  applyAction,
  publicState,
  ShopError,
} from "../netlify/lib/commerce.mjs";
import { createHandler as shopHandler } from "../netlify/functions/shop.mjs";
import { createHandler as orderHandler } from "../netlify/functions/orders.mjs";
import { issueSession, settings, COOKIE } from "../netlify/lib/admin-auth.mjs";
import { dashboardMetrics, customersFrom, csv } from "../src/admin-model.js";
import { imageType } from "../netlify/functions/media.mjs";
const body = () => ({
  name: "Customer Test",
  phone: "0663266817",
  city: "Rabat",
  address: "Rue test 123",
  items: [{ id: "lavande", size: "M", qty: 1, price: 1 }],
});
const create = (repo) =>
  repo.transact((s) =>
    applyAction(s, {
      action: "order.create",
      source: "WhatsApp",
      order: body(),
    }),
  );
const modify = (repo, id, fields) =>
  repo.transact((s) => {
    const order = s.orders.find((o) => o.id === id);
    return applyAction(s, {
      action: "order.update",
      order: { id, revision: order.revision, ...fields },
    });
  });
test("legacy orders migrate without exposing contacts through the public catalogue", async () => {
  const legacy = new MemoryStore();
  await legacy.setJSON("TZ-legacy", {
    ...body(),
    id: "TZ-legacy",
    total: 290,
    status: "Livrée",
    createdAt: "2026-10-25T10:00:00Z",
  });
  const store = new MemoryStore();
  const repo = createRepository(store, legacy);
  let { state } = await repo.read();
  assert.equal(state.orders.length, 1);
  const publicData = publicState(state);
  assert.ok(!JSON.stringify(publicData).includes("Customer Test"));
  assert.ok(!("stock" in publicData.products[0]));
  await repo.transact((s) =>
    applyAction(s, {
      action: "settings.save",
      revision: s.settingsRevision,
      settings: { ...s.settings, deliveryFee: 25 },
    }),
  );
  state = (await createRepository(store, legacy).read()).state;
  assert.equal(state.orders.length, 1);
  assert.equal(state.settings.deliveryFee, 25);
  assert.equal(state.orders[0].payment, "En attente");
});
test("concurrent confirmations cannot reserve the final unit twice; cancellation restores it once", async () => {
  const repo = createRepository(new MemoryStore());
  await repo.transact((s) => {
    s.products.find((p) => p.id === "lavande").stock.M = 1;
  });
  const a = (await create(repo)).value,
    b = (await create(repo)).value;
  const results = await Promise.allSettled([
    modify(repo, a.id, { status: "Confirmée" }),
    modify(repo, b.id, { status: "Confirmée" }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    results.find((r) => r.status === "rejected").reason instanceof ShopError,
  );
  let state = (await repo.read()).state;
  assert.equal(state.products[0].stock.M, 0);
  const confirmed = state.orders.find((o) => o.status === "Confirmée");
  await modify(repo, confirmed.id, { status: "Annulée" });
  await modify(repo, confirmed.id, { status: "Annulée", notes: "saved again" });
  state = (await repo.read()).state;
  assert.equal(state.products[0].stock.M, 1);
});
test("delivery workflow, payment, returns, frozen prices and stale edits remain consistent", async () => {
  const repo = createRepository(new MemoryStore());
  await repo.transact((s) => {
    s.products[0].stock.M = 3;
    s.settings.deliveryCities = [{ city: "Rabat", fee: 30 }];
  });
  const order = (await create(repo)).value;
  assert.equal(order.total, 320);
  assert.equal(order.items[0].price, 290);
  await assert.rejects(
    () => modify(repo, order.id, { status: "Livrée" }),
    /Transition/,
  );
  await modify(repo, order.id, { status: "Confirmée" });
  await modify(repo, order.id, {
    status: "Expédiée",
    carrier: "Carrier",
    tracking: "TRACK-1",
  });
  await modify(repo, order.id, { status: "Livrée", payment: "Payé" });
  let state = (await repo.read()).state;
  assert.equal(dashboardMetrics(state, "all").received, 320);
  assert.equal(dashboardMetrics(state, "all").revenue, 290);
  const old = structuredClone(state.products[0]);
  await repo.transact((s) =>
    applyAction(s, {
      action: "product.save",
      product: { ...s.products[0], price: 310 },
    }),
  );
  await assert.rejects(
    () =>
      repo.transact((s) =>
        applyAction(s, { action: "product.save", product: old }),
      ),
    /données ont changé/,
  );
  await modify(repo, order.id, { status: "Retournée", payment: "Remboursé" });
  state = (await repo.read()).state;
  assert.equal(state.products[0].stock.M, 3);
  assert.equal(state.orders[0].items[0].price, 290);
  assert.equal(dashboardMetrics(state, "all").received, 0);
  assert.equal(dashboardMetrics(state, "all").revenue, 0);
});
test("product/settings validators reject unsafe images, bad prices, stock and absent Arabic fields", async () => {
  const repo = createRepository(new MemoryStore());
  for (const patch of [
    { price: 150 },
    { images: ["javascript:alert(1)"] },
    { stock: { S: -1, M: 0, L: 0, XL: 0 } },
    { nameAr: "" },
  ])
    await assert.rejects(() =>
      repo.transact((s) =>
        applyAction(s, {
          action: "product.save",
          product: { ...s.products[0], ...patch },
        }),
      ),
    );
  const product = (await repo.read()).state.products[0];
  assert.equal(product.price, 290);
  assert.equal(product.stock.S, null);
  await repo.transact((s) =>
    applyAction(s, {
      action: "product.archive",
      id: product.id,
      revision: product.revision,
    }),
  );
  assert.ok(
    !publicState((await repo.read()).state).products.some(
      (p) => p.id === product.id,
    ),
  );
  await assert.rejects(() => create(repo), /indisponible/);
});
test("secured handlers reject visitors/cross-site writes, preserve idempotency and use server prices", async () => {
  const previous = Object.fromEntries(
    [
      "ADMIN_EMAIL",
      "ADMIN_PASSWORD",
      "ADMIN_SESSION_SECRET",
      "ORDERS_ENABLED",
    ].map((k) => [k, process.env[k]]),
  );
  try {
    process.env.ADMIN_EMAIL = "test@example.test";
    process.env.ADMIN_PASSWORD = "test-only-password-not-for-production";
    process.env.ADMIN_SESSION_SECRET = "test-only-secret-not-for-production";
    process.env.ORDERS_ENABLED = "true";
    const repo = createRepository(new MemoryStore());
    const shop = shopHandler(() => repo),
      orders = orderHandler(() => repo);
    const origin = "https://shop.example";
    const cookie = COOKIE + "=" + issueSession(settings());
    const req = (url, method = "GET", body, admin = false, from = origin) =>
      new Request(origin + "/.netlify/functions/" + url, {
        method,
        headers: { Origin: from, ...(admin ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal((await shop(req("shop?admin=1"))).status, 401);
    assert.equal(
      (
        await shop(
          req(
            "shop",
            "POST",
            { action: "settings.save" },
            true,
            "https://other.example",
          ),
        )
      ).status,
      403,
    );
    const input = {
      ...body(),
      requestId: "12345678-1234-4234-8234-123456789abc",
      expectedSubtotal: 290,
    };
    assert.equal((await orders(req("orders", "POST", input))).status, 201);
    assert.equal((await orders(req("orders", "POST", input))).status, 201);
    assert.equal((await repo.read()).state.orders.length, 1);
    assert.equal(
      (await orders(req("orders", "POST", { ...input, phone: "0600112233" })))
        .status,
      409,
    );
    assert.equal(
      (await orders(req("orders", "POST", { ...body(), expectedSubtotal: 1 })))
        .status,
      409,
    );
    const publicData = await (await shop(req("shop"))).json();
    assert.ok(!JSON.stringify(publicData).includes(input.phone));
    assert.ok(!JSON.stringify(publicData).includes("notes"));
    await repo.transact((s) =>
      applyAction(s, {
        action: "settings.save",
        revision: s.settingsRevision,
        settings: { ...s.settings, ordersOpen: false },
      }),
    );
    assert.equal((await orders(req("orders", "POST", body()))).status, 503);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("customer grouping and CSV exports preserve Arabic and neutralize spreadsheet formulas", () => {
  const state = initialState();
  state.orders = [
    {
      ...body(),
      name: '=HYPERLINK("https://bad")',
      id: "a",
      total: 290,
      status: "Livrée",
      payment: "Payé",
      createdAt: "2026-10-25T00:00:00Z",
    },
    {
      ...body(),
      name: "فاطمة",
      phone: "+212663266817",
      id: "b",
      total: 300,
      status: "Annulée",
      payment: "En attente",
      createdAt: "2026-10-25T01:00:00Z",
    },
  ];
  const customers = customersFrom(state.orders);
  assert.equal(customers.length, 1);
  assert.equal(customers[0].paid, 290);
  assert.equal(customers[0].name, "فاطمة");
  const file = csv(
    ["Client"],
    [["=1+1"], ["  +SUM(A1)"], ["فاطمة"], ['a"b'], ["0600112233"]],
  );
  assert.ok(file.startsWith("\ufeff"));
  assert.ok(file.includes("'=1+1"));
  assert.ok(file.includes("'  +SUM"));
  assert.ok(file.includes("فاطمة"));
  assert.ok(file.includes('a""b'));
  assert.ok(file.includes("'0600112233"));
});
test("media signatures permit product photos and reject script formats", () => {
  assert.equal(
    imageType(new TextEncoder().encode('<svg onload="alert(1)">')),
    null,
  );
  assert.equal(imageType(new Uint8Array([255, 216, 255, 0])), "image/jpeg");
  assert.equal(
    imageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
});

test("order date filters follow the Casablanca calendar at the UTC day boundary", async () => {
  const { filterOrders } = await import("../src/admin-model.js");
  const rows = [
    {
      id: "a",
      name: "Test",
      phone: "0600000000",
      city: "Rabat",
      createdAt: "2026-10-24T23:30:00Z",
      status: "Nouvelle",
      payment: "En attente",
    },
  ];
  assert.equal(
    filterOrders(rows, { from: "2026-10-25", to: "2026-10-25" }).length,
    1,
  );
  assert.equal(
    filterOrders(rows, { from: "2026-10-24", to: "2026-10-24" }).length,
    0,
  );
});

test("orders written by the previous deploy during migration remain visible and durable", async () => {
  const legacy = new MemoryStore(),
    store = new MemoryStore();
  const repo = createRepository(store, legacy);
  await repo.transact((s) =>
    applyAction(s, {
      action: "settings.save",
      revision: s.settingsRevision,
      settings: { ...s.settings, deliveryFee: 20 },
    }),
  );
  await legacy.setJSON("late", {
    id: "TZ-late",
    ...body(),
    total: 290,
    status: "Nouvelle",
    createdAt: "2026-10-25T11:00:00Z",
  });
  assert.equal((await repo.read()).state.orders.length, 1);
  await legacy.setJSON("late", {
    id: "TZ-late",
    ...body(),
    total: 290,
    status: "Confirmée",
    createdAt: "2026-10-25T11:00:00Z",
  });
  await repo.transact((s) =>
    applyAction(s, {
      action: "settings.save",
      revision: s.settingsRevision,
      settings: { ...s.settings, deliveryFee: 25 },
    }),
  );
  const saved = (await store.getWithMetadata("state")).data;
  assert.equal(saved.orders.length, 1);
  assert.equal(saved.orders[0].status, "Confirmée");
  assert.equal(saved.settings.deliveryFee, 25);
});

test("delivery quotations agree across storefront, manual forms and server, including city accents", async () => {
  const { shopDelivery } = await import("../src/admin-model.js");
  const { deliveryFee, validateSettings } = await import(
    "../netlify/lib/commerce.mjs"
  );
  const state = initialState();
  state.settings.deliveryFee = 20;
  state.settings.deliveryCities = [{ city: "Fès", fee: 35 }];
  for (const city of ["Fès", " FES ", "fes"]) {
    assert.equal(shopDelivery(state.settings, city), 35);
    assert.equal(deliveryFee(state.settings, city), 35);
  }
  assert.throws(
    () =>
      validateSettings({
        ...state.settings,
        deliveryCities: [
          { city: "Fès", fee: 35 },
          { city: "Fes", fee: 25 },
        ],
      }),
    /dupliquée/,
  );
});
