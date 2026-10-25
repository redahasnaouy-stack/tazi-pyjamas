// Local integration adapter: real application handlers with a deterministic in-memory Blob provider.
import http from "node:http";
import { createRepository } from "../netlify/lib/shop-store.mjs";
import { createHandler as shop } from "../netlify/functions/shop.mjs";
import { createHandler as orders } from "../netlify/functions/orders.mjs";
import { createHandler as media } from "../netlify/functions/media.mjs";
import auth from "../netlify/functions/admin-auth.mjs";
import { MemoryStore } from "./memory-store.mjs";
export async function startLocalShop(port = 4180) {
  process.env.ADMIN_EMAIL = "owner@example.test";
  process.env.ADMIN_PASSWORD = "test-only-password-not-for-deployment";
  process.env.ADMIN_SESSION_SECRET =
    "test-only-session-secret-not-for-deployment";
  process.env.ORDERS_ENABLED = "true";
  const stateStore = new MemoryStore(),
    legacy = new MemoryStore(),
    mediaStore = new MemoryStore();
  const repo = createRepository(stateStore, legacy);
  const handlers = {
    shop: shop(() => repo),
    orders: orders(() => repo),
    "admin-auth": auth,
    media: media(() => mediaStore),
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost:" + port);
      let response;
      const handler = handlers[url.pathname.split("/").at(-1)];
      if (url.pathname.startsWith("/.netlify/functions/") && handler) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        response = await handler(
          new Request(url, {
            method: req.method,
            headers: req.headers,
            ...(body.length ? { body } : {}),
            duplex: "half",
          }),
        );
      } else response = await fetch("http://localhost:4173" + req.url);
      const headers = Object.fromEntries(
        [...response.headers].filter(
          ([key]) =>
            ![
              "content-encoding",
              "content-length",
              "transfer-encoding",
              "connection",
            ].includes(key),
        ),
      );
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolve) => server.listen(port, "0.0.0.0", resolve));
  return {
    url: "http://localhost:" + port,
    repo,
    mediaStore,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
