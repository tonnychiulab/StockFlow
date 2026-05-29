(function (global) {
  const utils = global.StockFlowUtils || (typeof require !== "undefined" ? require("./inventoryUtils") : {});
  const {
    normalizeText,
    positiveNumber,
    nonNegativeNumber,
    normalizeDate
  } = utils;

  function normalizeProductCategory(input, id) {
    const code = normalizeText(input && input.code).toUpperCase();
    const name = normalizeText(input && input.name);
    const sortOrder = nonNegativeNumber(input && input.sortOrder);

    if (!code || !name || sortOrder === null) {
      return null;
    }

    return {
      id,
      code,
      name,
      sortOrder,
      note: normalizeText(input && input.note),
      active: input && input.active === false ? false : true
    };
  }

  function copyProductCategory(category) {
    return {
      id: Number(category.id),
      code: normalizeText(category.code).toUpperCase(),
      name: normalizeText(category.name),
      sortOrder: nonNegativeNumber(category.sortOrder) || 0,
      note: normalizeText(category.note),
      active: category.active === false ? false : true
    };
  }

  function sameCategory(left, right) {
    return normalizeText(left.code).toUpperCase() === normalizeText(right.code).toUpperCase()
      || normalizeText(left.name).toLowerCase() === normalizeText(right.name).toLowerCase();
  }

  function normalizeWarehouse(input, id) {
    const code = normalizeText(input && input.code).toUpperCase();
    const name = normalizeText(input && input.name);
    const type = normalizeText(input && input.type) || "warehouse";

    if (!code || !name) {
      return null;
    }

    return {
      id,
      code,
      name,
      type,
      note: normalizeText(input && input.note),
      active: input && input.active === false ? false : true
    };
  }

  function copyWarehouse(warehouse) {
    return {
      id: Number(warehouse.id),
      code: normalizeText(warehouse.code).toUpperCase(),
      name: normalizeText(warehouse.name),
      type: normalizeText(warehouse.type) || "warehouse",
      note: normalizeText(warehouse.note),
      active: warehouse.active === false ? false : true
    };
  }

  function sameWarehouse(left, right) {
    return normalizeText(left.code).toUpperCase() === normalizeText(right.code).toUpperCase()
      || normalizeText(left.name).toLowerCase() === normalizeText(right.name).toLowerCase();
  }

  function normalizePartner(input, id) {
    const role = input && input.role === "customer" ? "customer" : "supplier";
    const name = normalizeText(input && input.name);

    if (!name) {
      return null;
    }

    return {
      id,
      role,
      name,
      contact: normalizeText(input && input.contact),
      phone: normalizeText(input && input.phone),
      note: normalizeText(input && input.note),
      active: input && input.active === false ? false : true
    };
  }

  function copyPartner(partner) {
    return {
      id: Number(partner.id),
      role: partner.role === "customer" ? "customer" : "supplier",
      name: normalizeText(partner.name),
      contact: normalizeText(partner.contact),
      phone: normalizeText(partner.phone),
      note: normalizeText(partner.note),
      active: partner.active === false ? false : true
    };
  }

  function samePartner(left, right) {
    return left.role === right.role && normalizeText(left.name).toLowerCase() === normalizeText(right.name).toLowerCase();
  }

  function normalizeProduct(input, id) {
    const sku = normalizeText(input && input.sku).toUpperCase();
    const name = normalizeText(input && input.name);
    const category = normalizeText(input && input.category) || "未分類";
    const unit = normalizeText(input && input.unit) || "件";
    const cost = nonNegativeNumber(input && input.cost);
    const price = nonNegativeNumber(input && input.price);
    const safetyStock = nonNegativeNumber(input && input.safetyStock);

    if (!sku || !name || cost === null || price === null || safetyStock === null) {
      return null;
    }

    return {
      id,
      sku,
      name,
      category,
      unit,
      cost,
      price,
      safetyStock,
      active: input && input.active === false ? false : true
    };
  }

  function normalizePurchase(input, id) {
    const productId = Number(input && input.productId);
    const quantity = positiveNumber(input && input.quantity);
    const unitCost = nonNegativeNumber(input && input.unitCost);
    const date = normalizeDate(input && input.date);

    if (!productId || quantity === null || unitCost === null || !date) {
      return null;
    }

    return {
      id,
      productId,
      warehouseId: Number(input && input.warehouseId) || 0,
      quantity,
      unitCost,
      supplier: normalizeText(input && input.supplier),
      date,
      note: normalizeText(input && input.note),
      documentNo: normalizeText(input && input.documentNo)
    };
  }

  function normalizeSale(input, id) {
    const productId = Number(input && input.productId);
    const quantity = positiveNumber(input && input.quantity);
    const unitPrice = nonNegativeNumber(input && input.unitPrice);
    const date = normalizeDate(input && input.date);

    if (!productId || quantity === null || unitPrice === null || !date) {
      return null;
    }

    return {
      id,
      productId,
      warehouseId: Number(input && input.warehouseId) || 0,
      quantity,
      unitPrice,
      customer: normalizeText(input && input.customer),
      date,
      note: normalizeText(input && input.note),
      documentNo: normalizeText(input && input.documentNo)
    };
  }

  function normalizeAdjustment(input, id) {
    const productId = Number(input && input.productId);
    const quantity = Math.round(Number(input && input.quantity));
    const date = normalizeDate(input && input.date);

    if (!productId || !Number.isFinite(quantity) || quantity === 0 || !date) {
      return null;
    }

    return {
      id,
      productId,
      warehouseId: Number(input && input.warehouseId) || 0,
      quantity,
      reason: normalizeText(input && input.reason) || "調整",
      date,
      note: normalizeText(input && input.note),
      documentNo: normalizeText(input && input.documentNo)
    };
  }

  function copyProduct(product) {
    return {
      id: Number(product.id),
      sku: normalizeText(product.sku).toUpperCase(),
      name: normalizeText(product.name),
      category: normalizeText(product.category) || "未分類",
      unit: normalizeText(product.unit) || "件",
      cost: nonNegativeNumber(product.cost) || 0,
      price: nonNegativeNumber(product.price) || 0,
      safetyStock: nonNegativeNumber(product.safetyStock) || 0,
      active: product.active === false ? false : true
    };
  }

  function copyPurchase(purchase) {
    return {
      id: Number(purchase.id),
      productId: Number(purchase.productId),
      warehouseId: Number(purchase.warehouseId) || 0,
      quantity: positiveNumber(purchase.quantity) || 0,
      unitCost: nonNegativeNumber(purchase.unitCost) || 0,
      supplier: normalizeText(purchase.supplier),
      date: normalizeDate(purchase.date),
      note: normalizeText(purchase.note),
      documentNo: normalizeText(purchase.documentNo)
    };
  }

  function copySale(sale) {
    return {
      id: Number(sale.id),
      productId: Number(sale.productId),
      warehouseId: Number(sale.warehouseId) || 0,
      quantity: positiveNumber(sale.quantity) || 0,
      unitPrice: nonNegativeNumber(sale.unitPrice) || 0,
      customer: normalizeText(sale.customer),
      date: normalizeDate(sale.date),
      note: normalizeText(sale.note),
      documentNo: normalizeText(sale.documentNo)
    };
  }

  function copyAdjustment(adjustment) {
    return {
      id: Number(adjustment.id),
      productId: Number(adjustment.productId),
      warehouseId: Number(adjustment.warehouseId) || 0,
      quantity: Math.round(Number(adjustment.quantity)) || 0,
      reason: normalizeText(adjustment.reason) || "調整",
      date: normalizeDate(adjustment.date),
      note: normalizeText(adjustment.note),
      documentNo: normalizeText(adjustment.documentNo)
    };
  }

  function defaultWarehouse() {
    return {
      id: 1,
      code: "MAIN",
      name: "主倉",
      type: "warehouse",
      note: "預設倉庫",
      active: true
    };
  }

  function ensureWarehouseOnRow(row, warehouseId) {
    return Object.assign({}, row, {
      warehouseId: Number(row && row.warehouseId) || warehouseId
    });
  }

  function sameSku(left, right) {
    return normalizeText(left).toUpperCase() === normalizeText(right).toUpperCase();
  }

  const api = {
    normalizeProductCategory,
    copyProductCategory,
    sameCategory,
    normalizeWarehouse,
    copyWarehouse,
    sameWarehouse,
    normalizePartner,
    copyPartner,
    samePartner,
    normalizeProduct,
    normalizePurchase,
    normalizeSale,
    normalizeAdjustment,
    copyProduct,
    copyPurchase,
    copySale,
    copyAdjustment,
    defaultWarehouse,
    ensureWarehouseOnRow,
    sameSku
  };

  global.StockFlowModels = api;

  if (typeof module !== "undefined") {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
