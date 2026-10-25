import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { authenticated, sameOrigin, json } from "../lib/admin-auth.mjs";
export function imageType(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    Buffer.from(bytes.slice(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}
export function createHandler(
  storeFactory = () => getStore({ name: "tazi-media", consistency: "strong" }),
) {
  return async (request) => {
    try {
      if (request.method === "POST") {
        if (!authenticated(request))
          return json({ error: "Connexion requise." }, 401);
        if (!sameOrigin(request))
          return json({ error: "Origine non autorisée." }, 403);
        const length = Number(request.headers.get("content-length"));
        if (length > 3 * 1024 * 1024)
          return json({ error: "Photo limitée à 3 Mo." }, 413);
        const buffer = await request.arrayBuffer();
        if (buffer.byteLength > 3 * 1024 * 1024)
          return json({ error: "Photo limitée à 3 Mo." }, 413);
        const type = imageType(new Uint8Array(buffer));
        if (!type)
          return json(
            { error: "Format photo invalide. JPEG, PNG ou WebP uniquement." },
            400,
          );
        const id = randomUUID();
        await storeFactory().set(id, buffer, { metadata: { type } });
        return json({ url: "/.netlify/functions/media?id=" + id }, 201);
      }
      if (request.method !== "GET")
        return json({ error: "Méthode non autorisée." }, 405);
      const id = new URL(request.url).searchParams.get("id");
      if (!/^[a-f0-9-]{36}$/.test(id || ""))
        return json({ error: "Photo introuvable." }, 404);
      const entry = await storeFactory().getWithMetadata(id, {
        type: "arrayBuffer",
      });
      if (!entry) return json({ error: "Photo introuvable." }, 404);
      return new Response(entry.data, {
        headers: {
          "Content-Type": entry.metadata.type,
          "Cache-Control": "public,max-age=86400,immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch (e) {
      return json({ error: "Envoi de photo impossible. Réessayez." }, 503);
    }
  };
}
export default createHandler();
