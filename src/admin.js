import {
  createIcons,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  ArrowUpRight,
  LogOut,
  Plus,
  Search,
  RefreshCw,
  Download,
  Eye,
  Pencil,
  Archive,
  X,
  Printer,
  Phone,
  Upload,
  ChevronRight,
  Check,
  AlertCircle,
  Clock,
  Image as ImageIcon,
} from "lucide";
import {
  getLanguage,
  setLanguage,
  translate as t,
  localize,
  languageSwitcher,
  errorText,
} from "./i18n.js";
import {
  orderStatuses,
  paymentStatuses,
  sizeOptions,
  escapeHTML as esc,
  shopDateKey,
  customersFrom,
  dashboardMetrics,
  filterOrders,
  csv,
  orderTotal,
  phoneKey,
  shopDelivery,
} from "./admin-model.js";
import "./admin.css";
const iconMap = {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  ArrowUpRight,
  LogOut,
  Plus,
  Search,
  RefreshCw,
  Download,
  Eye,
  Pencil,
  Archive,
  X,
  Printer,
  Phone,
  Upload,
  ChevronRight,
  Check,
  AlertCircle,
  Clock,
  Image: ImageIcon,
};
const icon = (n) =>
  `<i data-lucide="${n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}"></i>`;
const icons = () => createIcons({ icons: iconMap });
const money = (n) =>
  `${new Intl.NumberFormat(getLanguage() === "ar" ? "ar-MA" : "fr-MA", { maximumFractionDigits: 2 }).format(n || 0)} ${getLanguage() === "ar" ? "درهم" : "DH"}`;
const display = (p, key = "name") =>
  getLanguage() === "ar" ? p[key + "Ar"] || t(p[key]) : p[key];
const date = (value) =>
  new Intl.DateTimeFormat(getLanguage() === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeZone: "Africa/Casablanca",
  }).format(new Date(value));
const opt = (values, value) =>
  values
    .map(
      (s) =>
        `<option value="${esc(s)}" ${s === value ? "selected" : ""}>${esc(t(s))}</option>`,
    )
    .join("");
const protectedText = (value) => `<span data-no-translate>${esc(value)}</span>`;
const badge = (value) =>
  `<span class="status-badge status-${orderStatuses.indexOf(value)}">${esc(t(value))}</span>`;
