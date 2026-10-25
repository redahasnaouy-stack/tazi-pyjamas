import { randomUUID } from "node:crypto";
import { authenticated, sameOrigin, json } from "../lib/admin-auth.mjs";
import { repository } from "../lib/shop-store.mjs";
import { applyAction, ShopError, customerKey } from "../lib/commerce.mjs";
export const config = {
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
export function createHandler(repoFactory = repository) {
  return async (request) => {
    try {
      if (request.method === "POST") {
        if (process.env.ORDERS_ENABLED !== "true")
          return json(
            {
              error:
                "La commande en ligne ouvre bientôt. Envoyez votre panier sur WhatsApp.",
            },
            503,
          );
        const raw = await request.text();
        if (raw.length > 12000)
          return json({ error: "Requête trop volumineuse." }, 413);
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ error: "Requête invalide." }, 400);
        }
        if (
          body?.requestId !== undefined &&
          !/^[a-f0-9-]{36}$/.test(body.requestId)
        )
          return json({ error: "Référence invalide." }, 400);
        const id = "TZ-" + (body?.requestId || randomUUID());
        const { value } = await repoFactory().transact((state) => {
          const existing = state.orders.find((o) => o.id === id);
          if (existing) {
            const same =
              existing.source === "Site" &&
              typeof body.phone === "string" &&
              customerKey(body.phone) === customerKey(existing.phone) &&
              ["name", "city", "address"].every(
                (key) =>
                  typeof body[key] === "string" &&
                  body[key].trim() === existing[key],
              ) &&
              Array.isArray(body.items) &&
              body.items.every((i) => i && typeof i === "object") &&
              JSON.stringify(body.items.map((i) => [i.id, i.size, i.qty])) ===
                JSON.stringify(
                  existing.items.map((i) => [i.id, i.size, i.qty]),
                );
            if (!same) throw new ShopError("Cette commande existe déjà.", 409);
            return existing;
          }
          if (!state.settings.ordersOpen)
            throw new ShopError(
              "La commande en ligne ouvre bientôt. Envoyez votre panier sur WhatsApp.",
              503,
            );
          return applyAction(state, {
            action: "order.create",
            order: body,
            source: "Site",
            id,
          });
        });
        return json(
          { id: value.id, total: value.total, deliveryFee: value.deliveryFee },
          201,
        );
      }
      if (!["GET", "PATCH"].includes(request.method))
        return json({ error: "Méthode non autorisée." }, 405);
      if (!authenticated(request))
        return json({ error: "Connexion requise." }, 401);
      if (request.method === "PATCH" && !sameOrigin(request))
        return json({ error: "Origine non autorisée." }, 403);
      if (request.method === "GET") {
        const { state } = await repoFactory().read();
        return json(
          [...state.orders].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
        );
      }
      const body = await request.json();
      await repoFactory().transact((state) =>
        applyAction(state, { action: "order.update", order: body }),
      );
      return json({ ok: true });
    } catch (e) {
      if (e instanceof ShopError) return json({ error: e.message }, e.status);
      console.error("Order service:", e.name);
      return json(
        {
          error:
            "Service indisponible. Contactez-nous sur WhatsApp ; votre panier est conservé.",
        },
        503,
      );
    }
  };
}
export default createHandler();
