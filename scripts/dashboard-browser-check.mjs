import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { startLocalShop } from "./local-shop-server.mjs";
const server = await startLocalShop();
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.url + "/admin");
  await page.locator("#login").waitFor();
  await page.locator("[name=email]").fill("owner@example.test");
  await page.locator("[name=password]").fill(process.env.ADMIN_PASSWORD);
  await page.locator("#login button").click();
  await page.locator(".dashboard-stats").waitFor();
  assert.equal((await server.repo.read()).state.orders.length, 0);
  await page.locator("[data-view=products]").click();
  await page.locator("[name=query]").fill("Lavande");
  await page.locator("#product-filters button").click();
  await page.locator("[data-edit-product=lavande]").click();
  await page.locator("[name=price]").fill("310");
  await page.locator("[name=stock-M]").fill("2");
  await page.locator("[name=stock-L]").fill("0");
  await page.locator("#product-editor [type=submit]").click();
  await page.locator("#product-editor").waitFor({ state: "detached" });
  assert.equal((await server.repo.read()).state.products[0].stock.M, 2);
  const productExportPromise = page.waitForEvent("download");
  await page.locator("#export-products").click();
  const productExport = await productExportPromise;
  assert.ok(
    (await readFile(await productExport.path(), "utf8")).includes("310"),
  );
  await page.locator("#new-product").click();
  await page.locator("[name=name]").fill("Pyjama Test");
  await page.locator("[name=nameAr]").fill("بيجامة اختبار");
  await page.locator("[name=color]").fill("Rose");
  await page.locator("[name=colorAr]").fill("وردي");
  await page.locator("[name=stock-S]").fill("1");
  await page
    .locator("#image-upload")
    .setInputFiles("/workspace/tazi-pyjamas/public/images/catalogue/00.jpg");
  await page.getByText("Photos ajoutées", { exact: true }).waitFor();
  await page.locator("#product-editor [type=submit]").click();
  await page.locator("#product-editor").waitFor({ state: "detached" });
  let data = (await server.repo.read()).state;
  const product = data.products.find((p) => p.name === "Pyjama Test");
  assert.ok(product);
  assert.equal(product.stock.S, 1);
  const mediaId = product.images[0].split("=")[1];
  const uploaded = (await server.mediaStore.getWithMetadata(mediaId)).data;
  assert.deepEqual(
    Buffer.from(uploaded),
    await readFile("/workspace/tazi-pyjamas/public/images/catalogue/00.jpg"),
  );
  await page.locator("[data-view=settings]").click();
  await page.locator("[name=deliveryFee]").fill("25");
  await page.locator("[name=banner]").fill("Bienvenue chez Tazi");
  await page.locator("[name=bannerAr]").fill("مرحباً بكم في طازي");
  await page.locator("#add-city").click();
  await page.locator("[data-city-name]").fill("Casablanca");
  await page.locator("[data-city-fee]").fill("30");
  await page.locator("#shop-settings>button").click();
  await page.getByText("Paramètres enregistrés", { exact: true }).waitFor();
  assert.equal((await server.repo.read()).state.settings.deliveryFee, 25);
  const customer = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  customer.on("pageerror", (e) => errors.push(e.message));
  await customer.goto(server.url);
  await customer.getByText("Bienvenue chez Tazi", { exact: true }).waitFor();
  await customer.locator("#search-btn").click();
  await customer.locator("#search").fill("Lavande");
  assert.match(await customer.locator(".product-meta").innerText(), /310 DH/);
  await customer.locator("[data-product=lavande]").first().click();
  assert.ok(await customer.locator("#size option[value=L]").isDisabled());
  await customer.keyboard.press("Escape");
  await customer.locator("#search").fill("Pyjama Test");
  assert.equal(await customer.locator(".product-card").count(), 1);
  await customer.locator("[data-product]").first().click();
  await customer.locator("#size").selectOption("S");
  await customer.locator("#add").click();
  await customer.locator("#bag").click();
  await customer.locator("#checkout").click();
  await customer.locator("[name=name]").fill("Client Test");
  await customer.locator("[name=phone]").fill("0612345678");
  await customer.locator("[name=city]").fill("Casablanca");
  await customer.locator("[name=address]").fill("Rue des tests 123");
  await customer.locator("[type=checkbox]").check();
  assert.match(
    await customer.locator("#shipping-estimate").innerText(),
    /280 DH/,
  );
  await customer.locator("[type=submit]").click();
  await customer.locator(".success").waitFor();
  data = (await server.repo.read()).state;
  assert.equal(data.orders.length, 1);
  assert.equal(data.orders[0].total, 280);
  assert.equal(data.products.find((p) => p.id === product.id).stock.S, 1);
  const orderId = data.orders[0].id;
  await page.locator("[data-view=orders]").click();
  await page.locator("#admin-refresh").click();
  await page.locator("[data-open-order]").first().waitFor();
  const orderExportPromise = page.waitForEvent("download");
  await page.locator("#export-orders").click();
  const orderExport = await orderExportPromise;
  assert.ok(
    (await readFile(await orderExport.path(), "utf8")).includes(orderId),
  );
  await page.locator("[data-open-order]").first().click();
  const printPromise = page.context().waitForEvent("page");
  await page.locator("#print-order").click();
  const print = await printPromise;
  await print.locator("h1").waitFor();
  assert.equal(await print.locator("h1").innerText(), "Bon de commande");
  assert.match(await print.locator("body").innerText(), /280 DH/);
  await print.close();
  await page.keyboard.press("Escape");
  async function update(fields) {
    await page.locator(`[data-open-order="${orderId}"]`).first().click();
    for (const [key, value] of Object.entries(fields)) {
      const input = page.locator(`#order-edit [name="${key}"]`);
      if (await input.evaluate((el) => el.tagName === "SELECT"))
        await input.selectOption(value);
      else await input.fill(value);
    }
    await page.locator("#order-edit button").click();
    await page.locator("#order-edit").waitFor({ state: "detached" });
  }
  await update({ status: "Confirmée", notes: "Test de confirmation" });
  assert.equal(
    (await server.repo.read()).state.products.find((p) => p.id === product.id)
      .stock.S,
    0,
  );
  await update({
    status: "Expédiée",
    carrier: "Test Carrier",
    tracking: "TEST-123",
  });
  await update({ status: "Livrée", payment: "Payé" });
  await page.locator("[data-view=overview]").click();
  assert.match(await page.locator(".dashboard-stats").innerText(), /280 DH/);
  await page.screenshot({
    path: "/workspace/tazi-previews/dashboard-desktop.png",
    fullPage: true,
  });
  await page.locator("[data-view=orders]").click();
  await update({ status: "Retournée", payment: "Remboursé" });
  assert.equal(
    (await server.repo.read()).state.products.find((p) => p.id === product.id)
      .stock.S,
    1,
  );
  await page.locator("#new-order").click();
  await page.locator("#manual-order [name=name]").fill("فاطمة");
  await page.locator("#manual-order [name=phone]").fill("0600112233");
  await page.locator("#manual-order [name=city]").fill("Rabat");
  await page
    .locator("#manual-order [name=address]")
    .fill("Adresse du test 123");
  await page.locator("[data-manual-product]").selectOption("lavande");
  await page.locator("[data-manual-size]").selectOption("M");
  await page.locator("#manual-order [type=submit]").click();
  await page.locator("#manual-order").waitFor({ state: "detached" });
  data = (await server.repo.read()).state;
  assert.equal(data.orders.length, 2);
  assert.equal(data.orders[1].source, "WhatsApp");
  assert.equal(data.orders[1].total, 335);
  await page.locator("[data-view=customers]").click();
  assert.equal(await page.locator(".admin-table tbody tr").count(), 2);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-customers").click();
  const download = await downloadPromise;
  const contents = await readFile(await download.path(), "utf8");
  assert.ok(contents.includes("فاطمة"));
  await page.locator("[data-view=products]").click();
  await page.locator("[name=query]").fill("Pyjama Test");
  await page.locator("#product-filters button").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-archive]").click();
  await page.getByText("Archivé", { exact: true }).waitFor();
  assert.equal(
    (await server.repo.read()).state.products.find((p) => p.id === product.id)
      .active,
    false,
  );
  await customer.goto(server.url);
  await customer.getByText("Bienvenue chez Tazi", { exact: true }).waitFor();
  await customer.locator("#search-btn").click();
  await customer.locator("#search").fill("Pyjama Test");
  assert.equal(await customer.locator(".product-card").count(), 0);
  await page.reload();
  await page.locator(".dashboard-stats").waitFor();
  assert.equal((await server.repo.read()).state.orders.length, 2);
  await page.locator("[data-language=ar]").click();
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.match(await page.locator(".admin-topbar h1").innerText(), /نظرة عامة/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/workspace/tazi-previews/dashboard-arabic-mobile.png",
    fullPage: true,
  });
  await page.locator("[data-view=settings]").click();
  const backupPromise = page.waitForEvent("download");
  await page.locator("#download-backup").click();
  const backup = await backupPromise;
  assert.equal(
    JSON.parse(await readFile(await backup.path(), "utf8")).orders.length,
    2,
  );
  await page.locator("#logout").click();
  await page.locator("#login").waitFor();
  const unauthorized = await page.request.get(
    server.url + "/.netlify/functions/shop?admin=1",
  );
  assert.equal(unauthorized.status(), 401);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: secure login; real handlers and CAS repository; product/size/stock edits; byte-exact image upload; new product published; delivery settings; storefront checkout; confirmation/shipping/payment/return stock accounting; manual WhatsApp orders; customer CSV; archive; persistence after reload; Arabic mobile; backup; logout. Storage provider is local in-memory.",
  );
} finally {
  await browser.close();
  await server.close();
}
