(function (global) {
  const models = global.StockFlowModels || (typeof require !== "undefined" ? require("./inventoryModels") : {});
  const reports = global.StockFlowReports || (typeof require !== "undefined" ? require("./inventoryReports") : {});
  const {
    normalizeProductCategory,
    copyProductCategory,
    sameCategory,
    normalizeWarehouse,
    copyWarehouse,
    sameWarehouse,
    normalizePartner,
    copyPartner,
    samePartner,
    normalizePurchase,
    normalizeSale,
    normalizeTransfer,
    copyTransfer
  } = models;

  function createInventoryStore(initialState) {
    let products = Array.isArray(initialState && initialState.products)
      ? initialState.products.map(copyProduct)
      : [];
    let purchases = Array.isArray(initialState && initialState.purchases)
      ? initialState.purchases.map(copyPurchase)
      : [];
    let sales = Array.isArray(initialState && initialState.sales)
      ? initialState.sales.map(copySale)
      : [];
    let partners = Array.isArray(initialState && initialState.partners)
      ? initialState.partners.map(copyPartner)
      : [];
    let productCategories = Array.isArray(initialState && initialState.productCategories)
      ? initialState.productCategories.map(copyProductCategory)
      : [];
    let warehouses = Array.isArray(initialState && initialState.warehouses)
      ? initialState.warehouses.map(copyWarehouse)
      : [];
    if (!warehouses.length) {
      warehouses = [defaultWarehouse()];
    }
    let adjustments = Array.isArray(initialState && initialState.adjustments)
      ? initialState.adjustments.map(copyAdjustment)
      : [];
    let transfers = Array.isArray(initialState && initialState.transfers)
      ? initialState.transfers.map(copyTransfer)
      : [];
    const fallbackWarehouseId = defaultWarehouseId();
    purchases = purchases.map((purchase) => ensureWarehouseOnRow(purchase, fallbackWarehouseId));
    sales = sales.map((sale) => ensureWarehouseOnRow(sale, fallbackWarehouseId));
    adjustments = adjustments.map((adjustment) => ensureWarehouseOnRow(adjustment, fallbackWarehouseId));

    let nextProductId = nextId(products);
    let nextPurchaseId = nextId(purchases);
    let nextSaleId = nextId(sales);
    let nextPartnerId = nextId(partners);
    let nextCategoryId = nextId(productCategories);
    let nextWarehouseId = nextId(warehouses);
    let nextAdjustmentId = nextId(adjustments);
    let nextTransferId = nextId(transfers);

    function addProduct(input) {
      const product = normalizeProduct(input, nextProductId);

      if (!product || products.some((item) => sameSku(item.sku, product.sku))) {
        return null;
      }

      nextProductId += 1;
      products = [product].concat(products);
      return copyProduct(product);
    }

    function updateProduct(id, input) {
      const existing = findProduct(id);

      if (!existing) {
        return null;
      }

      const product = normalizeProduct(Object.assign({}, input, {
        active: existing.active
      }), existing.id);

      if (!product) {
        return null;
      }

      if (products.some((item) => item.id !== existing.id && sameSku(item.sku, product.sku))) {
        return { error: "DUPLICATE_SKU" };
      }

      products = products.map((item) => item.id === existing.id ? product : item);
      return copyProduct(product);
    }

    function deactivateProduct(id) {
      let updated = null;

      products = products.map((product) => {
        if (product.id !== id) {
          return product;
        }

        updated = Object.assign({}, product, { active: false });
        return updated;
      });

      return updated ? copyProduct(updated) : null;
    }

    function addProductCategory(input) {
      const category = normalizeProductCategory(input, nextCategoryId);

      if (!category || productCategories.some((item) => sameCategory(item, category))) {
        return null;
      }

      nextCategoryId += 1;
      productCategories = [category].concat(productCategories);
      return copyProductCategory(category);
    }

    function deactivateProductCategory(id) {
      let updated = null;

      productCategories = productCategories.map((category) => {
        if (category.id !== Number(id)) {
          return category;
        }

        updated = Object.assign({}, category, { active: false });
        return updated;
      });

      return updated ? copyProductCategory(updated) : null;
    }

    function addWarehouse(input) {
      const warehouse = normalizeWarehouse(input, nextWarehouseId);

      if (!warehouse || warehouses.some((item) => sameWarehouse(item, warehouse))) {
        return null;
      }

      nextWarehouseId += 1;
      warehouses = [warehouse].concat(warehouses);
      return copyWarehouse(warehouse);
    }

    function deactivateWarehouse(id) {
      let updated = null;

      warehouses = warehouses.map((warehouse) => {
        if (warehouse.id !== Number(id)) {
          return warehouse;
        }

        updated = Object.assign({}, warehouse, { active: false });
        return updated;
      });

      return updated ? copyWarehouse(updated) : null;
    }

    function addPartner(input) {
      const partner = normalizePartner(input, nextPartnerId);

      if (!partner || partners.some((item) => samePartner(item, partner))) {
        return null;
      }

      nextPartnerId += 1;
      partners = [partner].concat(partners);
      return copyPartner(partner);
    }

    function updatePartner(id, input) {
      const existing = findPartner(id);

      if (!existing) {
        return null;
      }

      const partner = normalizePartner(Object.assign({}, input, {
        active: existing.active
      }), existing.id);

      if (!partner) {
        return null;
      }

      if (partners.some((item) => item.id !== existing.id && samePartner(item, partner))) {
        return { error: "DUPLICATE_PARTNER" };
      }

      partners = partners.map((item) => item.id === existing.id ? partner : item);
      return copyPartner(partner);
    }

    function deactivatePartner(id) {
      let updated = null;

      partners = partners.map((partner) => {
        if (partner.id !== Number(id)) {
          return partner;
        }

        updated = Object.assign({}, partner, { active: false });
        return updated;
      });

      return updated ? copyPartner(updated) : null;
    }

    function addPurchase(input) {
      const purchase = normalizePurchase(input, nextPurchaseId);
      const product = findProduct(purchase && purchase.productId);
      const warehouse = resolveActiveWarehouse(purchase && purchase.warehouseId);

      if (!purchase || !product || !product.active || !warehouse) {
        return null;
      }

      const saved = Object.assign({}, purchase, { warehouseId: warehouse.id });
      nextPurchaseId += 1;
      purchases = [saved].concat(purchases);
      products = products.map((item) => {
        if (item.id !== saved.productId) {
          return item;
        }

        return Object.assign({}, item, { cost: saved.unitCost });
      });

      return copyPurchase(saved);
    }

    function addPurchaseOrder(input) {
      const date = normalizeDate(input && input.date);
      const items = normalizeOrderItems(input && input.items, "unitCost");
      const warehouse = resolveActiveWarehouse(input && input.warehouseId);

      if (!date || !items.length || !warehouse) {
        return null;
      }

      if (items.some((item) => {
        const product = findProduct(item.productId);
        return !product || !product.active;
      })) {
        return null;
      }

      const documentNo = normalizeText(input && input.documentNo) || nextDocumentNo("PO", date, purchases);
      const created = items.map((item) => {
        const purchase = {
          id: nextPurchaseId,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          supplier: normalizeText(input && input.supplier),
          date,
          note: normalizeText(input && input.note),
          documentNo,
          warehouseId: warehouse.id
        };
        nextPurchaseId += 1;
        return purchase;
      });

      purchases = created.concat(purchases);
      products = products.map((product) => {
        const latestLine = created.find((item) => item.productId === product.id);
        return latestLine ? Object.assign({}, product, { cost: latestLine.unitCost }) : product;
      });

      return {
        documentNo,
        lines: created.map(copyPurchase),
        total: created.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
      };
    }

    function addSale(input) {
      const sale = normalizeSale(input, nextSaleId);
      const product = findProduct(sale && sale.productId);
      const warehouse = resolveActiveWarehouse(sale && sale.warehouseId);

      if (!sale || !product || !product.active || !warehouse) {
        return null;
      }

      if (stockForProduct(sale.productId, warehouse.id).onHand < sale.quantity) {
        return { error: "INSUFFICIENT_STOCK" };
      }

      const saved = Object.assign({}, sale, { warehouseId: warehouse.id });
      nextSaleId += 1;
      sales = [saved].concat(sales);
      return copySale(saved);
    }

    function addSaleOrder(input) {
      const date = normalizeDate(input && input.date);
      const items = normalizeOrderItems(input && input.items, "unitPrice");
      const warehouse = resolveActiveWarehouse(input && input.warehouseId);

      if (!date || !items.length || !warehouse) {
        return null;
      }

      if (items.some((item) => {
        const product = findProduct(item.productId);
        return !product || !product.active;
      })) {
        return null;
      }

      const requestedByProduct = new Map();
      items.forEach((item) => {
        requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) || 0) + item.quantity);
      });

      for (const [productId, quantity] of requestedByProduct.entries()) {
        if (stockForProduct(productId, warehouse.id).onHand < quantity) {
          return { error: "INSUFFICIENT_STOCK" };
        }
      }

      const documentNo = normalizeText(input && input.documentNo) || nextDocumentNo("SO", date, sales);
      const created = items.map((item) => {
        const sale = {
          id: nextSaleId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          customer: normalizeText(input && input.customer),
          date,
          note: normalizeText(input && input.note),
          documentNo,
          warehouseId: warehouse.id
        };
        nextSaleId += 1;
        return sale;
      });

      sales = created.concat(sales);

      return {
        documentNo,
        lines: created.map(copySale),
        total: created.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      };
    }

    function removePurchase(id) {
      const purchase = purchases.find((item) => item.id === Number(id));

      if (!purchase) {
        return false;
      }

      const currentStock = stockForProduct(purchase.productId, purchase.warehouseId).onHand;
      if (currentStock - purchase.quantity < 0) {
        return { error: "NEGATIVE_STOCK" };
      }

      purchases = purchases.filter((item) => item.id !== purchase.id);
      return true;
    }

    function removeSale(id) {
      const before = sales.length;
      sales = sales.filter((item) => item.id !== Number(id));
      return sales.length !== before;
    }

    function addStockAdjustment(input) {
      const adjustment = normalizeAdjustment(input, nextAdjustmentId);
      const product = findProduct(adjustment && adjustment.productId);
      const warehouse = resolveActiveWarehouse(adjustment && adjustment.warehouseId);

      if (!adjustment || !product || !product.active || !warehouse) {
        return null;
      }

      const saved = Object.assign({}, adjustment, {
        warehouseId: warehouse.id,
        documentNo: adjustment.documentNo || nextDocumentNo("ADJ", adjustment.date, adjustments)
      });
      nextAdjustmentId += 1;
      adjustments = [saved].concat(adjustments);
      return copyAdjustment(saved);
    }

    function addStockCount(input) {
      const productId = Number(input && input.productId);
      const countedQuantity = nonNegativeNumber(input && input.countedQuantity);
      const product = findProduct(productId);
      const warehouse = resolveActiveWarehouse(input && input.warehouseId);

      if (!product || !product.active || countedQuantity === null || !warehouse) {
        return null;
      }

      const diff = countedQuantity - stockForProduct(productId, warehouse.id).onHand;
      if (diff === 0) {
        return { error: "NO_DIFFERENCE" };
      }

      return addStockAdjustment({
        productId,
        quantity: diff,
        warehouseId: warehouse.id,
        reason: normalizeText(input && input.reason) || "盤點",
        date: input && input.date,
        note: input && input.note,
        documentNo: input && input.documentNo
      });
    }

    function addTransferOrder(input) {
      const date = normalizeDate(input && input.date);
      const items = normalizeOrderItems(input && input.items, "quantity");
      const fromWarehouse = resolveActiveWarehouse(input && input.fromWarehouseId);
      const toWarehouse = resolveActiveWarehouse(input && input.toWarehouseId);

      if (!date || !items.length || !fromWarehouse || !toWarehouse || fromWarehouse.id === toWarehouse.id) {
        return null;
      }

      if (items.some((item) => {
        const product = findProduct(item.productId);
        return !product || !product.active;
      })) {
        return null;
      }

      const requestedByProduct = new Map();
      items.forEach((item) => {
        requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) || 0) + item.quantity);
      });

      for (const [productId, quantity] of requestedByProduct.entries()) {
        if (stockForProduct(productId, fromWarehouse.id).onHand < quantity) {
          return { error: "INSUFFICIENT_STOCK" };
        }
      }

      const documentNo = normalizeText(input && input.documentNo) || nextDocumentNo("TRF", date, transfers);
      const created = items.map((item) => {
        const transfer = normalizeTransfer({
          productId: item.productId,
          fromWarehouseId: fromWarehouse.id,
          toWarehouseId: toWarehouse.id,
          quantity: item.quantity,
          date,
          note: input && input.note,
          documentNo
        }, nextTransferId);
        nextTransferId += 1;
        return transfer;
      }).filter(Boolean);

      transfers = created.concat(transfers);

      return {
        documentNo,
        lines: created.map(copyTransfer),
        totalQuantity: created.reduce((sum, item) => sum + item.quantity, 0)
      };
    }

    function listProducts(options) {
      const filter = Object.assign({ query: "", category: "", activeOnly: false }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return products
        .filter((product) => !filter.activeOnly || product.active)
        .filter((product) => !filter.category || product.category === filter.category)
        .filter((product) => {
          if (!query) {
            return true;
          }

          return [product.sku, product.name, product.category]
            .some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .map(copyProduct);
    }

    function listPurchases(options) {
      const filter = Object.assign({ query: "", month: "" }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return purchases
        .filter((purchase) => !filter.month || purchase.date.slice(0, 7) === filter.month)
        .filter((purchase) => {
          if (!query) {
            return true;
          }

          const product = findProduct(purchase.productId);
          const warehouse = findWarehouse(purchase.warehouseId);
          return [
            product && product.sku,
            product && product.name,
            warehouse && warehouse.code,
            warehouse && warehouse.name,
            purchase.documentNo,
            purchase.supplier,
            purchase.note
          ].some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .map(copyPurchase);
    }

    function listSales(options) {
      const filter = Object.assign({ query: "", month: "" }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return sales
        .filter((sale) => !filter.month || sale.date.slice(0, 7) === filter.month)
        .filter((sale) => {
          if (!query) {
            return true;
          }

          const product = findProduct(sale.productId);
          const warehouse = findWarehouse(sale.warehouseId);
          return [
            product && product.sku,
            product && product.name,
            warehouse && warehouse.code,
            warehouse && warehouse.name,
            sale.documentNo,
            sale.customer,
            sale.note
          ].some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .map(copySale);
    }

    function listPartners(options) {
      const filter = Object.assign({ query: "", role: "", activeOnly: false }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return partners
        .filter((partner) => !filter.activeOnly || partner.active)
        .filter((partner) => !filter.role || partner.role === filter.role)
        .filter((partner) => {
          if (!query) {
            return true;
          }

          return [partner.name, partner.contact, partner.phone, partner.note]
            .some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
        .map(copyPartner);
    }

    function listProductCategories(options) {
      const filter = Object.assign({ query: "", activeOnly: false }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return productCategories
        .filter((category) => !filter.activeOnly || category.active)
        .filter((category) => {
          if (!query) {
            return true;
          }

          return [category.code, category.name, category.note]
            .some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map(copyProductCategory);
    }

    function listWarehouses(options) {
      const filter = Object.assign({ query: "", activeOnly: false }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return warehouses
        .filter((warehouse) => !filter.activeOnly || warehouse.active)
        .filter((warehouse) => {
          if (!query) {
            return true;
          }

          return [warehouse.code, warehouse.name, warehouse.type, warehouse.note]
            .some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(copyWarehouse);
    }

    function listAdjustments(options) {
      const filter = Object.assign({ query: "", month: "" }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return adjustments
        .filter((adjustment) => !filter.month || adjustment.date.slice(0, 7) === filter.month)
        .filter((adjustment) => {
          if (!query) {
            return true;
          }

          const product = findProduct(adjustment.productId);
          const warehouse = findWarehouse(adjustment.warehouseId);
          return [
            product && product.sku,
            product && product.name,
            warehouse && warehouse.code,
            warehouse && warehouse.name,
            adjustment.documentNo,
            adjustment.reason,
            adjustment.note
          ].some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .map(copyAdjustment);
    }

    function inventoryReport(options) {
      return reports.inventoryReport(reportState(), options);
    }

    function dashboard() {
      return reports.dashboard(reportState());
    }

    function grossProfitRanking(limit) {
      return reports.grossProfitRanking(reportState(), limit);
    }

    function warehouseStockSummary(options) {
      return reports.warehouseStockSummary(reportState(), options);
    }

    function productWarehouseSummary(options) {
      return reports.productWarehouseSummary(reportState(), options);
    }

    function warehouseTransferSummary(options) {
      return reports.warehouseTransferSummary(reportState(), options);
    }

    function reportSummary(options) {
      return reports.reportSummary(reportState(), options);
    }

    function stockMovements(options) {
      return reports.stockMovements(reportState(), options);
    }

    function listTransfers(options) {
      const filter = Object.assign({ query: "", month: "" }, options);
      const query = normalizeText(filter.query).toLowerCase();

      return transfers
        .filter((transfer) => !filter.month || transfer.date.slice(0, 7) === filter.month)
        .filter((transfer) => {
          if (!query) {
            return true;
          }

          const product = findProduct(transfer.productId);
          const fromWarehouse = findWarehouse(transfer.fromWarehouseId);
          const toWarehouse = findWarehouse(transfer.toWarehouseId);
          return [
            product && product.sku,
            product && product.name,
            fromWarehouse && fromWarehouse.code,
            fromWarehouse && fromWarehouse.name,
            toWarehouse && toWarehouse.code,
            toWarehouse && toWarehouse.name,
            transfer.documentNo,
            transfer.note
          ].some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .map(copyTransfer);
    }

    function categories() {
      const categoryNames = productCategories
        .filter((category) => category.active)
        .map((category) => category.name)
        .concat(products.map((product) => product.category));

      return Array.from(new Set(categoryNames))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }

    function exportInventoryRows(options) {
      return reports.exportInventoryRows(reportState(), options);
    }

    function reportState() {
      return {
        products,
        purchases,
        sales,
        adjustments,
        transfers,
        warehouses
      };
    }

    function snapshot() {
      return {
        products: products.map(copyProduct),
        partners: partners.map(copyPartner),
        productCategories: productCategories.map(copyProductCategory),
        warehouses: warehouses.map(copyWarehouse),
        adjustments: adjustments.map(copyAdjustment),
        transfers: transfers.map(copyTransfer),
        purchases: purchases.map(copyPurchase),
        sales: sales.map(copySale)
      };
    }

    function stockForProduct(productId, warehouseId) {
      return reports.stockForProduct(reportState(), productId, warehouseId);
    }

    function findProduct(id) {
      return products.find((product) => product.id === Number(id)) || null;
    }

    function findPartner(id) {
      return partners.find((partner) => partner.id === Number(id)) || null;
    }

    function findWarehouse(id) {
      return warehouses.find((warehouse) => warehouse.id === Number(id)) || null;
    }

    function defaultWarehouseId() {
      const active = warehouses
        .filter((warehouse) => warehouse.active)
        .sort((a, b) => a.id - b.id)[0];
      const first = active || warehouses.slice().sort((a, b) => a.id - b.id)[0] || defaultWarehouse();
      return first.id;
    }

    function resolveActiveWarehouse(id) {
      const warehouseId = Number(id);
      const warehouse = warehouseId ? findWarehouse(warehouseId) : findWarehouse(defaultWarehouseId());
      return warehouse && warehouse.active ? warehouse : null;
    }

    return {
      addProduct,
      addPurchase,
      addSale,
      categories,
      dashboard,
      deactivateProduct,
      deactivatePartner,
      addPartner,
      addProductCategory,
      addWarehouse,
      addStockAdjustment,
      addStockCount,
      addTransferOrder,
      exportInventoryRows,
      grossProfitRanking,
      warehouseStockSummary,
      productWarehouseSummary,
      warehouseTransferSummary,
      inventoryReport,
      listPartners,
      listProductCategories,
      listWarehouses,
      listProducts,
      listPurchases,
      listSales,
      listAdjustments,
      listTransfers,
      addPurchaseOrder,
      addSaleOrder,
      reportSummary,
      removePurchase,
      removeSale,
      snapshot,
      stockMovements,
      updatePartner,
      updateProduct,
      deactivateProductCategory,
      deactivateWarehouse
    };
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

  function nextId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
  }

  function sameSku(left, right) {
    return normalizeText(left).toUpperCase() === normalizeText(right).toUpperCase();
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

  global.createInventoryStore = createInventoryStore;

  if (typeof module !== "undefined") {
    module.exports = { createInventoryStore };
  }
})(typeof window !== "undefined" ? window : globalThis);
