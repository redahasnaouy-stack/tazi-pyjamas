import { randomUUID } from "node:crypto";
import { products as seed, normalizePhone } from "../../src/catalog.js";
import arabic from "../../src/ar.js";
export class ShopError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const sizes = ["S", "M", "L", "XL"];
export const statuses = [
  "Nouvelle",
  "Confirmée",
  "Expédiée",
  "Livrée",
  "Annulée",
  "Retournée",
];
export const payments = ["En attente", "Payé", "Remboursé"];
export const defaultSettings = {
  name: "Tazi Pyjamas",
  nameAr: "طازي بيجامات",
  whatsapp: "212663266817",
  email: "",
  deliveryFee: null,
  deliveryCities: [],
  deliveryNote: "Frais et délais de livraison à confirmer avec la boutique.",
  deliveryNoteAr: "تؤكد رسوم التوصيل ومدته مع المتجر.",
  lowStockThreshold: 3,
  ordersOpen: true,
  banner: "",
  bannerAr: "",
};
const fail = (message, status) => {
  throw new ShopError(message, status);
};
const text = (value, label, max = 160, min = 0) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(label);
  return value.trim();
};
const amount = (value, label, max = 100000) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    Math.abs(Math.round(value * 100) - value * 100) > 0.000001
  )
    fail(label);
  return Math.round(value * 100) / 100;
};
const cityKey = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export const customerKey = (phone) => {
  const p = normalizePhone(phone);
  return p.startsWith("0") ? "212" + p.slice(1) : p.replace(/^\+/, "");
};
export function initialState(legacy = []) {
  return {
    version: 1,
    revision: 0,
    settingsRevision: 0,
    products: seed.map((p) => ({
      ...structuredClone(p),
      nameAr: arabic[p.name] || "",
      colorAr: arabic[p.color] || "",
      subtitleAr: arabic[p.subtitle] || "",
      active: true,
      sizes: [...sizes],
      stock: Object.fromEntries(sizes.map((s) => [s, null])),
      revision: 0,
    })),
    settings: { ...structuredClone(defaultSettings) },
    orders: legacy.map((o) => ({
      ...o,
      subtotal: o.total,
      deliveryFee: null,
      payment: "En attente",
      source: "Site",
      notes: "",
      carrier: "",
      tracking: "",
      revision: 0,
      reservation: [],
      history: [{ date: o.createdAt, type: "import", status: o.status }],
    })),
    activity: [],
  };
}
export function publicState(state) {
  return {
    products: state.products
      .filter((p) => p.active)
      .map((p) => {
        const { stock, revision, ...safe } = p;
        return {
          ...safe,
          availableSizes: p.sizes.filter(
            (s) => stock[s] === null || stock[s] > 0,
          ),
        };
      }),
    settings: {
      ...state.settings,
      ordersEnabled:
        state.settings.ordersOpen && process.env.ORDERS_ENABLED === "true",
    },
  };
}
export function validateProduct(input, previous) {
  if (!input || typeof input !== "object") fail("Produit invalide.");
  const p = {
    id: previous?.id || "custom-" + randomUUID(),
    name: text(input.name, "Nom du produit invalide.", 80, 2),
    nameAr: text(input.nameAr || "", "Nom arabe invalide.", 100, 2),
    color: text(input.color || "", "Couleur invalide.", 80),
    colorAr: text(input.colorAr || "", "Couleur arabe invalide.", 100),
    subtitle: text(input.subtitle || "", "Description invalide.", 500),
    subtitleAr: text(
      input.subtitleAr || "",
      "Description arabe invalide.",
      500,
    ),
    category: input.category,
    price: amount(
      input.price,
      "Le prix doit être compris entre 200 et 350 DH.",
      350,
    ),
    swatch: input.swatch,
    tag: text(input.tag || "Essentiel", "Étiquette invalide.", 40),
    active: input.active,
    sizes: input.sizes,
    images: input.images,
    stock: {},
    revision: (previous?.revision ?? -1) + 1,
    sourceImages: previous?.sourceImages || [],
  };
  if ((p.color && !p.colorAr) || (p.subtitle && !p.subtitleAr))
    fail("Complétez les champs arabes du produit.");
  if (
    ![
      "Essentiel",
      "Coup de cœur",
      "Douceur florale",
      "Fleuri",
      "Élégance",
      "Douceur",
      "Fraîcheur",
      "Dentelle",
      "Rayures",
      "Imprimé",
      "Ensemble",
      "Lumineux",
    ].includes(p.tag)
  )
    fail("Étiquette invalide.");
  if (
    p.price < 200 ||
    !["Satin", "Fleuri", "Rayé", "Imprimé"].includes(p.category) ||
    !/^#[0-9a-f]{6}$/i.test(p.swatch) ||
    typeof p.active !== "boolean"
  )
    fail("Produit invalide.");
  if (
    !Array.isArray(p.sizes) ||
    !p.sizes.length ||
    new Set(p.sizes).size !== p.sizes.length ||
    p.sizes.some((s) => !sizes.includes(s))
  )
    fail("Sélectionnez au moins un intervalle de tailles valide.");
  if (
    !Array.isArray(p.images) ||
    !p.images.length ||
    p.images.length > 8 ||
    p.images.some(
      (url) =>
        typeof url !== "string" ||
        !(
          /^\/images\/catalogue\/\d{2}\.jpg$/.test(url) ||
          /^\/\.netlify\/functions\/media\?id=[a-f0-9-]{36}$/.test(url)
        ),
    )
  )
    fail("Ajoutez une photo valide.");
  for (const size of sizes) {
    const n = input.stock?.[size];
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 100000))
      fail("Stock invalide.");
    p.stock[size] = n;
  }
  return p;
}
export function validateSettings(input) {
  if (!input || typeof input !== "object") fail("Paramètres invalides.");
  const s = {
    name: text(input.name, "Nom du magasin invalide.", 80, 2),
    nameAr: text(input.nameAr, "Nom arabe invalide.", 100, 2),
    whatsapp: text(input.whatsapp, "Numéro WhatsApp invalide.", 20),
    email: text(input.email || "", "Email invalide.", 254),
    deliveryFee:
      input.deliveryFee === null
        ? null
        : amount(input.deliveryFee, "Frais de livraison invalides.", 1000),
    deliveryNote: text(
      input.deliveryNote || "",
      "Texte de livraison invalide.",
      500,
    ),
    deliveryNoteAr: text(
      input.deliveryNoteAr || "",
      "Texte arabe invalide.",
      500,
    ),
    banner: text(input.banner || "", "Annonce invalide.", 200),
    bannerAr: text(input.bannerAr || "", "Annonce arabe invalide.", 200),
    lowStockThreshold: input.lowStockThreshold,
    ordersOpen: input.ordersOpen,
    deliveryCities: input.deliveryCities,
  };
  if ((s.banner && !s.bannerAr) || (s.deliveryNote && !s.deliveryNoteAr))
    fail("Complétez les textes arabes des paramètres.");
  if (
    !/^212[5-7]\d{8}$/.test(s.whatsapp) ||
    (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) ||
    !Number.isInteger(s.lowStockThreshold) ||
    s.lowStockThreshold < 0 ||
    s.lowStockThreshold > 1000 ||
    typeof s.ordersOpen !== "boolean"
  )
    fail("Paramètres invalides.");
  if (!Array.isArray(s.deliveryCities) || s.deliveryCities.length > 100)
    fail("Villes invalides.");
  s.deliveryCities = s.deliveryCities.map((r) => ({
    city: text(r.city, "Ville invalide.", 100, 2),
    fee: amount(r.fee, "Frais de livraison invalides.", 1000),
  }));
  if (
    new Set(s.deliveryCities.map((r) => cityKey(r.city))).size !==
    s.deliveryCities.length
  )
    fail("Ville dupliquée.");
  return s;
}
export function deliveryFee(settings, city) {
  return (
    settings.deliveryCities.find((r) => cityKey(r.city) === cityKey(city))
      ?.fee ?? settings.deliveryFee
  );
}
export function createOrder(
  state,
  input,
  source = "Site",
  now = new Date().toISOString(),
  id = "TZ-" + randomUUID(),
) {
  if (!input || typeof input !== "object") fail("Panier invalide.");
  const name = text(input.name, "Indiquez votre nom complet.", 100, 2),
    city = text(input.city, "Complétez votre ville et votre adresse.", 100, 3),
    address = text(
      input.address,
      "Complétez votre ville et votre adresse.",
      300,
      3,
    );
  if (
    typeof input.phone !== "string" ||
    !/^(?:\+212|0)[5-7]\d{8}$/.test(normalizePhone(input.phone))
  )
    fail("Indiquez un numéro marocain valide.");
  if (
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 100
  )
    fail("Panier invalide.");
  const seen = new Set();
  const items = input.items.map((i) => {
    const p = state.products.find((p) => p.id === i.id && p.active);
    if (
      !p ||
      !p.sizes.includes(i.size) ||
      !Number.isInteger(i.qty) ||
      i.qty < 1 ||
      i.qty > 5
    )
      fail("Article indisponible.");
    const key = i.id + ":" + i.size;
    if (seen.has(key)) fail("Article dupliqué.");
    seen.add(key);
    if (p.stock[i.size] !== null && p.stock[i.size] < i.qty)
      fail("Stock insuffisant.", 409);
    return {
      id: p.id,
      name: p.name,
      nameAr: p.nameAr,
      size: i.size,
      qty: i.qty,
      price: p.price,
    };
  });
  const subtotal =
    Math.round(items.reduce((n, i) => n + i.price * i.qty, 0) * 100) / 100;
  if (
    source === "Site" &&
    input.expectedSubtotal !== undefined &&
    Math.abs(input.expectedSubtotal - subtotal) > 0.001
  )
    fail("Les prix ont changé. Actualisez votre panier.", 409);
  const shipping = deliveryFee(state.settings, city);
  if (
    source === "Site" &&
    input.expectedDeliveryFee !== undefined &&
    input.expectedDeliveryFee !== shipping
  )
    fail("Les frais de livraison ont changé. Actualisez votre panier.", 409);
  return {
    id,
    name,
    phone: normalizePhone(input.phone),
    city,
    address,
    items,
    subtotal,
    deliveryFee: shipping,
    total: Math.round((subtotal + (shipping ?? 0)) * 100) / 100,
    status: "Nouvelle",
    payment: "En attente",
    source,
    notes: "",
    carrier: "",
    tracking: "",
    createdAt: now,
    updatedAt: now,
    revision: 0,
    reservation: [],
    history: [{ date: now, type: "created", status: "Nouvelle" }],
  };
}
const transitions = {
  Nouvelle: ["Confirmée", "Annulée"],
  Confirmée: ["Expédiée", "Annulée"],
  Expédiée: ["Livrée", "Retournée"],
  Livrée: ["Retournée"],
  Annulée: ["Nouvelle"],
  Retournée: [],
};
export function updateOrder(state, input, now) {
  const order = state.orders.find((o) => o.id === input.id);
  if (!order) fail("Commande introuvable.", 404);
  if (input.revision !== order.revision)
    fail("Les données ont changé. Actualisez la page.", 409);
  const next = input.status ?? order.status;
  if (
    !statuses.includes(next) ||
    (next !== order.status && !transitions[order.status]?.includes(next))
  )
    fail("Transition de statut non autorisée.", 409);
  if (next !== order.status) {
    if (["Confirmée", "Expédiée"].includes(next) && !order.reservation.length) {
      for (const item of order.items) {
        const p = state.products.find((p) => p.id === item.id);
        if (!p || !p.active || !p.sizes.includes(item.size))
          fail("Article indisponible.", 409);
        if (p.stock[item.size] !== null) {
          if (p.stock[item.size] < item.qty) fail("Stock insuffisant.", 409);
          p.stock[item.size] -= item.qty;
          p.revision++;
          order.reservation.push({ id: p.id, size: item.size, qty: item.qty });
        }
      }
    }
    if (["Annulée", "Retournée"].includes(next)) {
      for (const item of order.reservation) {
        const p = state.products.find((p) => p.id === item.id);
        if (p && p.stock[item.size] !== null) {
          p.stock[item.size] += item.qty;
          p.revision++;
        }
      }
      order.reservation = [];
    }
    order.status = next;
    order.history.push({ date: now, type: "status", status: next });
  }
  let edited = false;
  for (const [field, max, min] of [
    ["name", 100, 2],
    ["city", 100, 3],
    ["address", 300, 3],
  ])
    if (input[field] !== undefined) {
      const value = text(
        input[field],
        field === "name"
          ? "Indiquez votre nom complet."
          : "Complétez votre ville et votre adresse.",
        max,
        min,
      );
      if (value !== order[field]) edited = true;
      order[field] = value;
    }
  if (input.phone !== undefined) {
    if (
      typeof input.phone !== "string" ||
      !/^(?:\+212|0)[5-7]\d{8}$/.test(normalizePhone(input.phone))
    )
      fail("Indiquez un numéro marocain valide.");
    const value = normalizePhone(input.phone);
    if (value !== order.phone) edited = true;
    order.phone = value;
  }
  if (edited) order.history.push({ date: now, type: "edited" });
  if (input.payment !== undefined) {
    if (!payments.includes(input.payment)) fail("Paiement invalide.");
    if (order.payment !== input.payment)
      order.history.push({
        date: now,
        type: "payment",
        payment: input.payment,
      });
    order.payment = input.payment;
  }
  for (const key of ["notes", "carrier", "tracking"])
    if (input[key] !== undefined)
      order[key] = text(
        input[key],
        key === "notes" ? "Note invalide." : "Suivi invalide.",
        key === "notes" ? 2000 : 120,
      );
  if (input.deliveryFee !== undefined) {
    order.deliveryFee =
      input.deliveryFee === null
        ? null
        : amount(input.deliveryFee, "Frais de livraison invalides.", 1000);
    order.total =
      Math.round((order.subtotal + (order.deliveryFee ?? 0)) * 100) / 100;
  }
  order.revision++;
  order.updatedAt = now;
  order.history = order.history.slice(-100);
  return order;
}
export function applyAction(state, input, now = new Date().toISOString()) {
  let result;
  let label = "";
  let labelAr = "";
  switch (input.action) {
    case "product.save": {
      const previous = state.products.find((p) => p.id === input.product?.id);
      if (input.product?.id && !previous) fail("Produit introuvable.", 404);
      if (previous && input.product.revision !== previous.revision)
        fail("Les données ont changé. Actualisez la page.", 409);
      const p = validateProduct(input.product || {}, previous);
      if (previous) state.products[state.products.indexOf(previous)] = p;
      else {
        if (state.products.length >= 500)
          fail("Limite de produits atteinte.", 409);
        state.products.push(p);
      }
      result = p;
      label = p.name;
      labelAr = p.nameAr;
      break;
    }
    case "product.archive": {
      const p = state.products.find((p) => p.id === input.id);
      if (!p) fail("Produit introuvable.", 404);
      if (input.revision !== p.revision)
        fail("Les données ont changé. Actualisez la page.", 409);
      p.active = false;
      p.revision++;
      result = p;
      label = p.name;
      labelAr = p.nameAr;
      break;
    }
    case "settings.save": {
      if (input.revision !== state.settingsRevision)
        fail("Les données ont changé. Actualisez la page.", 409);
      state.settings = validateSettings(input.settings || {});
      state.settingsRevision++;
      result = state.settings;
      label = state.settings.name;
      labelAr = state.settings.nameAr;
      break;
    }
    case "order.create": {
      if (state.orders.length >= 5000)
        fail("Limite de commandes atteinte. Exportez les données.", 409);
      const source = ["Manuelle", "WhatsApp"].includes(input.source)
        ? input.source
        : "Site";
      if (input.id && !/^TZ-[a-f0-9-]{36}$/.test(input.id))
        fail("Référence invalide.");
      if (input.id && state.orders.some((o) => o.id === input.id))
        fail("Cette commande existe déjà.", 409);
      const o = createOrder(state, input.order || {}, source, now, input.id);
      state.orders.push(o);
      result = o;
      label = o.id;
      break;
    }
    case "order.update": {
      result = updateOrder(state, input.order || {}, now);
      label = result.id;
      break;
    }
    default:
      fail("Opération invalide.");
  }
  state.revision++;
  state.activity.unshift({
    id: randomUUID(),
    date: now,
    type: input.action,
    label,
    labelAr,
  });
  state.activity = state.activity.slice(0, 200);
  return result;
}
