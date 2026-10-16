(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---------- أساسيات ---------- */
  var CFG = window.STORE_CONFIG, DEFAULTS = window.DEFAULT_PRODUCTS, makePH = window.makePlaceholder;
  var KEYS = { products: "ke_products_v1", cart: "ke_cart_v1", settings: "ke_settings_v1" };
  var ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  var MAX_QTY = 20;
  var PH = makePH("tee", "#bdbdbd", "بدون صورة");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  var safeHex = function (h) { return /^#[0-9a-f]{6}$/i.test(h) ? h : "#111111"; };
  var num = function (v, d) { var n = Number(v); return v !== null && v !== "" && isFinite(n) && n >= 0 ? n : (d === undefined ? 0 : d); };
  var fmt = function (n) { return new Intl.NumberFormat("ar-EG").format(Math.round(n * 100) / 100) + " " + CFG.CURRENCY; };
  var norm = function (s) { return String(s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"); };

  /* إنشاء عناصر DOM بأمان (textContent فقط — لا innerHTML لأي محتوى مستخدم) */
  function el(tag, props) {
    var n = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") Object.assign(n.style, v);
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) return add(c);
        n.append(c.nodeType ? c : String(c));
      });
    })(kids);
    return n;
  }

  /* ---------- التخزين المحلي ---------- */
  function load(key, fallback) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; } }
  function save(key, val) {
    try { var s = JSON.stringify(val); if (s.length > 4200000) throw new Error("size"); localStorage.setItem(key, s); return true; }
    catch (e) { return false; }
  }
  function toast(msg, type) {
    var t = el("div", { class: "toast " + (type || "ok"), text: msg });
    $("#toasts").append(t);
    setTimeout(function () { t.remove(); }, 4200);
  }
  function setMsg(node, text, type) { node.textContent = text; node.className = "msg" + (type ? " " + type : ""); }

  /* ---------- البيانات ---------- */
  function normProduct(p) {
    if (!p || typeof p !== "object" || !p.id) return null;
    var price = num(p.price), dp = (p.discountPrice === null || p.discountPrice === undefined || p.discountPrice === "") ? null : num(p.discountPrice, null);
    if (dp !== null && (dp <= 0 || dp >= price)) dp = null;
    return {
      id: String(p.id), name: String(p.name || "منتج").slice(0, 100), description: String(p.description || "").slice(0, 500),
      category: String(p.category || ""), price: price, discountPrice: dp,
      images: Array.isArray(p.images) ? p.images.filter(function (s) { return typeof s === "string" && /^data:image\//.test(s); }).slice(0, 4) : [],
      sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes.map(function (s) { return String(s).slice(0, 20); }) : ["مقاس واحد"],
      colors: Array.isArray(p.colors) && p.colors.length ? p.colors.map(function (c) { return { name: String((c && c.name) || "لون").slice(0, 30), hex: safeHex(c && c.hex) }; }) : [{ name: "أسود", hex: "#111111" }],
      stock: Math.floor(num(p.stock)), customPrint: !!p.customPrint, published: p.published !== false,
      featured: !!p.featured, bestSeller: !!p.bestSeller, createdAt: Number(p.createdAt) || Date.now()
    };
  }
  function loadProducts() {
    var raw = load(KEYS.products, null);
    if (Array.isArray(raw)) return raw.map(normProduct).filter(Boolean);
    return clone(DEFAULTS).map(normProduct).filter(Boolean);
  }
  function loadSettings() {
    var s = load(KEYS.settings, {}) || {};
    var cats = Array.isArray(s.categories) ? s.categories.map(function (c) { return String(c).trim(); }).filter(Boolean).slice(0, 20) : null;
    return { deliveryFee: num(s.deliveryFee, CFG.DELIVERY_FEE), freeFrom: num(s.freeFrom, CFG.FREE_DELIVERY_FROM), categories: cats && cats.length ? cats : CFG.CATEGORIES.slice() };
  }
  var products = loadProducts();
  var settings = loadSettings();
  var effPrice = function (p) { return p.discountPrice !== null ? p.discountPrice : p.price; };
  var visible = function () { return products.filter(function (p) { return p.published; }); };
  var allCategories = function () {
    var l = settings.categories.slice();
    products.forEach(function (p) { if (p.category && l.indexOf(p.category) < 0) l.push(p.category); });
    return l;
  };

  /* ---------- السلة ---------- */
  function normItem(i) {
    if (!i || typeof i !== "object") return null;
    var qty = Math.floor(num(i.qty));
    if (qty < 1 || qty > 99) return null;
    var base = { id: String(i.id || uid()), qty: qty, size: String(i.size || "").slice(0, 20), colorName: String(i.colorName || "").slice(0, 30), colorHex: safeHex(i.colorHex), name: String(i.name || "منتج").slice(0, 100) };
    if (i.type === "custom") {
      var d = i.design || {};
      if (typeof d.src !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(d.src)) return null;
      return Object.assign(base, { type: "custom", side: i.side === "back" ? "back" : "front", design: { src: d.src, left: num(d.left), top: num(d.top), width: num(d.width, 0.5), cx: num(d.cx, 0.5), cy: num(d.cy, 0.5), fileName: String(d.fileName || "").replace(/[\u0000-\u001f]/g, "").slice(0, 60) } });
    }
    if (!i.productId) return null;
    return Object.assign(base, { type: "product", productId: String(i.productId) });
  }
  var cart = (function () { var r = load(KEYS.cart, []); return Array.isArray(r) ? r.map(normItem).filter(Boolean) : []; })();
  function persistCart() { return save(KEYS.cart, cart); }

  function lineInfo(item) {
    if (item.type === "custom") return { name: "تيشيرت بتصميمك", unit: CFG.CUSTOM_TEE_PRICE, img: null, ok: true, max: MAX_QTY };
    var p = products.find(function (x) { return x.id === item.productId; });
    if (!p || !p.published) return null;
    return { name: p.name, unit: effPrice(p), img: p.images[0] || PH, ok: p.stock > 0, max: Math.min(p.stock, MAX_QTY), stock: p.stock };
  }
  function syncCart() {
    var changed = false;
    cart = cart.filter(function (i) { if (i.type === "custom") return true; var keep = products.some(function (p) { return p.id === i.productId; }); if (!keep) changed = true; return keep; });
    cart.forEach(function (i) { var l = lineInfo(i); if (l && l.ok && i.qty > l.max) { i.qty = l.max; changed = true; } });
    if (changed) persistCart();
  }
  function totals() {
    var sub = cart.reduce(function (s, i) { var l = lineInfo(i); return s + (l && l.ok ? l.unit * i.qty : 0); }, 0);
    var delivery = !cart.length ? 0 : (settings.freeFrom > 0 && sub >= settings.freeFrom ? 0 : settings.deliveryFee);
    return { sub: sub, delivery: delivery, total: sub + delivery };
  }
  function cartIssue() {
    for (var k = 0; k < cart.length; k++) { var l = lineInfo(cart[k]); if (!l || !l.ok) return "بعض المنتجات غير متاحة حاليًا. احذفها من السلة لإكمال الطلب."; }
    return "";
  }
  function addToCart(o) {
    var p = products.find(function (x) { return x.id === o.productId && x.published; });
    var qty = Math.floor(Number(o.qty));
    if (!p || !(qty >= 1)) { toast("تعذر إضافة المنتج", "err"); return false; }
    var color = p.colors.find(function (c) { return c.name === o.colorName; });
    if (p.sizes.indexOf(o.size) < 0 || !color) { toast("اختر المقاس واللون", "err"); return false; }
    var ex = cart.find(function (i) { return i.type === "product" && i.productId === p.id && i.size === o.size && i.colorName === color.name; });
    var total = (ex ? ex.qty : 0) + qty;
    if (total > Math.min(p.stock, MAX_QTY)) { toast("الكمية المتاحة من هذا المنتج: " + Math.min(p.stock, MAX_QTY), "err"); return false; }
    var backup = clone(cart);
    if (ex) ex.qty = total;
    else cart.push({ id: uid(), type: "product", productId: p.id, name: p.name, size: o.size, colorName: color.name, colorHex: color.hex, qty: qty });
    if (!persistCart()) { cart = backup; toast("تعذر حفظ السلة: مساحة التخزين ممتلئة", "err"); return false; }
    renderCart(); bumpCart(); toast("تمت الإضافة إلى السلة");
    return true;
  }
  function bumpCart() { var c = $("#cartCount"); c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }

  /* ---------- مكوّنات واجهة ---------- */
  function choices(label, items, selected, onPick) {
    var wrap = el("div", { class: "choices", role: "group", "aria-label": label }), refs = [];
    items.forEach(function (it) {
      var b = el("button", {
        type: "button", class: it.swatch ? "swatch" : "chip", "aria-pressed": String(it.key === selected), title: it.label, "aria-label": it.label,
        onclick: function () { onPick(it.key); refs.forEach(function (r) { r.b.setAttribute("aria-pressed", String(r.key === it.key)); }); }
      }, it.swatch ? el("span", { style: { background: safeHex(it.swatch) } }) : it.label);
      refs.push({ b: b, key: it.key }); wrap.append(b);
    });
    return wrap;
  }
  function stepper(initial, min, max, onChange) {
    var v = initial;
    var inp = el("input", { type: "number", min: min, max: max, value: v, inputmode: "numeric", "aria-label": "الكمية", class: "qty-input" });
    function set(n) { n = Math.floor(Number(n)); if (!isFinite(n)) n = min; n = Math.min(max, Math.max(min, n)); v = n; inp.value = n; onChange(n); }
    inp.addEventListener("change", function () { set(inp.value); });
    return el("div", { class: "stepper" },
      el("button", { type: "button", "aria-label": "إنقاص الكمية", text: "−", onclick: function () { set(v - 1); } }), inp,
      el("button", { type: "button", "aria-label": "زيادة الكمية", text: "+", onclick: function () { set(v + 1); } }));
  }
  function priceEl(p) {
    return el("div", { class: "price" }, el("strong", { text: fmt(effPrice(p)) }), p.discountPrice !== null ? el("del", { text: fmt(p.price) }) : null);
  }
  function openDialog(d) { if (!d.open) d.showModal(); syncLock(); }
  function syncLock() { document.body.classList.toggle("lock", !!$("dialog[open]") || $("#cartDrawer").classList.contains("open")); }
  function confirmBox(msg, okLabel) {
    return new Promise(function (res) {
      var d = $("#confirmDialog");
      $("#confirmMsg").textContent = msg; $("#confirmOk").textContent = okLabel || "تأكيد"; d.returnValue = "cancel";
      d.addEventListener("close", function () { res(d.returnValue === "ok"); }, { once: true });
      openDialog(d);
    });
  }

  /* ---------- بطاقات المنتجات ---------- */
  function productCard(p) {
    var off = p.discountPrice !== null ? Math.round((1 - p.discountPrice / p.price) * 100) : 0;
    return el("article", { class: "card" },
      el("button", { class: "card-media", type: "button", "aria-label": "عرض " + p.name, onclick: function () { openProduct(p.id); } },
        el("img", { src: p.images[0] || PH, alt: p.name, loading: "lazy" }),
        p.stock <= 0 ? el("span", { class: "badge", text: "نفدت الكمية" }) : (off ? el("span", { class: "badge off", text: "خصم " + off + "%" }) : null)),
      el("div", { class: "card-body" },
        el("span", { class: "card-cat", text: p.category }), el("h3", { class: "card-title", text: p.name }), priceEl(p),
        el("button", { class: "btn btn-sm", type: "button", text: p.stock > 0 ? "اختر وأضف" : "التفاصيل", onclick: function () { openProduct(p.id); } })));
  }
  function fillGrid(target, list, emptyMsg) {
    target.replaceChildren();
    if (!list.length) { target.append(el("p", { class: "empty", text: emptyMsg })); return; }
    list.forEach(function (p) { target.append(productCard(p)); });
  }
  var byNew = function (a, b) { return b.createdAt - a.createdAt; };
  function renderHome() {
    var v = visible();
    fillGrid($("#featuredGrid"), v.filter(function (p) { return p.featured; }).sort(byNew).slice(0, 8), "لا توجد منتجات مميزة حاليًا.");
    fillGrid($("#newGrid"), v.slice().sort(byNew).slice(0, 4), "لا توجد منتجات جديدة.");
    fillGrid($("#bestGrid"), v.filter(function (p) { return p.bestSeller; }).sort(byNew).slice(0, 4), "لا توجد منتجات في هذا القسم حاليًا.");
    var tiles = $("#categoryTiles"); tiles.replaceChildren();
    allCategories().forEach(function (c) {
      var n = v.filter(function (p) { return p.category === c; }).length;
      tiles.append(el("button", { class: "tile", type: "button", onclick: function () { shop.cat = c; shop.q = ""; $("#shopSearch").value = ""; renderShop(); $("#shop").scrollIntoView(); } }, c, el("small", { text: n + " منتج" })));
    });
  }

  /* ---------- المتجر: بحث وفلترة وترتيب ---------- */
  var shop = { q: "", cat: "", sort: "newest" };
  function renderShop() {
    var chips = $("#shopChips"); chips.replaceChildren();
    [""].concat(allCategories()).forEach(function (c) {
      chips.append(el("button", { type: "button", class: "chip", "aria-pressed": String(shop.cat === c), text: c || "الكل", onclick: function () { shop.cat = c; renderShop(); } }));
    });
    var l = visible();
    if (shop.cat) l = l.filter(function (p) { return p.category === shop.cat; });
    var q = norm(shop.q.trim());
    if (q) l = l.filter(function (p) { return norm(p.name + " " + p.description + " " + p.category).indexOf(q) >= 0; });
    l.sort(function (a, b) {
      if (shop.sort === "price-asc") return effPrice(a) - effPrice(b);
      if (shop.sort === "price-desc") return effPrice(b) - effPrice(a);
      if (shop.sort === "featured") return (b.featured - a.featured) || byNew(a, b);
      return byNew(a, b);
    });
    $("#shopCount").textContent = l.length + " منتج";
    fillGrid($("#shopGrid"), l, "لا توجد نتائج مطابقة. جرّب كلمة بحث أخرى أو قسمًا مختلفًا.");
  }

  /* ---------- نافذة المنتج ---------- */
  var pm = { id: null, size: null, color: null, qty: 1 };
  function openProduct(id) {
    var p = products.find(function (x) { return x.id === id && x.published; });
    if (!p) return;
    pm = { id: id, size: p.sizes[0], color: p.colors[0].name, qty: 1 };
    renderProduct(p);
    openDialog($("#productDialog"));
    $("#productDialog").scrollTop = 0;
  }
  function renderProduct(p) {
    var body = $("#productBody"); body.replaceChildren();
    var imgs = p.images.length ? p.images : [PH];
    var main = el("img", { class: "pm-main", src: imgs[0], alt: p.name });
    var thumbs = el("div", { class: "pm-thumbs" });
    if (imgs.length > 1) imgs.forEach(function (s, i) {
      thumbs.append(el("button", { type: "button", class: "pm-thumb", "aria-label": "صورة " + (i + 1), "aria-pressed": String(i === 0), onclick: function (e) {
        main.src = s; $$(".pm-thumb", thumbs).forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); e.currentTarget.setAttribute("aria-pressed", "true");
      } }, el("img", { src: s, alt: "" })));
    });
    var inStock = p.stock > 0;
    var stockEl = el("p", { class: "stock " + (!inStock ? "out" : p.stock <= 5 ? "low" : ""), text: !inStock ? "نفدت الكمية حاليًا" : p.stock <= 5 ? "متبقي " + p.stock + " فقط" : "متوفر" });
    var info = el("div", { class: "pm-info" },
      el("span", { class: "card-cat", text: p.category }), el("h2", { text: p.name }), priceEl(p), stockEl,
      el("p", { text: p.description }),
      el("div", { class: "field" }, el("span", { class: "lbl", text: "اللون" }), choices("اللون", p.colors.map(function (c) { return { key: c.name, label: c.name, swatch: c.hex }; }), pm.color, function (k) { pm.color = k; })),
      el("div", { class: "field" }, el("span", { class: "lbl", text: "المقاس" }), choices("المقاس", p.sizes.map(function (s) { return { key: s, label: s }; }), pm.size, function (k) { pm.size = k; })),
      inStock ? el("div", { class: "field" }, el("span", { class: "lbl", text: "الكمية" }), stepper(1, 1, Math.min(p.stock, MAX_QTY), function (n) { pm.qty = n; })) : null,
      el("button", { class: "btn btn-block", type: "button", disabled: !inStock, text: inStock ? "أضف إلى السلة" : "غير متاح", onclick: function () { addToCart({ productId: p.id, size: pm.size, colorName: pm.color, qty: pm.qty }); } }),
      p.customPrint ? el("p", { class: "note", style: { marginTop: "12px" } }, "متاح للطباعة حسب الطلب. ", el("a", { href: "#designer", onclick: function () { $("#productDialog").close(); } }, "صمّم تيشيرتك بصورتك")) : null);
    body.append(el("div", { class: "pm" }, el("div", { class: "pm-gallery" }, main, thumbs), info));
    var rel = visible().filter(function (x) { return x.id !== p.id && x.category === p.category; });
    if (rel.length < 3) rel = rel.concat(visible().filter(function (x) { return x.id !== p.id && x.category !== p.category; }));
    rel = rel.slice(0, 4);
    if (rel.length) {
      var g = el("div", { class: "grid" });
      rel.forEach(function (x) { g.append(productCard(x)); });
      body.firstChild.append(el("section", { class: "pm-related" }, el("h3", { text: "منتجات ذات صلة" }), g));
    }
  }

  /* ---------- مجسم التيشيرت (SVG) ---------- */
  var NS = "http://www.w3.org/2000/svg";
  var TEE = "M72 30 L108 14 Q150 NECK 192 14 L228 30 L288 92 L252 126 L228 106 L228 296 L72 296 L72 106 L48 126 L12 92 Z";
  function teeSVG(hex, side) {
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 300 320"); svg.setAttribute("aria-hidden", "true");
    var neck = side === "back" ? 30 : 64;
    var path = document.createElementNS(NS, "path");
    path.setAttribute("d", TEE.replace("NECK", neck)); path.setAttribute("fill", safeHex(hex));
    path.setAttribute("stroke", "rgba(0,0,0,.3)"); path.setAttribute("stroke-width", "2"); path.setAttribute("stroke-linejoin", "round");
    var collar = document.createElementNS(NS, "path");
    collar.setAttribute("d", "M108 14 Q150 " + neck + " 192 14"); collar.setAttribute("fill", "none"); collar.setAttribute("stroke", "rgba(0,0,0,.35)"); collar.setAttribute("stroke-width", "3");
    svg.append(path, collar);
    return svg;
  }
  function mockup(hex, side, design, mini) {
    var stage = el("div", { class: "stage" + (mini ? " mini" : "") });
    var layer = el("div", { class: "tee-layer" }); layer.append(teeSVG(hex, side));
    var area = el("div", { class: "print-area" });
    if (design) area.append(el("img", { src: design.src, alt: "", style: { left: design.left * 100 + "%", top: design.top * 100 + "%", width: design.width * 100 + "%" } }));
    stage.append(layer, area);
    return stage;
  }

  /* ---------- قراءة وتصغير الصور ---------- */
  function readImage(file, opt) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error("read")); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("decode")); };
        img.onload = function () {
          var s = Math.min(1, opt.maxDim / Math.max(img.naturalWidth, img.naturalHeight));
          var w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
          var c = document.createElement("canvas"); c.width = w; c.height = h;
          var ctx = c.getContext("2d"), alpha = !opt.forceJpeg && file.type !== "image/jpeg";
          if (!alpha) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ src: c.toDataURL(alpha ? "image/png" : "image/jpeg", opt.quality), w: w, h: h });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function checkFile(file, maxMB) {
    if (ALLOWED.indexOf(file.type) < 0) return "نوع الملف غير مدعوم. المسموح: JPG, JPEG, PNG, WEBP.";
    if (file.size > maxMB * 1048576) return "حجم الملف أكبر من " + maxMB + " ميجابايت.";
    if (file.size === 0) return "الملف فارغ.";
    return "";
  }

  /* ---------- مصمم التيشيرت ---------- */
  var ds, dImg, dArea, dHandle, dScale;
  function newDesign() { return { color: CFG.TEE_COLORS[0], size: CFG.SIZES[1] || CFG.SIZES[0], side: "front", qty: 1, src: null, ratio: 1, w: 0.7, cx: 0.5, cy: 0.5, fileName: "" }; }
  function areaSize() { return { w: dArea.clientWidth, h: dArea.clientHeight }; }
  function maxScale() { var a = areaSize(); return a.w && a.h ? Math.min(1, a.h / (a.w * ds.ratio)) : 1; }
  function clampDesign() {
    var a = areaSize(); if (!a.w || !a.h) return 0.3;
    ds.w = Math.min(Math.max(ds.w, 0.08), maxScale());
    var hf = ds.w * a.w * ds.ratio / a.h;
    ds.cx = Math.min(Math.max(ds.cx, ds.w / 2), 1 - ds.w / 2);
    ds.cy = Math.min(Math.max(ds.cy, hf / 2), 1 - hf / 2);
    return hf;
  }
  function applyDesign() {
    var has = !!ds.src;
    dImg.hidden = !has; dHandle.hidden = !has; $("#areaHint").hidden = has; dScale.disabled = !has;
    $("#designRemove").hidden = !has; $("#designPick").textContent = has ? "استبدال الصورة" : "اختيار صورة";
    if (!has) return;
    var hf = clampDesign();
    dImg.style.left = (ds.cx - ds.w / 2) * 100 + "%"; dImg.style.top = (ds.cy - hf / 2) * 100 + "%"; dImg.style.width = ds.w * 100 + "%";
    dHandle.style.left = (ds.cx + ds.w / 2) * 100 + "%"; dHandle.style.top = (ds.cy + hf / 2) * 100 + "%";
    dScale.value = String(Math.round(ds.w / maxScale() * 100));
  }
  function renderTee() { $("#teeLayer").replaceChildren(teeSVG(ds.color.hex, ds.side)); }
  function buildColorChoices() {
    var host = $("#designColors"); host.replaceChildren();
    host.append(choices("لون التيشيرت", CFG.TEE_COLORS.map(function (c) { return { key: c.name, label: c.name, swatch: c.hex }; }), ds.color.name, function (k) {
      ds.color = CFG.TEE_COLORS.find(function (c) { return c.name === k; }) || CFG.TEE_COLORS[0]; renderTee();
    }));
  }
  function buildQty() { var h = $("#designQty"); h.replaceChildren(stepper(ds.qty, 1, MAX_QTY, function (n) { ds.qty = n; })); }
  function resetDesign() {
    ds = newDesign(); $("#designFile").value = ""; $$('input[name="designSide"]').forEach(function (r) { r.checked = r.value === "front"; });
    $("#designSize").value = ds.size; buildColorChoices(); buildQty(); renderTee(); applyDesign(); setMsg($("#designMsg"), "");
  }
  function describePos(d) {
    var h = d.cx < 0.38 ? "يسار" : d.cx > 0.62 ? "يمين" : "منتصف", v = d.cy < 0.38 ? "أعلى" : d.cy > 0.62 ? "أسفل" : "منتصف";
    return v + " / " + h;
  }
  function addCustom() {
    var msg = $("#designMsg");
    if (!ds.src) { setMsg(msg, "ارفع صورة أولًا لإضافة التصميم.", "err"); return; }
    var hf = clampDesign();
    var item = { id: uid(), type: "custom", name: "تيشيرت بتصميمك", size: ds.size, colorName: ds.color.name, colorHex: ds.color.hex, side: ds.side, qty: ds.qty,
      design: { src: ds.src, left: ds.cx - ds.w / 2, top: ds.cy - hf / 2, width: ds.w, cx: ds.cx, cy: ds.cy, fileName: ds.fileName } };
    cart.push(item);
    if (!persistCart()) { cart.pop(); setMsg(msg, "تعذر الحفظ: مساحة التخزين في المتصفح ممتلئة. احذف تصميمًا من السلة أو استخدم صورة أصغر.", "err"); return; }
    renderCart(); bumpCart();
    setMsg(msg, "تمت إضافة التصميم إلى السلة. لتصميم تيشيرت آخر استبدل الصورة أو غيّر الإعدادات ثم أضفه مرة أخرى.", "ok");
    toast("تمت إضافة التصميم إلى السلة");
  }
  function initDesigner() {
    dImg = $("#designImg"); dArea = $("#printArea"); dHandle = $("#designHandle"); dScale = $("#designScale");
    var sel = $("#designSize");
    CFG.SIZES.forEach(function (s) { sel.append(el("option", { value: s, text: s })); });
    $("#designPrice").textContent = fmt(CFG.CUSTOM_TEE_PRICE);
    resetDesign();
    sel.addEventListener("change", function () { ds.size = sel.value; });
    $$('input[name="designSide"]').forEach(function (r) { r.addEventListener("change", function () { if (r.checked) { ds.side = r.value; renderTee(); } }); });
    $("#designPick").addEventListener("click", function () { $("#designFile").click(); });
    $("#designFile").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0], msg = $("#designMsg");
      if (!f) return;
      var err = checkFile(f, CFG.MAX_UPLOAD_MB);
      if (err) { setMsg(msg, err, "err"); e.target.value = ""; return; }
      setMsg(msg, "جارٍ تحميل الصورة...");
      readImage(f, { maxDim: 800, quality: 0.88 }).then(function (r) {
        ds.src = r.src; ds.ratio = r.h / r.w; ds.cx = 0.5; ds.cy = 0.5; ds.w = 0.7 * 1; ds.fileName = f.name.replace(/[\u0000-\u001f]/g, "").slice(0, 60);
        ds.w = maxScale() * 0.75; applyDesign(); setMsg(msg, "تم تحميل الصورة. حرّكها وكبّرها كما تريد.", "ok");
      }).catch(function () { setMsg(msg, "تعذر قراءة الصورة. جرّب ملفًا آخر.", "err"); });
      e.target.value = "";
    });
    $("#designRemove").addEventListener("click", function () { ds.src = null; ds.fileName = ""; applyDesign(); setMsg($("#designMsg"), "تمت إزالة الصورة.", "ok"); });
    $("#designReset").addEventListener("click", function () { resetDesign(); setMsg($("#designMsg"), "تمت إعادة ضبط التصميم.", "ok"); });
    $("#designAdd").addEventListener("click", addCustom);
    dScale.addEventListener("input", function () { ds.w = Number(dScale.value) / 100 * maxScale(); applyDesign(); });
    /* سحب وتغيير الحجم بمؤشر موحّد (ماوس + لمس) — touch-action:none على الصورة فقط فيبقى تمرير الصفحة سليمًا */
    var drag = null;
    dImg.addEventListener("pointerdown", function (e) { if (!ds.src) return; e.preventDefault(); dImg.setPointerCapture(e.pointerId); drag = { mode: "move", id: e.pointerId, x: e.clientX, y: e.clientY, cx: ds.cx, cy: ds.cy }; });
    dHandle.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); dHandle.setPointerCapture(e.pointerId); drag = { mode: "size", id: e.pointerId, x: e.clientX, w: ds.w }; });
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var a = areaSize();
      if (drag.mode === "move") { ds.cx = drag.cx + (e.clientX - drag.x) / a.w; ds.cy = drag.cy + (e.clientY - drag.y) / a.h; }
      else ds.w = drag.w + (e.clientX - drag.x) / a.w * 2;
      applyDesign();
    }
    function end(e) { if (drag && e.pointerId === drag.id) drag = null; }
    [dImg, dHandle].forEach(function (t) { t.addEventListener("pointermove", onMove); t.addEventListener("pointerup", end); t.addEventListener("pointercancel", end); });
    dImg.addEventListener("keydown", function (e) {
      var s = 0.02, used = true;
      if (e.key === "ArrowLeft") ds.cx -= s; else if (e.key === "ArrowRight") ds.cx += s;
      else if (e.key === "ArrowUp") ds.cy -= s; else if (e.key === "ArrowDown") ds.cy += s;
      else if (e.key === "+" || e.key === "=") ds.w += 0.04; else if (e.key === "-") ds.w -= 0.04; else used = false;
      if (used) { e.preventDefault(); applyDesign(); }
    });
    window.addEventListener("resize", applyDesign);
  }

  /* ---------- عرض السلة ---------- */
  function cartRow(item, l) {
    var thumb = item.type === "custom" ? mockup(item.colorHex, item.side, item.design, true) : el("img", { src: l ? l.img : PH, alt: "" });
    var details = ["المقاس: " + item.size, "اللون: " + item.colorName];
    if (item.type === "custom") details.push("طباعة " + (item.side === "back" ? "خلفية" : "أمامية") + " بتصميمك");
    var info = el("div", { class: "cart-info" }, el("strong", { text: l ? l.name : item.name }), details.map(function (d) { return el("small", { text: d }); }));
    if (!l || !l.ok) info.append(el("small", { class: "unavail", text: "غير متاح حاليًا" }));
    else {
      info.append(el("small", { text: "سعر الوحدة: " + fmt(l.unit) }));
      var ctrl = el("div", { class: "cart-ctrl" }, stepper(item.qty, 1, l.max, function (n) { item.qty = n; if (!persistCart()) toast("تعذر حفظ السلة", "err"); renderCart(item.id); }), el("strong", { text: fmt(l.unit * item.qty) }));
      info.append(ctrl);
    }
    var rm = el("button", { type: "button", class: "rm", text: "حذف", "aria-label": "حذف " + (l ? l.name : item.name) + " من السلة", onclick: function () {
      cart = cart.filter(function (x) { return x.id !== item.id; }); persistCart(); renderCart(); toast("تم حذف المنتج من السلة");
    } });
    (info.querySelector(".cart-ctrl") || info).append(rm);
    return el("li", { class: "cart-row", "data-key": item.id }, thumb, info);
  }
  function renderCart(focusId) {
    var list = $("#cartItems"); list.replaceChildren();
    $("#cartCount").textContent = String(cart.reduce(function (s, i) { return s + i.qty; }, 0));
    $("#cartEmpty").hidden = cart.length > 0; $("#cartFooter").hidden = cart.length === 0;
    cart.forEach(function (i) { list.append(cartRow(i, lineInfo(i))); });
    var t = totals(), issue = cartIssue();
    $("#cartSub").textContent = fmt(t.sub);
    $("#cartDelivery").textContent = t.delivery ? fmt(t.delivery) : "مجانًا";
    $("#cartTotal").textContent = fmt(t.total);
    $("#cartIssue").textContent = issue; $("#checkoutBtn").disabled = !!issue || !cart.length;
    if (focusId) { var inp = $('[data-key="' + focusId + '"] input'); if (inp) inp.focus(); }
  }
  var lastFocus = null;
  function openCart() { lastFocus = document.activeElement; $("#cartDrawer").classList.add("open"); $("#cartOverlay").classList.add("open"); syncLock(); $("#cartClose").focus(); }
  function closeCart() { $("#cartDrawer").classList.remove("open"); $("#cartOverlay").classList.remove("open"); syncLock(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  /* ---------- الطلب عبر واتساب ---------- */
  function waNumber() {
    var d = String(CFG.WHATSAPP_NUMBER || "").replace(/[\s\-()+]/g, "");
    if (!/^\d{8,15}$/.test(d)) return "";
    if (/^01\d{9}$/.test(d)) d = "20" + d.slice(1);
    return d;
  }
  function buildMessage(v) {
    var t = totals(), n = 0, customs = 0, L = [];
    L.push("طلب جديد من متجر كريم السيد (KARIM ELSAYED)", "━━━━━━━━━━", "بيانات العميل", "الاسم: " + v.name, "الهاتف: " + v.phone, "المدينة: " + v.city, "العنوان: " + v.address);
    if (v.notes) L.push("ملاحظات: " + v.notes);
    L.push("", "تفاصيل الطلب");
    cart.forEach(function (i) {
      var l = lineInfo(i); if (!l || !l.ok) return;
      n++; L.push(n + ") " + l.name, "   المقاس: " + i.size + " | اللون: " + i.colorName + " | الكمية: " + i.qty, "   سعر الوحدة: " + fmt(l.unit) + " | الإجمالي: " + fmt(l.unit * i.qty));
      if (i.type === "custom") {
        customs++;
        L.push("   طباعة حسب الطلب: " + (i.side === "back" ? "خلفية" : "أمامية") + " | الموضع (كما في المعاينة): " + describePos(i.design) + " | حجم الصورة: " + Math.round(i.design.width * 100) + "% من منطقة الطباعة" + (i.design.fileName ? " | ملف الصورة: " + i.design.fileName : ""),
          "   سأرفق الصورة الأصلية لهذا التصميم في المحادثة.");
      }
    });
    L.push("", "المجموع الفرعي: " + fmt(t.sub), "رسوم التوصيل: " + (t.delivery ? fmt(t.delivery) : "مجانًا"), "الإجمالي: " + fmt(t.total));
    if (customs) L.push("", "ملاحظة: لدي " + customs + " تصميم مخصص وسأرفق صورة كل تصميم يدويًا.");
    L.push("", "طريقة الدفع: يتم الاتفاق عليها في المحادثة.");
    return L.join("\n");
  }
  function openCheckout() {
    if (!cart.length) { toast("السلة فارغة", "err"); return; }
    var issue = cartIssue(); if (issue) { toast(issue, "err"); return; }
    closeCart();
    var t = totals(), customs = cart.filter(function (i) { return i.type === "custom"; }).length;
    $("#coSummary").textContent = "عدد القطع: " + cart.reduce(function (s, i) { return s + i.qty; }, 0) + " — الإجمالي: " + fmt(t.total);
    var cn = $("#coCustomNote");
    cn.hidden = !customs;
    cn.textContent = customs ? "يوجد " + customs + " تصميم مخصص: بعد فتح واتساب أرفق صورة كل تصميم يدويًا في المحادثة، فلا يمكن للرابط إرفاق صور من جهازك تلقائيًا." : "";
    $("#coErr").textContent = ""; $("#coStatus").replaceChildren();
    openDialog($("#checkoutDialog")); $("#coName").focus();
  }
  function submitCheckout(e) {
    e.preventDefault();
    var err = $("#coErr"), v = {
      name: $("#coName").value.trim(), phone: $("#coPhone").value.replace(/[\s\-()]/g, ""), city: $("#coCity").value.trim(),
      address: $("#coAddress").value.trim(), notes: $("#coNotes").value.trim()
    };
    var bad = null;
    if (v.name.length < 3) bad = ["coName", "اكتب اسمك بالكامل."];
    else if (!/^\+?\d{9,15}$/.test(v.phone)) bad = ["coPhone", "اكتب رقم هاتف صحيحًا (أرقام فقط)."];
    else if (v.city.length < 2) bad = ["coCity", "اكتب المدينة أو المحافظة."];
    else if (v.address.length < 6) bad = ["coAddress", "اكتب عنوان التوصيل بالتفصيل."];
    if (bad) { err.textContent = bad[1]; $("#" + bad[0]).focus(); return; }
    var issue = cartIssue(); if (issue || !cart.length) { err.textContent = issue || "السلة فارغة."; return; }
    var number = waNumber();
    if (!number) { err.textContent = "لم يُضبط رقم واتساب المتجر بعد. عدّل WHATSAPP_NUMBER في ملف products.js."; return; }
    err.textContent = "";
    var text = buildMessage(v), url = "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
    var st = $("#coStatus"); st.className = "msg ok"; st.replaceChildren(
      el("p", { text: "تم فتح واتساب بالرسالة الجاهزة. الطلب لم يُرسل بعد — يجب أن تضغط «إرسال» داخل واتساب بنفسك. لم تتم أي عملية دفع عبر هذا الموقع." }),
      cart.some(function (i) { return i.type === "custom"; }) ? el("p", { text: "تذكير: أرفق صورة كل تصميم مخصص يدويًا في محادثة واتساب." }) : null,
      el("p", {}, el("a", { href: url, target: "_blank", rel: "noopener", text: "لم يفتح واتساب؟ اضغط هنا" }), " · ",
        el("button", { type: "button", class: "link-btn", style: { width: "auto", display: "inline" }, text: "نسخ نص الطلب", onclick: function () {
          if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast("تم نسخ نص الطلب"); }, function () { toast("تعذر النسخ", "err"); });
          else toast("النسخ غير مدعوم في هذا المتصفح", "err");
        } })));
  }

  /* ---------- لوحة الإدارة المحلية ---------- */
  var formImages = [];
  function storageInfo() {
    var used = 0; Object.keys(KEYS).forEach(function (k) { try { used += (localStorage.getItem(KEYS[k]) || "").length; } catch (e) { /* ignore */ } });
    $("#storageInfo").textContent = "المساحة المستخدمة تقريبًا: " + Math.round(used / 1024) + " كيلوبايت من حوالي 5000 (حد المتصفح). الحفظ هنا خاص بهذا المتصفح فقط.";
  }
  function commitProducts(next, okMsg, msgNode) {
    if (!save(KEYS.products, next)) {
      var m = "تعذر الحفظ: مساحة التخزين ممتلئة. قلّل عدد الصور أو حجمها، أو احذف منتجات.";
      if (msgNode) setMsg(msgNode, m, "err"); toast(m, "err"); return false;
    }
    products = next; syncCart(); renderAll();
    if (msgNode) setMsg(msgNode, okMsg, "ok"); toast(okMsg);
    return true;
  }
  function renderAdminList() {
    var ul = $("#adminList"); ul.replaceChildren();
    if (!products.length) { ul.append(el("li", { class: "empty", text: "لا توجد منتجات. أضف منتجًا جديدًا أو استعد المنتجات التجريبية." })); return; }
    products.slice().sort(byNew).forEach(function (p) {
      ul.append(el("li", { class: "admin-row" }, el("img", { src: p.images[0] || PH, alt: "" }),
        el("div", { class: "admin-info" }, el("strong", { text: p.name }), el("small", { text: p.category + " • " + fmt(effPrice(p)) + " • مخزون: " + p.stock + " • " + (p.published ? "منشور" : "مخفي") })),
        el("div", { class: "admin-btns" },
          el("button", { class: "btn btn-outline btn-sm", type: "button", text: "تعديل", onclick: function () { fillForm(p); } }),
          el("button", { class: "btn btn-outline btn-sm", type: "button", text: p.published ? "إخفاء" : "نشر", onclick: function () {
            commitProducts(products.map(function (x) { return x.id === p.id ? Object.assign({}, x, { published: !x.published }) : x; }), p.published ? "تم إخفاء المنتج" : "تم نشر المنتج");
          } }),
          el("button", { class: "btn btn-danger btn-sm", type: "button", text: "حذف", onclick: function () {
            confirmBox("هل تريد حذف «" + p.name + "» نهائيًا؟", "حذف").then(function (ok) { if (ok) { commitProducts(products.filter(function (x) { return x.id !== p.id; }), "تم حذف المنتج"); if ($("#afId").value === p.id) resetForm(); } });
          } }))));
    });
  }
  function fillCategorySelect(current) {
    var s = $("#afCategory"); s.replaceChildren();
    var l = allCategories(); if (current && l.indexOf(current) < 0) l.push(current);
    l.forEach(function (c) { s.append(el("option", { value: c, text: c })); });
    if (current) s.value = current;
  }
  function renderPreviews() {
    var box = $("#afPreviews"); box.replaceChildren();
    formImages.forEach(function (src, i) {
      box.append(el("div", { class: "preview" }, el("img", { src: src, alt: "صورة " + (i + 1) }), el("button", { type: "button", "aria-label": "حذف الصورة " + (i + 1), text: "✕", onclick: function () { formImages.splice(i, 1); renderPreviews(); } })));
    });
  }
  function resetForm() {
    $("#adminForm").reset(); $("#afId").value = ""; $("#afTitle").textContent = "منتج جديد"; formImages = [];
    $("#afSizes").value = "S, M, L, XL"; $("#afColors").value = "أسود:#111111\nأبيض:#f5f5f5"; $("#afStock").value = "10"; $("#afPublished").checked = true;
    fillCategorySelect(); renderPreviews(); setMsg($("#afMsg"), "");
  }
  function fillForm(p) {
    $("#afId").value = p.id; $("#afTitle").textContent = "تعديل: " + p.name; $("#afName").value = p.name; $("#afDesc").value = p.description;
    $("#afPrice").value = p.price; $("#afDiscount").value = p.discountPrice === null ? "" : p.discountPrice; $("#afStock").value = p.stock;
    $("#afSizes").value = p.sizes.join(", "); $("#afColors").value = p.colors.map(function (c) { return c.name + ":" + c.hex; }).join("\n");
    $("#afCustom").checked = p.customPrint; $("#afPublished").checked = p.published; $("#afFeatured").checked = p.featured; $("#afBest").checked = p.bestSeller;
    fillCategorySelect(p.category); formImages = p.images.slice(); renderPreviews(); setMsg($("#afMsg"), "");
    $("#adminForm").scrollIntoView();
  }
  function parseColors(text) {
    var out = [], lines = text.split(/\n|،|,/).map(function (s) { return s.trim(); }).filter(Boolean);
    for (var k = 0; k < lines.length; k++) {
      var m = lines[k].match(/^(.+?)\s*[:：]\s*(#[0-9a-fA-F]{6})$/);
      if (!m) return { error: "صيغة اللون غير صحيحة: «" + lines[k] + "». استخدم: الاسم:#RRGGBB" };
      out.push({ name: m[1].trim().slice(0, 30), hex: m[2].toLowerCase() });
    }
    return { colors: out.slice(0, 12) };
  }
  function submitProduct(e) {
    e.preventDefault();
    var msg = $("#afMsg"), name = $("#afName").value.trim(), price = Number($("#afPrice").value), dRaw = $("#afDiscount").value.trim(), disc = dRaw === "" ? null : Number(dRaw);
    var stock = Number($("#afStock").value);
    if (name.length < 2) return setMsg(msg, "اكتب اسم المنتج.", "err");
    if (!isFinite(price) || price <= 0) return setMsg(msg, "اكتب سعرًا صحيحًا أكبر من صفر.", "err");
    if (disc !== null && (!isFinite(disc) || disc <= 0 || disc >= price)) return setMsg(msg, "سعر الخصم يجب أن يكون أكبر من صفر وأقل من السعر الأصلي.", "err");
    if (!isFinite(stock) || stock < 0 || Math.floor(stock) !== stock) return setMsg(msg, "الكمية يجب أن تكون عددًا صحيحًا لا يقل عن صفر.", "err");
    var sizes = $("#afSizes").value.split(/،|,/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 12);
    if (!sizes.length) return setMsg(msg, "اكتب مقاسًا واحدًا على الأقل (أو «مقاس واحد»).", "err");
    var pc = parseColors($("#afColors").value);
    if (pc.error) return setMsg(msg, pc.error, "err");
    if (!pc.colors.length) return setMsg(msg, "اكتب لونًا واحدًا على الأقل.", "err");
    var id = $("#afId").value, old = products.find(function (p) { return p.id === id; });
    var item = normProduct({
      id: old ? old.id : "p-" + uid(), name: name, description: $("#afDesc").value.trim(), category: $("#afCategory").value, price: price, discountPrice: disc,
      images: formImages, sizes: sizes, colors: pc.colors, stock: stock, customPrint: $("#afCustom").checked, published: $("#afPublished").checked,
      featured: $("#afFeatured").checked, bestSeller: $("#afBest").checked, createdAt: old ? old.createdAt : Date.now()
    });
    var next = old ? products.map(function (p) { return p.id === old.id ? item : p; }) : products.concat([item]);
    if (commitProducts(next, old ? "تم تحديث المنتج بنجاح" : "تمت إضافة المنتج بنجاح", msg)) { $("#adminForm").reset(); resetFormKeepMsg(); }
  }
  function resetFormKeepMsg() { var t = $("#afMsg").textContent, c = $("#afMsg").className; resetForm(); $("#afMsg").textContent = t; $("#afMsg").className = c; }
  function handleProductImages(e) {
    var files = Array.prototype.slice.call(e.target.files || []), msg = $("#afMsg"), chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        if (formImages.length >= 4) { setMsg(msg, "الحد الأقصى ٤ صور لكل منتج.", "err"); return; }
        var err = checkFile(f, 2); if (err) { setMsg(msg, f.name + ": " + err, "err"); return; }
        return readImage(f, { maxDim: 700, quality: 0.8, forceJpeg: true }).then(function (r) { formImages.push(r.src); renderPreviews(); setMsg(msg, "تم تحميل الصورة.", "ok"); }, function () { setMsg(msg, "تعذر قراءة " + f.name, "err"); });
      });
    });
    chain.then(function () { e.target.value = ""; });
  }
  function submitSettings(e) {
    e.preventDefault();
    var msg = $("#stMsg"), fee = Number($("#stDelivery").value), free = Number($("#stFree").value || 0);
    var cats = $("#stCats").value.split("\n").map(function (s) { return s.trim().slice(0, 40); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; }).slice(0, 20);
    if (!isFinite(fee) || fee < 0 || !isFinite(free) || free < 0) return setMsg(msg, "اكتب أرقامًا صحيحة (صفر أو أكثر).", "err");
    if (!cats.length) return setMsg(msg, "أضف قسمًا واحدًا على الأقل.", "err");
    var next = { deliveryFee: fee, freeFrom: free, categories: cats };
    if (!save(KEYS.settings, next)) return setMsg(msg, "تعذر الحفظ: مساحة التخزين ممتلئة.", "err");
    settings = next; renderAll(); fillSettings(); setMsg(msg, "تم حفظ الإعدادات بنجاح", "ok"); toast("تم حفظ الإعدادات");
  }
  function fillSettings() { $("#stDelivery").value = settings.deliveryFee; $("#stFree").value = settings.freeFrom; $("#stCats").value = settings.categories.join("\n"); }
  function initAdmin() {
    $("#adminForm").addEventListener("submit", submitProduct);
    $("#afImages").addEventListener("change", handleProductImages);
    $("#afReset").addEventListener("click", resetForm);
    $("#adminNew").addEventListener("click", function () { resetForm(); $("#afName").focus(); });
    $("#settingsForm").addEventListener("submit", submitSettings);
    $("#adminRestore").addEventListener("click", function () {
      confirmBox("سيتم حذف كل تعديلاتك على المنتجات واستعادة المنتجات التجريبية الأصلية. هل تريد المتابعة؟", "استعادة").then(function (ok) {
        if (!ok) return;
        try { localStorage.removeItem(KEYS.products); } catch (e) { /* ignore */ }
        products = clone(DEFAULTS).map(normProduct).filter(Boolean); syncCart(); renderAll(); resetForm(); toast("تمت استعادة المنتجات التجريبية");
      });
    });
    fillSettings(); resetForm();
  }

  /* ---------- التوجيه والتحميل ---------- */
  function route() {
    var admin = location.hash === "#admin";
    $("#adminSection").hidden = !admin; $("#storeMain").hidden = admin;
    if (admin) { storageInfo(); window.scrollTo(0, 0); }
    else if (location.hash.length > 1) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }
  function renderAll() { renderHome(); renderShop(); renderCart(); renderAdminList(); fillCategorySelect($("#afCategory").value); storageInfo(); }

  var POLICIES = {
    shipping: ["سياسة الشحن والتوصيل", "نص تجريبي يعدّله صاحب المتجر: يتم تأكيد رسوم ومدة التوصيل مع العميل عبر واتساب قبل التنفيذ."],
    returns: ["الاستبدال والاسترجاع", "نص تجريبي يعدّله صاحب المتجر: تُحدَّد شروط الاستبدال والاسترجاع هنا. المنتجات المطبوعة حسب الطلب قد تخضع لشروط مختلفة."],
    privacy: ["الخصوصية", "هذا الموقع لا يرسل بياناتك إلى أي خادم. بيانات الطلب تُستخدم فقط لتكوين رسالة واتساب تفتحها وترسلها بنفسك. السلة والتصاميم تُحفظ في متصفحك."]
  };

  function init() {
    syncCart();
    initDesigner(); initAdmin(); renderAll();
    $("#shopSearch").addEventListener("input", function (e) { shop.q = e.target.value; renderShop(); });
    $("#shopSort").addEventListener("change", function (e) { shop.sort = e.target.value; renderShop(); });
    $("#navToggle").addEventListener("click", function (e) { var o = $("#nav").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(o)); });
    $$("#nav a").forEach(function (a) { a.addEventListener("click", function () { $("#nav").classList.remove("open"); $("#navToggle").setAttribute("aria-expanded", "false"); }); });
    $("#cartOpen").addEventListener("click", openCart); $("#cartClose").addEventListener("click", closeCart); $("#cartOverlay").addEventListener("click", closeCart);
    $("#cartShopBtn").addEventListener("click", function () { closeCart(); $("#shop").scrollIntoView(); });
    $("#checkoutBtn").addEventListener("click", openCheckout);
    $("#cartClear").addEventListener("click", function () {
      confirmBox("هل تريد إفراغ السلة بالكامل؟", "إفراغ").then(function (ok) { if (ok) { cart = []; persistCart(); renderCart(); toast("تم إفراغ السلة"); } });
    });
    $("#checkoutForm").addEventListener("submit", submitCheckout);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("#cartDrawer").classList.contains("open")) closeCart(); });
    $$("dialog").forEach(function (d) {
      d.addEventListener("close", syncLock);
      d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
      $$("[data-close]", d).forEach(function (b) { b.addEventListener("click", function () { d.close(); }); });
    });
    $$("[data-policy]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault(); var p = POLICIES[a.getAttribute("data-policy")]; if (!p) return;
        $("#policyTitle").textContent = p[0]; $("#policyBody").replaceChildren(el("p", { text: p[1] }), el("p", { class: "muted small", text: "هذا نص تجريبي وليس سياسة قانونية نهائية." }));
        openDialog($("#policyDialog"));
      });
    });
    $("#waContact").addEventListener("click", function (e) {
      e.preventDefault(); var n = waNumber();
      if (!n) { toast("لم يُضبط رقم واتساب المتجر بعد (WHATSAPP_NUMBER في products.js).", "err"); return; }
      window.open("https://wa.me/" + n, "_blank", "noopener");
    });
    window.addEventListener("hashchange", route); route();
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { threshold: 0.08 });
      $$(".reveal").forEach(function (n) { io.observe(n); });
    } else $$(".reveal").forEach(function (n) { n.classList.add("in"); });
  }
  init();
})();
