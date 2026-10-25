export const orderStatuses = [
  "Nouvelle",
  "Confirmée",
  "Expédiée",
  "Livrée",
  "Annulée",
  "Retournée",
];
export const paymentStatuses = ["En attente", "Payé", "Remboursé"];
export const sizeOptions = ["S", "M", "L", "XL"];
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const phoneKey = (value) =>
  String(value).replace(/\D/g, "").replace(/^0/, "212");
export const orderTotal = (o) => o.total ?? o.subtotal ?? 0;
export function shopDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type).value)
    .join("-");
}
export function filterOrders(
  orders,
  { query = "", status = "", payment = "", from = "", to = "" } = {},
) {
  const q = query.trim().toLowerCase();
  return [...orders]
    .filter(
      (o) =>
        (!q ||
          `${o.id} ${o.name} ${o.phone} ${o.city}`.toLowerCase().includes(q)) &&
        (!status || o.status === status) &&
        (!payment || o.payment === payment) &&
        (!from || shopDateKey(o.createdAt) >= from) &&
        (!to || shopDateKey(o.createdAt) <= to),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function customersFrom(orders) {
  const map = new Map();
  for (const o of [...orders].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    const key = phoneKey(o.phone);
    const c = map.get(key) || { key, orders: [], paid: 0, delivered: 0 };
    Object.assign(c, {
      name: o.name,
      phone: o.phone,
      city: o.city,
      last: o.createdAt,
    });
    c.orders.push(o);
    if (o.payment === "Payé") c.paid += orderTotal(o);
    if (o.status === "Livrée") c.delivered++;
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
}
export function dashboardMetrics(data, period = "30", now = new Date()) {
  const cutoff =
    period === "all" ? 0 : now.getTime() - Number(period) * 86400000;
  const orders = data.orders.filter(
    (o) => new Date(o.createdAt).getTime() >= cutoff,
  );
  const delivered = orders.filter((o) => o.status === "Livrée");
  const paid = orders.filter((o) => o.payment === "Payé");
  const low = data.products
    .filter((p) => p.active)
    .flatMap((p) =>
      p.sizes
        .filter(
          (s) =>
            p.stock[s] !== null &&
            p.stock[s] <= data.settings.lowStockThreshold,
        )
        .map((size) => ({ product: p, size, quantity: p.stock[size] })),
    );
  const best = new Map();
  for (const o of delivered)
    for (const i of o.items) {
      const row = best.get(i.id) || {
        id: i.id,
        name: i.name,
        nameAr: i.nameAr,
        qty: 0,
        amount: 0,
      };
      row.qty += i.qty;
      row.amount += i.qty * i.price;
      best.set(i.id, row);
    }
  return {
    orders,
    delivered,
    paid,
    revenue: delivered.reduce((n, o) => n + (o.subtotal ?? o.total), 0),
    received: paid.reduce((n, o) => n + orderTotal(o), 0),
    pending: data.orders.filter((o) => o.status === "Nouvelle").length,
    low,
    best: [...best.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
  };
}
export function csv(headers, rows) {
  const cell = (value) => {
    let v = String(value ?? "");
    if (
      /^\s*[=+\-@\t\r]/.test(v) ||
      (typeof value === "string" && /^0\d+$/.test(v))
    )
      v = "'" + v;
    return '"' + v.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")
  );
}
export function shopDelivery(settings, city) {
  const key = (v) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  return (
    settings.deliveryCities?.find((r) => key(r.city) === key(city))?.fee ??
    settings.deliveryFee ??
    null
  );
}
