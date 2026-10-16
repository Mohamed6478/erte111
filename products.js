"use strict";
/* =====================================================
   كريم السيد | KARIM ELSAYED — إعدادات المتجر وبيانات المنتجات
   كل الأسعار في المتجر تُقرأ من هذا الملف (أو من لوحة الإدارة المحلية).
   ===================================================== */
window.STORE_CONFIG = {
  WHATSAPP_NUMBER: "YOUR_WHATSAPP_NUMBER", // مثال: "201001234567" (رقم دولي بدون + أو مسافات)
  DELIVERY_FEE: 60,          // رسوم التوصيل الافتراضية (قابلة للتعديل أيضًا من لوحة الإدارة)
  FREE_DELIVERY_FROM: 0,     // توصيل مجاني عند هذا المبلغ فأكثر (0 = معطّل)
  CUSTOM_TEE_PRICE: 350,     // سعر التيشيرت المطبوع بتصميم العميل
  CURRENCY: "ج.م",
  MAX_UPLOAD_MB: 5,          // أقصى حجم لصورة العميل
  CATEGORIES: ["تيشيرتات مطبوعة", "تيشيرتات سادة", "تيشيرتات أوفر سايز", "طباعة حسب الطلب", "بناطيل", "هوديز", "سويت شيرت", "إكسسوارات"],
  SIZES: ["S", "M", "L", "XL", "XXL"],
  TEE_COLORS: [
    { name: "أبيض", hex: "#f5f5f5" }, { name: "أسود", hex: "#111111" }, { name: "رمادي", hex: "#9a9a9a" },
    { name: "كحلي", hex: "#1f2a44" }, { name: "بيج", hex: "#d8c9b0" }, { name: "زيتي", hex: "#4b5320" }
  ]
};

