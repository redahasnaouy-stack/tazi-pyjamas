import { getStore } from "@netlify/blobs";
import { initialState, ShopError } from "./commerce.mjs";
export function createRepository(store, legacy) {
  async function legacyRows() {
    const orders = [],
      versions = {};
    if (legacy)
      for await (const page of legacy.list({ paginate: true })) {
        for (const item of page.blobs) {
          const entry = await legacy.getWithMetadata(item.key, {
            type: "json",
          });
          if (entry) {
            orders.push(entry.data);
            versions[entry.data.id] = entry.etag || item.etag || "";
          }
        }
      }
    return { orders, versions };
  }
  async function read() {
    const entry = await store.getWithMetadata("state", { type: "json" });
    if (!entry) {
      const old = await legacyRows();
      const state = initialState(old.orders);
      state.legacyMigration = {
        until: Date.now() + 600000,
        done: false,
        versions: old.versions,
      };
      return { state, etag: null };
    }
    const state = entry.data;
    // Keep a final grace-period scan so invocations from the previous deploy cannot strand legacy orders.
    if (!state.legacyMigration?.done) {
      const old = await legacyRows();
      const normalized = initialState(old.orders).orders;
      const meta = state.legacyMigration || {
        until: Date.now() + 600000,
        versions: {},
      };
      for (const row of normalized) {
        const index = state.orders.findIndex((o) => o.id === row.id);
        if (index < 0) state.orders.push(row);
        else if (
          state.orders[index].revision === 0 &&
          state.orders[index].history?.[0]?.type === "import" &&
          meta.versions[row.id] !== old.versions[row.id]
        )
          state.orders[index] = row;
      }
      state.legacyMigration = {
        until: meta.until,
        done: Date.now() >= meta.until,
        versions: old.versions,
      };
    }
    return { state, etag: entry.etag };
  }
  async function transact(change) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { state, etag } = await read();
      const value = await change(state);
      if (Buffer.byteLength(JSON.stringify(state), "utf8") > 3 * 1024 * 1024)
        throw new ShopError("Capacité de données atteinte.", 409);
      const result = await store.setJSON(
        "state",
        state,
        etag ? { onlyIfMatch: etag } : { onlyIfNew: true },
      );
      if (result.modified) return { state, value };
    }
    throw new ShopError("Une autre modification est en cours. Réessayez.", 409);
  }
  return { read, transact };
}
export const repository = () =>
  createRepository(
    getStore({ name: "tazi-shop", consistency: "strong" }),
    getStore({ name: "tazi-orders", consistency: "strong" }),
  );