let dispose = () => {};
export function mountAdmin({ app, brand, toast }) {
  dispose();
  const state = {
    data: null,
    view: "overview",
    period: "30",
    filters: { query: "", status: "", payment: "", from: "", to: "" },
    productQuery: "",
    productFilter: "",
    customerQuery: "",
    page: 1,
    loading: false,
  };
  let timer;
  let dialogDirty = false;
  let dialogBusy = false;
  let settingsDirty = false;
  let returnFocus = null;
  const overlay = document.querySelector("#overlay");
  function closeDialog(force = false) {
    if (!force && dialogBusy) {
      toast("Enregistrement en cours…");
      return;
    }
    if (
      !force &&
      dialogDirty &&
      !confirm(t("Abandonner les modifications non enregistrées ?"))
    )
      return;
    overlay.innerHTML = "";
    document.body.classList.remove("modal-open");
    dialogDirty = false;
    dialogBusy = false;
    returnFocus?.focus();
  }
  function dialog(markup, { wide = true } = {}) {
    closeDialog(true);
    returnFocus = document.activeElement;
    overlay.innerHTML = localize(
      `<div class="backdrop"></div><section class="modal admin-modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="Détails"><button class="close icon-button" aria-label="Fermer">${icon("X")}</button>${markup}</section>`,
    );
    document.body.classList.add("modal-open");
    overlay.querySelector(".close").onclick = () => closeDialog();
    overlay.querySelector(".backdrop").onclick = () => closeDialog();
    overlay
      .querySelectorAll("form input,form select,form textarea")
      .forEach((input) =>
        input.addEventListener("input", () => (dialogDirty = true)),
      );
    icons();
    overlay.querySelector("input,button")?.focus();
  }
  function keydown(e) {
    if (!overlay.childElementCount) return;
    if (e.key === "Escape") closeDialog();
    if (e.key === "Tab") {
      const els = [
        ...overlay.querySelectorAll("button,input,select,textarea,a"),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      if (!els.length) return;
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault();
        els.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
        e.preventDefault();
        els[0].focus();
      }
    }
  }
  document.addEventListener("keydown", keydown);
  async function api(path = "shop?admin=1", body, method) {
    const r = await fetch("/.netlify/functions/" + path, {
      ...(body
        ? {
            method: method || "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : method
          ? { method }
          : {}),
    });
    let data;
    try {
      data = await r.json();
    } catch {
      throw Error("Service indisponible. Réessayez.");
    }
    if (r.status === 401) {
      closeDialog(true);
      state.data = null;
      settingsDirty = false;
      renderLogin();
      throw Error("Session expirée ou accès refusé. Reconnectez-vous.");
    }
    if (!r.ok) throw Error(data.error || "Service indisponible. Réessayez.");
    return data;
  }
  async function refresh() {
    state.loading = true;
    try {
      state.data = await api();
      render();
    } finally {
      state.loading = false;
    }
  }
  async function mutate(body) {
    const data = await api("shop", body);
    state.data = data.state;
    return data.result;
  }
  function guardNavigation() {
    if (
      settingsDirty &&
      !confirm(t("Abandonner les modifications non enregistrées ?"))
    )
      return false;
    settingsDirty = false;
    return true;
  }
  function languageBindings() {
    app.querySelectorAll("[data-language]").forEach(
      (b) =>
        (b.onclick = () => {
          if (!guardNavigation()) return;
          setLanguage(b.dataset.language);
          state.data ? render() : renderLogin();
        }),
    );
  }
  const menu = [
    ["overview", "LayoutDashboard", "Vue d’ensemble"],
    ["orders", "ShoppingBag", "Commandes"],
    ["products", "Package", "Produits & stock"],
    ["customers", "Users", "Clients"],
    ["settings", "Settings", "Paramètres"],
  ];
  function shell(content, privateView = true) {
    app.innerHTML = localize(
      `<div class="admin-shell complete-admin"><aside>${brand}${languageSwitcher()}<span class="admin-label">ESPACE BOUTIQUE</span><nav class="admin-nav" aria-label="Navigation administrateur">${menu.map(([key, symbol, label]) => `<button data-view="${key}" ${privateView ? "" : "disabled"} class="${state.view === key && privateView ? "selected" : ""}" aria-current="${state.view === key ? "page" : "false"}">${icon(symbol)}<span>${label}</span>${key === "orders" && state.data?.orders.filter((o) => o.status === "Nouvelle").length ? `<small>${state.data.orders.filter((o) => o.status === "Nouvelle").length}</small>` : ""}</button>`).join("")}</nav><div class="admin-aside-bottom"><a href="/">${icon("ArrowUpRight")} Voir la boutique</a>${privateView ? `<button id="logout">${icon("LogOut")} Déconnexion</button>` : ""}<small>Accès réservé au propriétaire</small></div></aside><main class="admin-main"><div class="admin-topbar"><div><div class="eyebrow">TAZI PYJAMAS / GESTION</div><h1>${privateView ? menu.find(([key]) => key === state.view)[2] : "Bienvenue"}</h1></div>${privateView ? `<button class="admin-icon-btn" id="admin-refresh" aria-label="Actualiser">${icon("RefreshCw")}</button>` : ""}</div>${content}<p id="admin-feedback" class="form-error" role="alert"></p></main></div>`,
    );
    languageBindings();
    icons();
    app.querySelectorAll("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          if (!guardNavigation()) return;
          state.view = b.dataset.view;
          state.page = 1;
          render();
        }),
    );
    app.querySelector("#admin-refresh")?.addEventListener("click", async () => {
      if (!guardNavigation()) return;
      try {
        await refresh();
        toast("Données actualisées");
      } catch (e) {
        feedback(e);
      }
    });
    app.querySelector("#logout")?.addEventListener("click", async () => {
      if (!guardNavigation()) return;
      try {
        await api("admin-auth", undefined, "DELETE");
        state.data = null;
        settingsDirty = false;
        closeDialog(true);
        renderLogin();
      } catch (e) {
        feedback(e);
      }
    });
  }
  function feedback(error, element = app.querySelector("#admin-feedback")) {
    if (element)
      element.textContent = errorText(error.message || String(error));
  }
  function renderLogin() {
    shell(
      `<section class="login-card"><h2>Connexion privée</h2><p>Connectez-vous avec les identifiants du propriétaire pour consulter les commandes.</p><form id="login"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label><p class="form-error" role="alert"></p><button class="button primary">Se connecter ${icon("ArrowUpRight")}</button></form><small>Accès réservé au propriétaire de la boutique. Votre session expire après quatre heures.</small></section>`,
      false,
    );
    app.querySelector("#login").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      button.disabled = true;
      try {
        await api("admin-auth", Object.fromEntries(new FormData(e.target)));
        await refresh();
      } catch (error) {
        feedback(error, e.target.querySelector(".form-error"));
        button.disabled = false;
      }
    };
  }
  function render() {
    if (!state.data) return renderLogin();
    const content = {
      overview: overview,
      orders: orderList,
      products: productList,
      customers: customerList,
      settings: settingsView,
    }[state.view]();
    shell(content);
    ({
      overview: bindOverview,
      orders: bindOrders,
      products: bindProducts,
      customers: bindCustomers,
      settings: bindSettings,
    })[state.view]();
    app
      .querySelectorAll("[data-open-order]")
      .forEach((b) => (b.onclick = () => orderDetail(b.dataset.openOrder)));
    app
      .querySelectorAll("[data-edit-product]")
      .forEach((b) => (b.onclick = () => productForm(b.dataset.editProduct)));
  }
  function overview() {
    const d = state.data,
      m = dashboardMetrics(d, state.period);
    const bars = Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - 6 + i);
      const key = day.toLocaleDateString("en-CA", {
        timeZone: "Africa/Casablanca",
      });
      return {
        date: day,
        value: d.orders.filter(
          (o) =>
            new Date(o.createdAt).toLocaleDateString("en-CA", {
              timeZone: "Africa/Casablanca",
            }) === key,
        ).length,
      };
    });
    const max = Math.max(1, ...bars.map((b) => b.value));
    return `<div class="admin-intro"><p>Votre boutique en un coup d’œil.</p><select id="period" aria-label="Période"><option value="7" ${state.period === "7" ? "selected" : ""}>7 derniers jours</option><option value="30" ${state.period === "30" ? "selected" : ""}>30 derniers jours</option><option value="90" ${state.period === "90" ? "selected" : ""}>90 derniers jours</option><option value="all" ${state.period === "all" ? "selected" : ""}>Depuis le début</option></select></div><div class="dashboard-stats">${[
      ["Commandes reçues", m.orders.length, "ShoppingBag"],
      ["CA produits livrés", money(m.revenue), "Check"],
      ["Encaissements déclarés", money(m.received), "Download"],
      ["Commandes à traiter", m.pending, "Clock"],
    ]
      .map(
        ([label, value, symbol]) =>
          `<article><span>${icon(symbol)}${label}</span><b>${value}</b></article>`,
      )
      .join(
        "",
      )}</div><div class="dashboard-columns"><section class="admin-card"><div class="admin-card-heading"><h2>Demandes des 7 derniers jours</h2></div><div class="mini-chart" role="img" aria-label="Nombre de commandes reçues par jour">${bars.map((b) => `<div><strong>${b.value}</strong><span class="bar-track"><i style="height:${(b.value / max) * 100}%"></i></span><small>${b.date.toLocaleDateString(getLanguage() === "ar" ? "ar-MA" : "fr-MA", { weekday: "short", day: "numeric", timeZone: "Africa/Casablanca" })}</small></div>`).join("")}</div></section><section class="admin-card"><h2>État du stock</h2><p>${d.products.filter((p) => p.active).length} <span>produits actifs</span> · ${d.products.filter((p) => p.active && p.sizes.every((s) => p.stock[s] === null)).length} <span>sans stock renseigné</span></p>${
      m.low.length
        ? `<div class="low-stock-list">${m.low
            .slice(0, 7)
            .map(
              (r) =>
                `<button data-edit-product="${r.product.id}"><span data-no-translate>${esc(display(r.product))} · ${r.size}</span><b>${r.quantity === 0 ? t("Rupture de stock") : r.quantity}</b></button>`,
            )
            .join("")}</div>`
        : '<p class="empty">Aucune alerte de stock renseigné.</p>'
    }<small>Le stock est réservé à la confirmation du client.</small></section></div><section class="admin-card orders-card"><div class="admin-card-heading"><h2>Dernières commandes</h2><button class="text-button" id="all-orders">Voir toutes les commandes</button></div>${orderTable([...d.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5))}</section><div class="dashboard-columns"><section class="admin-card"><h2>Meilleures ventes livrées</h2>${m.best.length ? m.best.map((p) => `<div class="ranking"><span data-no-translate>${esc(display(p))}</span><b>${p.qty} · ${money(p.amount)}</b></div>`).join("") : '<p class="empty">Aucune vente livrée sur cette période.</p>'}</section><section class="admin-card"><h2>Activité récente</h2>${
      d.activity.length
        ? d.activity
            .slice(0, 6)
            .map(
              (a) =>
                `<div class="activity-line"><span>${t({ "product.save": "Produit enregistré", "product.archive": "Produit archivé", "settings.save": "Paramètres enregistrés", "order.create": "Commande créée", "order.update": "Commande modifiée" }[a.type] || a.type)}<small data-no-translate>${esc(getLanguage() === "ar" ? a.labelAr || t(a.label) : a.label)}</small></span><small>${date(a.date)}</small></div>`,
            )
            .join("")
        : '<p class="empty">Vos prochaines actions apparaîtront ici.</p>'
    }</section></div>`;
  }
  function bindOverview() {
    app.querySelector("#period").onchange = (e) => {
      state.period = e.target.value;
      render();
    };
    app.querySelector("#all-orders").onclick = () => {
      state.view = "orders";
      state.filters = { query: "", status: "", payment: "", from: "", to: "" };
      state.page = 1;
      render();
    };
  }
  function orderTable(rows) {
    return rows.length
      ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Commande</th><th>Client</th><th>Total</th><th>Statut</th><th>Paiement</th><th>Actions</th></tr></thead><tbody>${rows.map((o) => `<tr><td><button class="reference-button" data-open-order="${esc(o.id)}">${esc(o.id.slice(0, 11))}</button><small>${date(o.createdAt)}</small><small>${esc(t(o.source || "Site"))}</small></td><td>${protectedText(o.name)}<small data-no-translate>${esc(o.phone)} · ${esc(o.city)}</small></td><td>${money(orderTotal(o))}${o.deliveryFee === null ? "<small>Livraison à confirmer</small>" : ""}</td><td>${badge(o.status)}</td><td>${esc(t(o.payment || "En attente"))}</td><td><button class="admin-icon-btn" data-open-order="${esc(o.id)}" aria-label="Voir les détails">${icon("Eye")}</button></td></tr>`).join("")}</tbody></table></div>`
      : '<div class="admin-empty">' +
          icon("ShoppingBag") +
          "<p>Aucune commande ne correspond à ces filtres.</p></div>";
  }
  function filteredOrders() {
    return filterOrders(state.data.orders, state.filters);
  }
  function orderList() {
    const rows = filteredOrders();
    state.page = Math.min(state.page, Math.max(1, Math.ceil(rows.length / 20)));
    const visible = rows.slice((state.page - 1) * 20, state.page * 20);
    return `<div class="admin-intro"><p>${rows.length} <span>commandes trouvées</span></p><div class="admin-actions"><button class="button outline" id="export-orders">${icon("Download")} Exporter CSV</button><button class="button primary" id="new-order">${icon("Plus")} Nouvelle commande</button></div></div><section class="admin-card"><form id="order-filters" class="admin-filters"><label>Rechercher<input name="query" value="${esc(state.filters.query)}" placeholder="Nom, téléphone, ville ou référence"></label><label>Statut<select name="status"><option value="">Tous les statuts</option>${opt(orderStatuses, state.filters.status)}</select></label><label>Paiement<select name="payment"><option value="">Tous les paiements</option>${opt(paymentStatuses, state.filters.payment)}</select></label><label>Du<input type="date" name="from" value="${state.filters.from}"></label><label>Au<input type="date" name="to" value="${state.filters.to}"></label><button class="button outline">Filtrer</button></form></section><section class="admin-card orders-card">${orderTable(visible)}${pagination(rows.length)}</section>`;
  }
  function pagination(count) {
    const pages = Math.max(1, Math.ceil(count / 20));
    return `<div class="admin-pagination"><button data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>Précédent</button><span>${state.page} / ${pages}</span><button data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>Suivant</button></div>`;
  }
  function bindPagination() {
    app.querySelectorAll("[data-page]").forEach(
      (b) =>
        (b.onclick = () => {
          state.page = Number(b.dataset.page);
          render();
        }),
    );
  }
  function bindOrders() {
    app.querySelector("#order-filters").onsubmit = (e) => {
      e.preventDefault();
      state.filters = Object.fromEntries(new FormData(e.target));
      state.page = 1;
      render();
    };
    app.querySelector("#new-order").onclick = manualOrder;
    app.querySelector("#export-orders").onclick = () =>
      downloadCSV(
        "commandes",
        [
          "Référence",
          "Date",
          "Client",
          "Téléphone",
          "Ville",
          "Adresse",
          "Articles DH",
          "Livraison DH",
          "Total DH",
          "Statut",
          "Paiement",
          "Origine",
          "Suivi",
        ],
        filteredOrders().map((o) => [
          o.id,
          o.createdAt,
          o.name,
          o.phone,
          o.city,
          o.address,
          o.subtotal,
          o.deliveryFee ?? "",
          orderTotal(o),
          t(o.status),
          t(o.payment),
          t(o.source),
          o.tracking,
        ]),
      );
    bindPagination();
  }
  function orderDetail(id) {
    const o = state.data.orders.find((o) => o.id === id);
    if (!o) return;
    dialog(
      `<div class="admin-card-heading"><div><div class="eyebrow">DÉTAIL DE COMMANDE</div><h2 data-no-translate>${esc(o.id.slice(0, 11))}</h2><p>${date(o.createdAt)} · ${t(o.source)}</p></div>${badge(o.status)}</div><div class="admin-actions"><button class="button outline" id="print-order">${icon("Printer")} Bon de commande</button><a class="button outline" href="https://wa.me/${phoneKey(o.phone)}" target="_blank" rel="noopener noreferrer">${icon("Phone")} Contacter le client</a></div><div class="dashboard-columns"><section class="order-contact"><h3>Client</h3><p data-no-translate dir="auto">${esc(o.name)}<br>${esc(o.phone)}<br>${esc(o.city)}<br>${esc(o.address)}</p></section><section><h3>Articles</h3>${o.items.map((i) => `<div class="order-item"><span data-no-translate>${esc(display(i))}<small>${i.size} × ${i.qty}</small></span><b>${money(i.price * i.qty)}</b></div>`).join("")}<div class="order-item"><span>Sous-total</span><b>${money(o.subtotal ?? o.total)}</b></div><div class="order-item"><span>Livraison</span><b>${o.deliveryFee === null ? t("À confirmer") : money(o.deliveryFee)}</b></div><div class="order-item"><strong>Total</strong><strong>${money(orderTotal(o))}</strong></div></section></div><form id="order-edit" class="admin-form"><div class="form-grid"><label>Nom complet<input name="name" required minlength="2" maxlength="100" value="${esc(o.name)}"></label><label>Téléphone<input name="phone" type="tel" required value="${esc(o.phone)}"></label><label>Ville<input name="city" required minlength="3" maxlength="100" value="${esc(o.city)}"></label><label>Adresse de livraison<input name="address" required minlength="3" maxlength="300" value="${esc(o.address)}"></label><label>Statut<select name="status">${opt([o.status, ...({ Nouvelle: ["Confirmée", "Annulée"], Confirmée: ["Expédiée", "Annulée"], Expédiée: ["Livrée", "Retournée"], Livrée: ["Retournée"], Annulée: ["Nouvelle"], Retournée: [] }[o.status] || [])], o.status)}</select></label><label>Paiement<select name="payment">${opt(paymentStatuses, o.payment)}</select></label><label>Frais de livraison (DH)<input name="deliveryFee" type="number" min="0" max="1000" step="0.01" value="${o.deliveryFee ?? ""}" placeholder="À confirmer"></label><label>Transporteur<input name="carrier" maxlength="120" value="${esc(o.carrier)}"></label><label>Référence de suivi<input name="tracking" maxlength="120" value="${esc(o.tracking)}"></label></div><label>Notes internes<textarea name="notes" maxlength="2000">${esc(o.notes)}</textarea></label><p class="form-hint">Le stock est réservé à la confirmation. Une annulation ou un retour enregistré libère le stock réservé.</p><p class="form-error" role="alert"></p><button class="button primary">Enregistrer les modifications</button></form><details class="order-history"><summary>Historique</summary>${o.history.map((h) => `<p>${date(h.date)} · ${esc(t(h.status || h.payment || (h.type === "edited" ? "Coordonnées modifiées" : "Commande créée")))}</p>`).join("")}</details>`,
    );
    overlay.querySelector("#print-order").onclick = () => printOrder(o);
    overlay
      .querySelector("#order-edit [name=city]")
      .addEventListener("change", (e) => {
        const fee = shopDelivery(state.data.settings, e.target.value);
        overlay.querySelector("#order-edit [name=deliveryFee]").value =
          fee ?? "";
      });
    overlay.querySelector("#order-edit").onsubmit = async (e) => {
      e.preventDefault();
      const b = e.target.querySelector(
        "button[type=submit],button:not([type])",
      );
      b.disabled = true;
      dialogBusy = true;
      const data = Object.fromEntries(new FormData(e.target));
      try {
        await mutate({
          action: "order.update",
          order: {
            ...data,
            id: o.id,
            revision: o.revision,
            deliveryFee:
              data.deliveryFee === "" ? null : Number(data.deliveryFee),
          },
        });
        closeDialog(true);
        render();
        toast("Commande enregistrée");
      } catch (error) {
        feedback(error, e.target.querySelector(".form-error"));
        b.disabled = false;
        dialogBusy = false;
      }
    };
  }
  function productList() {
    const q = state.productQuery.toLowerCase();
    const products = state.data.products.filter(
      (p) =>
        (!q ||
          `${p.name} ${p.nameAr} ${p.color} ${p.id}`
            .toLowerCase()
            .includes(q)) &&
        (!state.productFilter || String(p.active) === state.productFilter),
    );
    return `<div class="admin-intro"><p>${state.data.products.length} <span>produits dans votre catalogue</span></p><div class="admin-actions"><button id="export-products" class="button outline">${icon("Download")} Exporter CSV</button><button id="new-product" class="button primary">${icon("Plus")} Ajouter un produit</button></div></div><section class="admin-card"><form id="product-filters" class="admin-filters"><label>Rechercher<input name="query" value="${esc(state.productQuery)}" placeholder="Nom ou couleur"></label><label>Visibilité<select name="active"><option value="">Tous les produits</option><option value="true" ${state.productFilter === "true" ? "selected" : ""}>Actifs</option><option value="false" ${state.productFilter === "false" ? "selected" : ""}>Archivés</option></select></label><button class="button outline">Filtrer</button></form><div class="admin-table-wrap"><table class="admin-table product-admin-table"><thead><tr><th>Produit</th><th>Prix</th><th>Stock disponible</th><th>Visibilité</th><th>Actions</th></tr></thead><tbody>${products
      .slice((state.page - 1) * 20, state.page * 20)
      .map(
        (p) =>
          `<tr><td><div class="admin-product-cell"><img src="${esc(p.images[0])}" width="46" height="60" alt="" loading="lazy"><div><b data-no-translate>${esc(display(p))}</b><small data-no-translate>${esc(display(p, "color"))}</small></div></div></td><td>${money(p.price)}</td><td><div class="stock-pills">${p.sizes.map((s) => `<span class="${p.stock[s] !== null && p.stock[s] <= state.data.settings.lowStockThreshold ? "low" : ""}">${s}: ${p.stock[s] === null ? "—" : p.stock[s]}</span>`).join("")}</div></td><td>${p.active ? t("Actif") : t("Archivé")}</td><td><div class="row-actions"><button class="admin-icon-btn" data-edit-product="${p.id}" aria-label="Modifier">${icon("Pencil")}</button>${p.active ? `<button class="admin-icon-btn" data-archive="${p.id}" aria-label="Archiver">${icon("Archive")}</button>` : ""}</div></td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div>${!products.length ? '<p class="empty">Aucun produit trouvé.</p>' : ""}${pagination(products.length)}</section>`;
  }
  function bindProducts() {
    app.querySelector("#export-products").onclick = () =>
      downloadCSV(
        "produits",
        [
          "Produit",
          "Nom arabe",
          "Prix",
          "Couleur",
          "Catégorie",
          "Visibilité",
          ...sizeOptions.map((s) => "Stock " + s),
        ],
        state.data.products.map((p) => [
          p.name,
          p.nameAr,
          p.price,
          p.color,
          p.category,
          p.active ? "Actif" : "Archivé",
          ...sizeOptions.map((s) => p.stock[s] ?? ""),
        ]),
      );
    app.querySelector("#new-product").onclick = () => productForm();
    app.querySelector("#product-filters").onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      state.productQuery = data.query;
      state.productFilter = data.active;
      state.page = 1;
      render();
    };
    app.querySelectorAll("[data-archive]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (
            !confirm(
              t(
                "Archiver ce produit ? Il ne sera plus visible dans la boutique.",
              ),
            )
          )
            return;
          const p = state.data.products.find((p) => p.id === b.dataset.archive);
          try {
            await mutate({
              action: "product.archive",
              id: p.id,
              revision: p.revision,
            });
            state.page = 1;
            render();
            toast("Produit archivé");
          } catch (error) {
            feedback(error);
          }
        }),
    );
    bindPagination();
  }
  function productForm(id) {
    const original = state.data.products.find((p) => p.id === id);
    const p = original || {
      name: "",
      nameAr: "",
      subtitle: "",
      subtitleAr: "",
      color: "",
      colorAr: "",
      category: "Satin",
      price: 250,
      swatch: "#c08b9a",
      tag: "Essentiel",
      active: true,
      sizes: [...sizeOptions],
      stock: { S: null, M: null, L: null, XL: null },
      images: [],
    };
    let images = [...p.images];
    dialog(
      `<div class="eyebrow">CATALOGUE</div><h2>${original ? "Modifier le produit" : "Ajouter un produit"}</h2><form id="product-editor" class="admin-form"><div class="form-grid"><label>Nom français<input name="name" maxlength="80" minlength="2" required value="${esc(p.name)}"></label><label>Nom arabe<input name="nameAr" maxlength="100" minlength="2" required dir="rtl" value="${esc(p.nameAr)}"></label><label>Couleur française<input name="color" maxlength="80" value="${esc(p.color)}"></label><label>Couleur arabe<input name="colorAr" maxlength="100" dir="rtl" value="${esc(p.colorAr)}"></label><label>Prix (DH)<input name="price" type="number" min="200" max="350" step="0.01" required value="${p.price}"></label><label>Catégorie<select name="category">${opt(["Satin", "Fleuri", "Rayé", "Imprimé"], p.category)}</select></label><label>Pastille couleur<input name="swatch" type="color" value="${p.swatch}"></label><label>Étiquette<select name="tag">${opt(["Essentiel", "Coup de cœur", "Douceur florale", "Fleuri", "Élégance", "Douceur", "Fraîcheur", "Dentelle", "Rayures", "Imprimé", "Ensemble", "Lumineux"], p.tag)}</select></label><label>Description française<textarea name="subtitle" maxlength="500">${esc(p.subtitle)}</textarea></label><label>Description arabe<textarea name="subtitleAr" maxlength="500" dir="rtl">${esc(p.subtitleAr)}</textarea></label></div><label class="check-row"><input type="checkbox" name="active" ${p.active ? "checked" : ""}> Visible dans la boutique</label><h3>Tailles & stock disponible</h3><p class="form-hint">Laissez le stock vide pour une taille non suivie. Zéro signifie rupture de stock.</p><div class="size-stock-grid">${sizeOptions.map((s) => `<div><label class="check-row"><input name="size-${s}" type="checkbox" ${p.sizes.includes(s) ? "checked" : ""}>${s}</label><input name="stock-${s}" aria-label="Stock ${s}" type="number" min="0" max="100000" step="1" placeholder="Non suivi" value="${p.stock[s] ?? ""}"></div>`).join("")}</div><h3>Photos du produit</h3><p class="form-hint">Les photos sont conservées sans retouche. JPEG, PNG ou WebP, 3 Mo maximum, 8 photos par produit.</p><div id="product-photos" class="photo-manager"></div><label class="upload-label">${icon("Upload")} Ajouter des photos<input id="image-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><p id="upload-feedback" class="form-hint" role="status"></p><p class="form-error" role="alert"></p><button class="button primary" type="submit">Enregistrer le produit</button></form>`,
    );
    const form = overlay.querySelector("#product-editor");
    const saveButton = form.querySelector("[type=submit]");
    const upload = overlay.querySelector("#image-upload");
    function renderPhotos() {
      overlay.querySelector("#product-photos").innerHTML = localize(
        images
          .map(
            (url, i) =>
              `<div><img src="${esc(url)}" alt="" width="90" height="115"><button type="button" data-cover="${i}" ${i === 0 ? "disabled" : ""}>${i === 0 ? "Couverture" : "Définir couverture"}</button><button type="button" data-remove-image="${i}" aria-label="Retirer la photo">${icon("X")}</button></div>`,
          )
          .join(""),
      );
      icons();
      overlay.querySelectorAll("[data-cover]").forEach(
        (b) =>
          (b.onclick = () => {
            const [image] = images.splice(Number(b.dataset.cover), 1);
            images.unshift(image);
            dialogDirty = true;
            renderPhotos();
          }),
      );
      overlay.querySelectorAll("[data-remove-image]").forEach(
        (b) =>
          (b.onclick = () => {
            images.splice(Number(b.dataset.removeImage), 1);
            dialogDirty = true;
            renderPhotos();
          }),
      );
    }
    renderPhotos();
    upload.onchange = async () => {
      const files = [...upload.files];
      const msg = overlay.querySelector("#upload-feedback");
      if (files.length + images.length > 8) {
        msg.textContent = t("Maximum 8 photos.");
        return;
      }
      saveButton.disabled = true;
      upload.disabled = true;
      dialogBusy = true;
      try {
        for (const file of files) {
          if (file.size > 3 * 1024 * 1024) throw Error("Photo limitée à 3 Mo.");
          const localURL = URL.createObjectURL(file);
          try {
            const image = new window.Image();
            image.src = localURL;
            await image.decode();
          } catch {
            throw Error("Format photo invalide. JPEG, PNG ou WebP uniquement.");
          } finally {
            URL.revokeObjectURL(localURL);
          }
          msg.textContent = t("Envoi en cours…");
          const r = await fetch("/.netlify/functions/media", {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          const data = await r.json();
          if (!r.ok)
            throw Error(data.error || "Envoi de photo impossible. Réessayez.");
          images.push(data.url);
          dialogDirty = true;
          renderPhotos();
        }
        msg.textContent = t("Photos ajoutées");
      } catch (error) {
        msg.textContent = errorText(error.message);
      } finally {
        saveButton.disabled = false;
        upload.disabled = false;
        dialogBusy = false;
        upload.value = "";
      }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      saveButton.disabled = true;
      dialogBusy = true;
      const data = Object.fromEntries(new FormData(form));
      const product = {
        ...p,
        ...data,
        price: Number(data.price),
        active: form.elements.active.checked,
        images,
        sizes: sizeOptions.filter((s) => form.elements["size-" + s].checked),
        stock: Object.fromEntries(
          sizeOptions.map((s) => [
            s,
            data["stock-" + s] === "" ? null : Number(data["stock-" + s]),
          ]),
        ),
      };
      try {
        await mutate({ action: "product.save", product });
        closeDialog(true);
        render();
        toast("Produit enregistré");
      } catch (error) {
        feedback(error, form.querySelector(".form-error"));
        saveButton.disabled = false;
        dialogBusy = false;
      }
    };
  }
  function customerList() {
    const q = state.customerQuery.toLowerCase();
    const customers = customersFrom(state.data.orders).filter((c) =>
      `${c.name} ${c.phone} ${c.city}`.toLowerCase().includes(q),
    );
    return `<div class="admin-intro"><p>${customers.length} <span>clients ayant passé commande</span></p><button class="button outline" id="export-customers">${icon("Download")} Exporter CSV</button></div><section class="admin-card"><form id="customer-search" class="admin-filters"><label>Rechercher<input name="query" placeholder="Nom, téléphone ou ville" value="${esc(state.customerQuery)}"></label><button class="button outline">Filtrer</button></form><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Client</th><th>Ville</th><th>Commandes</th><th>Encaissements déclarés</th><th>Dernière commande</th><th>Actions</th></tr></thead><tbody>${customers
      .slice((state.page - 1) * 20, state.page * 20)
      .map(
        (c) =>
          `<tr><td>${protectedText(c.name)}<small data-no-translate>${esc(c.phone)}</small></td><td data-no-translate>${esc(c.city)}</td><td>${c.orders.length}</td><td>${money(c.paid)}</td><td>${date(c.last)}</td><td><button class="admin-icon-btn" data-customer="${c.key}" aria-label="Voir les commandes">${icon("Eye")}</button></td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div>${!customers.length ? '<p class="empty">Aucun client trouvé.</p>' : ""}${pagination(customers.length)}</section>`;
  }
  function bindCustomers() {
    app.querySelector("#customer-search").onsubmit = (e) => {
      e.preventDefault();
      state.customerQuery = new FormData(e.target).get("query");
      state.page = 1;
      render();
    };
    app.querySelectorAll("[data-customer]").forEach(
      (b) =>
        (b.onclick = () => {
          const c = customersFrom(state.data.orders).find(
            (c) => c.key === b.dataset.customer,
          );
          dialog(
            `<h2 data-no-translate>${esc(c.name)}</h2><p data-no-translate>${esc(c.phone)} · ${esc(c.city)}</p>${orderTable(c.orders)}`,
          );
          overlay.querySelectorAll("[data-open-order]").forEach(
            (b) =>
              (b.onclick = () => {
                dialogDirty = false;
                orderDetail(b.dataset.openOrder);
              }),
          );
        }),
    );
    app.querySelector("#export-customers").onclick = () =>
      downloadCSV(
        "clients",
        [
          "Client",
          "Téléphone",
          "Ville",
          "Commandes",
          "Livrées",
          "Encaissements DH",
          "Dernière commande",
        ],
        customersFrom(state.data.orders)
          .filter((c) =>
            `${c.name} ${c.phone} ${c.city}`
              .toLowerCase()
              .includes(state.customerQuery.toLowerCase()),
          )
          .map((c) => [
            c.name,
            c.phone,
            c.city,
            c.orders.length,
            c.delivered,
            c.paid,
            c.last,
          ]),
      );
    bindPagination();
  }
  function settingsView() {
    const s = state.data.settings;
    return `<form id="shop-settings" class="admin-form"><section class="admin-card"><h2>Identité & contact</h2><div class="form-grid"><label>Nom français<input name="name" required minlength="2" maxlength="80" value="${esc(s.name)}"></label><label>Nom arabe<input name="nameAr" required minlength="2" maxlength="100" dir="rtl" value="${esc(s.nameAr)}"></label><label>WhatsApp international<input name="whatsapp" required pattern="212[5-7][0-9]{8}" dir="ltr" value="${s.whatsapp}"></label><label>Email de contact<input name="email" type="email" value="${esc(s.email)}"></label><label>Annonce française<textarea name="banner" maxlength="200">${esc(s.banner)}</textarea></label><label>Annonce arabe<textarea name="bannerAr" maxlength="200" dir="rtl">${esc(s.bannerAr)}</textarea></label></div></section><section class="admin-card"><h2>Livraison & commandes</h2><div class="form-grid"><label>Frais par défaut (DH)<input name="deliveryFee" type="number" min="0" max="1000" step="0.01" value="${s.deliveryFee ?? ""}" placeholder="À confirmer"></label><label>Seuil d’alerte stock<input name="lowStockThreshold" type="number" min="0" max="1000" step="1" required value="${s.lowStockThreshold}"></label><label>Texte livraison français<textarea name="deliveryNote" maxlength="500">${esc(s.deliveryNote)}</textarea></label><label>Texte livraison arabe<textarea name="deliveryNoteAr" maxlength="500" dir="rtl">${esc(s.deliveryNoteAr)}</textarea></label></div><label class="check-row"><input name="ordersOpen" type="checkbox" ${s.ordersOpen ? "checked" : ""}> Accepter les demandes en ligne</label><p class="form-hint">ORDERS_ENABLED=true est également nécessaire dans Netlify. Le paiement reste à la livraison.</p><h3>Tarifs par ville</h3><div id="city-fees">${s.deliveryCities.map((row, i) => cityRow(row, i)).join("")}</div><button type="button" id="add-city" class="button outline">${icon("Plus")} Ajouter une ville</button></section><section class="admin-card"><h2>Accès & données</h2><p>Les identifiants restent configurés dans les variables serveur Netlify : ADMIN_EMAIL, ADMIN_PASSWORD et ADMIN_SESSION_SECRET. Aucun mot de passe n’est enregistré ici.</p><button type="button" id="download-backup" class="button outline">${icon("Download")} Télécharger la sauvegarde JSON</button><p>Les données clients et commandes sont privées. Les tarifs et produits actifs sont accessibles à la boutique.</p><p>Les stocks vides ne sont pas suivis ; les confirmations de commandes réservent les quantités renseignées.</p></section><p class="form-error" role="alert"></p><button class="button primary">Enregistrer les paramètres</button></form>`;
  }
  function cityRow(row = {}, i = 0) {
    return `<div class="city-fee-row"><label>Ville<input data-city-name maxlength="100" minlength="2" required value="${esc(row.city || "")}"></label><label>Frais (DH)<input data-city-fee type="number" min="0" max="1000" step="0.01" required value="${row.fee ?? ""}"></label><button type="button" data-remove-city class="admin-icon-btn" aria-label="Retirer">${icon("X")}</button></div>`;
  }
  function bindSettings() {
    app.querySelector("#download-backup").onclick = () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(state.data, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "tazi-sauvegarde-" + shopDateKey(new Date()) + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const form = app.querySelector("#shop-settings");
    form.oninput = () => (settingsDirty = true);
    const remove = () =>
      form.querySelectorAll("[data-remove-city]").forEach(
        (b) =>
          (b.onclick = () => {
            b.closest(".city-fee-row").remove();
            settingsDirty = true;
          }),
      );
    remove();
    form.querySelector("#add-city").onclick = () => {
      form
        .querySelector("#city-fees")
        .insertAdjacentHTML("beforeend", localize(cityRow()));
      settingsDirty = true;
      remove();
      icons();
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const b = form.querySelector("button:not([type]),button[type=submit]");
      b.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      try {
        await mutate({
          action: "settings.save",
          revision: state.data.settingsRevision,
          settings: {
            ...data,
            deliveryFee:
              data.deliveryFee === "" ? null : Number(data.deliveryFee),
            lowStockThreshold: Number(data.lowStockThreshold),
            ordersOpen: form.elements.ordersOpen.checked,
            deliveryCities: [...form.querySelectorAll(".city-fee-row")].map(
              (row) => ({
                city: row.querySelector("[data-city-name]").value,
                fee: Number(row.querySelector("[data-city-fee]").value),
              }),
            ),
          },
        });
        settingsDirty = false;
        render();
        toast("Paramètres enregistrés");
      } catch (error) {
        feedback(error, form.querySelector(".form-error"));
        b.disabled = false;
        dialogBusy = false;
      }
    };
  }
  function manualOrder() {
    const draftId = "TZ-" + crypto.randomUUID();
    let rows = 0;
    dialog(
      `<div class="eyebrow">COMMANDES</div><h2>Nouvelle commande</h2><form id="manual-order" class="admin-form"><div class="form-grid"><label>Nom complet<input name="name" required minlength="2" maxlength="100"></label><label>Téléphone<input name="phone" type="tel" required></label><label>Ville<input name="city" required minlength="3" maxlength="100"></label><label>Origine<select name="source">${opt(["Manuelle", "WhatsApp"], "WhatsApp")}</select></label></div><label>Adresse de livraison<textarea name="address" required minlength="3" maxlength="300"></textarea></label><div id="manual-items"></div><button type="button" id="add-line" class="button outline">${icon("Plus")} Ajouter un article</button><div id="manual-summary" class="checkout-estimate" aria-live="polite"></div><p class="form-hint">Les prix et frais de livraison sont calculés depuis les paramètres actuels. La commande reste à confirmer.</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">Créer la commande</button></form>`,
    );
    const form = overlay.querySelector("#manual-order");
    form.addEventListener("input", () => (dialogDirty = true));
    const active = state.data.products.filter((p) => p.active);
    function quote() {
      const subtotal = [...form.querySelectorAll(".manual-item")].reduce(
        (n, row) => {
          const p = active.find(
            (p) => p.id === row.querySelector("[data-manual-product]").value,
          );
          return (
            n +
            (p?.price || 0) *
              (Number(row.querySelector("[data-manual-qty]").value) || 0)
          );
        },
        0,
      );
      const fee = shopDelivery(state.data.settings, form.elements.city.value);
      form.querySelector("#manual-summary").innerHTML = localize(
        `<p><span>Sous-total</span><b>${money(subtotal)}</b></p><p><span>Livraison</span><b>${fee === null ? t("À confirmer") : money(fee)}</b></p><p><strong>Total estimé</strong><b>${money(subtotal + (fee ?? 0))}</b></p>`,
      );
    }
    form.addEventListener("input", quote);
    function add() {
      if (rows >= 100) return;
      rows++;
      const node = document.createElement("div");
      node.className = "manual-item";
      node.innerHTML = localize(
        `<label>Produit<select data-manual-product>${active.map((p) => `<option data-no-translate value="${p.id}">${esc(display(p))} · ${money(p.price)}</option>`).join("")}</select></label><label>Choisir votre taille<select data-manual-size></select></label><label>Quantité<input data-manual-qty type="number" min="1" max="5" value="1" required></label><button class="admin-icon-btn" type="button" data-remove-line aria-label="Retirer">${icon("X")}</button>`,
      );
      form.querySelector("#manual-items").append(node);
      const select = node.querySelector("[data-manual-product]");
      const update = () => {
        const p = active.find((p) => p.id === select.value);
        node.querySelector("[data-manual-size]").innerHTML = (p?.sizes || [])
          .map((s) => `<option>${s}</option>`)
          .join("");
      };
      select.onchange = () => {
        update();
        quote();
      };
      node.querySelector("[data-remove-line]").onclick = () => {
        node.remove();
        rows--;
        quote();
      };
      update();
      quote();
      icons();
    }
    add();
    form.querySelector("#add-line").onclick = add;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const b = form.querySelector("[type=submit]");
      b.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      try {
        await mutate({
          action: "order.create",
          id: draftId,
          source: data.source,
          order: {
            ...data,
            items: [...form.querySelectorAll(".manual-item")].map((row) => ({
              id: row.querySelector("[data-manual-product]").value,
              size: row.querySelector("[data-manual-size]").value,
              qty: Number(row.querySelector("[data-manual-qty]").value),
            })),
          },
        });
        closeDialog(true);
        state.view = "orders";
        render();
        toast("Commande créée");
      } catch (error) {
        feedback(error, form.querySelector(".form-error"));
        b.disabled = false;
        dialogBusy = false;
      }
    };
  }
  function downloadCSV(name, headers, rows) {
    const url = URL.createObjectURL(
      new Blob([csv(headers.map(t), rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `tazi-${name}-${shopDateKey(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function printOrder(o) {
    const win = window.open("", "_blank");
    if (!win) {
      toast("Autorisez la fenêtre d’impression.");
      return;
    }
    win.opener = null;
    win.document.write(
      `<!doctype html><html lang="${getLanguage()}" dir="${getLanguage() === "ar" ? "rtl" : "ltr"}"><head><meta charset="UTF-8"><title>${esc(o.id)}</title><style>body{font:14px Arial,sans-serif;padding:35px;color:#302621}h1{font-size:25px}table{width:100%;border-collapse:collapse;margin:25px 0}th,td{text-align:start;padding:12px;border-bottom:1px solid #ddd}small{color:#777}img{width:150px}h2{font-size:18px}@media print{body{padding:10px}}</style></head><body><img src="${location.origin}/images/tazi-logo.webp" alt="Tazi Pyjamas"><h1>${esc(t("Bon de commande"))}</h1><p>${esc(o.id)} · ${date(o.createdAt)}</p><p>${esc(o.name)}<br>${esc(o.phone)}<br>${esc(o.address)} · ${esc(o.city)}</p><table><thead><tr><th>${esc(t("Produit"))}</th><th>${esc(t("Quantité"))}</th><th>${esc(t("Total"))}</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(display(i))} / ${i.size}</td><td>${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`).join("")}</tbody></table><h2>${esc(t("Total"))} : ${money(orderTotal(o))}</h2><p>${esc(t("Livraison"))} : ${o.deliveryFee === null ? t("À confirmer") : money(o.deliveryFee)}</p><p>${esc(t(o.payment))} · ${esc(t("Paiement à la livraison"))}</p><small>${esc(t("Bon de commande — ne constitue pas une facture fiscale."))}</small></body></html>`,
    );
    win.addEventListener("load", () => win.print(), { once: true });
    win.document.close();
  }
  renderLogin();
  fetch("/.netlify/functions/admin-auth")
    .then((r) => {
      if (r.ok) return refresh();
    })
    .catch((e) => feedback(e));
  timer = setInterval(async () => {
    if (!state.data) return;
    try {
      const r = await fetch("/.netlify/functions/admin-auth");
      if (r.status === 401) {
        state.data = null;
        settingsDirty = false;
        closeDialog(true);
        renderLogin();
      }
    } catch {}
  }, 240000);
  dispose = () => {
    clearInterval(timer);
    document.removeEventListener("keydown", keydown);
    closeDialog(true);
  };
}