/* صور تجريبية (SVG) — لا تحتاج أي خدمة خارجية */
window.makePlaceholder = function (kind, hex, label, bg) {
  var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  var dark = (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  var fg = dark ? "#ffffff" : "#111111";
  var shapes = {
    tee: '<path d="M72 30 L108 14 Q150 64 192 14 L228 30 L288 92 L252 126 L228 106 L228 292 L72 292 L72 106 L48 126 L12 92 Z"/><text x="150" y="170" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="22" letter-spacing="4" fill="' + fg + '" stroke="none">KE</text>',
    hoodie: '<path d="M70 62 L112 32 Q150 80 188 32 L230 62 L286 128 L254 158 L232 132 L232 292 L68 292 L68 132 L46 158 L14 128 Z"/><path d="M112 32 Q150 100 188 32 Q150 14 112 32Z" fill="rgba(0,0,0,.18)" stroke="none"/><rect x="104" y="204" width="92" height="46" rx="8" fill="rgba(0,0,0,.12)" stroke="none"/><text x="150" y="170" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="18" letter-spacing="4" fill="' + fg + '" stroke="none">KE</text>',
    pants: '<path d="M84 24 H216 L238 296 H166 L150 130 L134 296 H62 Z"/><path d="M84 52 H216" stroke="rgba(0,0,0,.25)" stroke-width="3" fill="none"/>',
    cap: '<path d="M62 190 Q62 84 150 84 Q238 84 238 190 Z"/><ellipse cx="150" cy="196" rx="110" ry="26"/><text x="150" y="150" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="20" letter-spacing="3" fill="' + fg + '" stroke="none">KE</text>',
    bag: '<path d="M70 96 H230 L246 296 H54 Z"/><path d="M110 96 Q110 40 150 40 Q190 40 190 96" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="8"/><text x="150" y="214" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="22" letter-spacing="4" fill="' + fg + '" stroke="none">KE</text>'
  };
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 330"><rect width="300" height="330" fill="' + (bg || "#ececec") + '"/>' +
    '<g fill="' + hex + '" stroke="rgba(0,0,0,.28)" stroke-width="2" stroke-linejoin="round">' + (shapes[kind] || shapes.tee) + '</g>' +
    '<text x="150" y="322" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#666">' + label + '</text></svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};

/* منتجات عرض تجريبية — ليست مخزونًا حقيقيًا. عدّل الأسعار والأسماء كما تشاء. */
window.DEFAULT_PRODUCTS = (function () {
  var base = Date.UTC(2026, 8, 20);
  var col = {
    black: { name: "أسود", hex: "#111111" }, white: { name: "أبيض", hex: "#f5f5f5" }, gray: { name: "رمادي", hex: "#9a9a9a" },
    navy: { name: "كحلي", hex: "#1f2a44" }, beige: { name: "بيج", hex: "#d8c9b0" }, olive: { name: "زيتي", hex: "#4b5320" }
  };
  var S = ["S", "M", "L", "XL"], S2 = ["M", "L", "XL", "XXL"], SP = ["28", "30", "32", "34", "36"], ONE = ["مقاس واحد"];
  function mk(n, o) {
    var c = o.colors[0], c2 = o.colors[1] || c;
    return Object.assign({
      id: "demo-" + n, description: "", discountPrice: null, sizes: S, stock: 20, customPrint: false,
      published: true, featured: false, bestSeller: false, createdAt: base - n * 86400000,
      images: [window.makePlaceholder(o.kind, c.hex, "صورة تجريبية"), window.makePlaceholder(o.kind, c2.hex, "صورة تجريبية", "#d4d4d4")]
    }, o);
  }
  return [
    mk(1, { name: "تيشيرت «شارع القاهرة»", kind: "tee", category: "تيشيرتات مطبوعة", price: 399, discountPrice: 349, colors: [col.black, col.white], description: "تيشيرت مطبوع بتصميم ستريت وير مصري. منتج تجريبي للعرض.", featured: true, bestSeller: true, stock: 25, customPrint: true }),
    mk(2, { name: "تيشيرت «النيل»", kind: "tee", category: "تيشيرتات مطبوعة", price: 379, colors: [col.white, col.navy], description: "طبعة هادئة بخطوط عربية عصرية. منتج تجريبي للعرض.", featured: true, stock: 18 }),
    mk(3, { name: "تيشيرت «الزمالك» أسود", kind: "tee", category: "تيشيرتات مطبوعة", price: 399, colors: [col.black, col.gray], description: "تصميم جرافيك جريء على قماش مريح. منتج تجريبي للعرض.", bestSeller: true, stock: 12 }),
    mk(4, { name: "تيشيرت سادة أساسي", kind: "tee", category: "تيشيرتات سادة", price: 249, colors: [col.white, col.black, col.gray], description: "قصة كلاسيكية تناسب كل يوم. منتج تجريبي للعرض.", bestSeller: true, stock: 40, customPrint: true }),
    mk(5, { name: "تيشيرت سادة قطن ثقيل", kind: "tee", category: "تيشيرتات سادة", price: 299, discountPrice: 269, colors: [col.beige, col.olive], description: "وزن ثقيل وقوام متماسك. منتج تجريبي للعرض.", featured: true, stock: 30, customPrint: true }),
    mk(6, { name: "تيشيرت أوفر سايز «بوكس»", kind: "tee", category: "تيشيرتات أوفر سايز", price: 449, colors: [col.black, col.beige], sizes: S2, description: "قصة واسعة بإحساس الستريت. منتج تجريبي للعرض.", featured: true, bestSeller: true, stock: 22, customPrint: true }),
    mk(7, { name: "تيشيرت أوفر سايز «دروب شولدر»", kind: "tee", category: "تيشيرتات أوفر سايز", price: 429, discountPrice: 389, colors: [col.gray, col.white], sizes: S2, description: "كتف نازل وأكمام واسعة. منتج تجريبي للعرض.", stock: 15 }),
    mk(8, { name: "تيشيرت للطباعة حسب الطلب", kind: "tee", category: "طباعة حسب الطلب", price: window.STORE_CONFIG.CUSTOM_TEE_PRICE, colors: [col.white, col.black, col.gray], description: "ارفع صورتك وصمّم تيشيرتك من قسم «صمّم تيشيرتك». منتج تجريبي للعرض.", customPrint: true, featured: true, stock: 100 }),
    mk(9, { name: "بنطلون كارجو", kind: "pants", category: "بناطيل", price: 699, colors: [col.olive, col.black], sizes: SP, description: "جيوب جانبية وقصة مريحة. منتج تجريبي للعرض.", stock: 14 }),
    mk(10, { name: "بنطلون جوجر", kind: "pants", category: "بناطيل", price: 549, discountPrice: 499, colors: [col.gray, col.black], sizes: S, description: "خصر مطاطي وحزام سفلي. منتج تجريبي للعرض.", bestSeller: true, stock: 20 }),
    mk(11, { name: "هودي «بلاك»", kind: "hoodie", category: "هوديز", price: 799, colors: [col.black, col.gray], sizes: S2, description: "هودي بغطاء رأس وجيب أمامي. منتج تجريبي للعرض.", featured: true, bestSeller: true, stock: 16, customPrint: true }),
    mk(12, { name: "هودي أوفر سايز", kind: "hoodie", category: "هوديز", price: 849, discountPrice: 749, colors: [col.beige, col.navy], sizes: S2, description: "قصة واسعة ودافئة. منتج تجريبي للعرض.", stock: 3 }),
    mk(13, { name: "سويت شيرت كلاسيك", kind: "tee", category: "سويت شيرت", price: 649, colors: [col.gray, col.black], sizes: S, description: "سويت شيرت بدون غطاء رأس. منتج تجريبي للعرض.", stock: 17 }),
    mk(14, { name: "كاب ستريت", kind: "cap", category: "إكسسوارات", price: 199, colors: [col.black, col.white], sizes: ONE, description: "كاب قابل للتعديل. منتج تجريبي للعرض.", stock: 40 }),
    mk(15, { name: "شنطة قماش «توت»", kind: "bag", category: "إكسسوارات", price: 179, colors: [col.beige, col.black], sizes: ONE, description: "شنطة قماش للاستخدام اليومي. منتج تجريبي للعرض.", stock: 0 })
  ];
})();
