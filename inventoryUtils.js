(function (global) {
  function nextId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function positiveNumber(value) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function nonNegativeNumber(value) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function normalizeDate(value) {
    const date = normalizeText(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  }

  function normalizeOrderItems(items, priceField) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map((item) => {
      const productId = Number(item && item.productId);
      const quantity = positiveNumber(item && item.quantity);
      const price = nonNegativeNumber(item && item[priceField]);

      if (!productId || quantity === null || price === null) {
        return null;
      }

      return {
        productId,
        quantity,
        [priceField]: price
      };
    }).filter(Boolean);
  }

  function nextDocumentNo(prefix, date, rows) {
    const yyyymm = date.slice(0, 7).replace("-", "");
    const base = `${prefix}-${yyyymm}-`;
    const max = rows.reduce((current, row) => {
      const value = normalizeText(row.documentNo);
      if (!value.startsWith(base)) {
        return current;
      }

      const number = Number(value.slice(base.length));
      return Number.isFinite(number) ? Math.max(current, number) : current;
    }, 0);

    return `${base}${String(max + 1).padStart(3, "0")}`;
  }

  const api = {
    nextId,
    normalizeText,
    positiveNumber,
    nonNegativeNumber,
    normalizeDate,
    normalizeOrderItems,
    nextDocumentNo
  };

  global.StockFlowUtils = api;

  if (typeof module !== "undefined") {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
