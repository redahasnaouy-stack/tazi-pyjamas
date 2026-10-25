import { authenticated, sameOrigin, json } from "../lib/admin-auth.mjs";
import { publicState, applyAction, ShopError } from "../lib/commerce.mjs";
import { repository } from "../lib/shop-store.mjs";
export function createHandler(repoFactory = repository) {
  return async (request) => {
    try {
      const privateView = new URL(request.url).searchParams.has("admin");
      if (request.method === "GET") {
        if (privateView && !authenticated(request))
          return json({ error: "Connexion requise." }, 401);
        const { state } = await repoFactory().read();
        return json(privateView ? state : publicState(state));
      }
      if (request.method !== "POST")
        return json({ error: "Méthode non autorisée." }, 405);
      if (!authenticated(request))
        return json({ error: "Connexion requise." }, 401);
      if (!sameOrigin(request))
        return json({ error: "Origine non autorisée." }, 403);
      const body = await request.text();
      if (body.length > 64000)
        return json({ error: "Requête trop volumineuse." }, 413);
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return json({ error: "Requête invalide." }, 400);
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        return json({ error: "Requête invalide." }, 400);
      const { state, value } = await repoFactory().transact((state) =>
        applyAction(state, input),
      );
      return json({ state, result: value });
    } catch (e) {
      if (e instanceof ShopError) return json({ error: e.message }, e.status);
      console.error("Shop service:", e.name);
      return json({ error: "Service indisponible. Réessayez." }, 503);
    }
  };
}
export default createHandler();
