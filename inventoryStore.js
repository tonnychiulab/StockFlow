(function (global) {
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
      const filter = Object.assign({ query: "", category: "", lowStockOnly: false, sort: "sku" }, options);
      const query = normalizeText(filter.query).toLowerCase();

      const reportWarehouses = warehousesForReport(filter.warehouseId);
      const rows = products
        .filter((product) => !filter.category || product.category === filter.category)
        .reduce((result, product) => result.concat(reportWarehouses.map((warehouse) => stockForProduct(product.id, warehouse.id))), [])
        .filter((item) => {
          if (!query) {
            return true;
          }

          return [
            item.product && item.product.sku,
            item.product && item.product.name,
            item.product && item.product.category,
            item.warehouse && item.warehouse.code,
            item.warehouse && item.warehouse.name
          ].some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .filter((item) => !filter.lowStockOnly || item.lowStock);

      return sortInventoryRows(rows, filter.sort);
    }

    function dashboard() {
      const stock = inventoryReport();
      const activeProducts = products.filter((product) => product.active).length;

      return {
        activeProducts,
        stockValue: stock.reduce((total, item) => total + item.stockValue, 0),
        lowStockCount: stock.filter((item) => item.lowStock).length,
        revenue: stock.reduce((total, item) => total + item.revenue, 0),
        grossProfit: stock.reduce((total, item) => total + item.grossProfit, 0)
      };
    }

    function grossProfitRanking(limit) {
      return inventoryReport()
        .filter((item) => item.revenue > 0)
        .sort((a, b) => b.grossProfit - a.grossProfit || b.revenue - a.revenue)
        .slice(0, limit || 5);
    }

    function warehouseStockSummary(options) {
      const rows = inventoryReport(options);
      const summaries = new Map();

      rows.forEach((row) => {
        const key = row.warehouseId || 0;
        const summary = summaries.get(key) || {
          warehouse: row.warehouse ? copyWarehouse(row.warehouse) : null,
          warehouseId: key,
          productCount: 0,
          onHand: 0,
          stockValue: 0,
          lowStockCount: 0
        };

        summary.productCount += row.onHand !== 0 || row.lowStock ? 1 : 0;
        summary.onHand += row.onHand;
        summary.stockValue += row.stockValue;
        summary.lowStockCount += row.lowStock ? 1 : 0;
        summaries.set(key, summary);
      });

      return Array.from(summaries.values())
        .sort((a, b) => normalizeText(a.warehouse && a.warehouse.code).localeCompare(normalizeText(b.warehouse && b.warehouse.code)));
    }

    function productWarehouseSummary(options) {
      const rows = inventoryReport(options);
      const summaries = new Map();

      rows.forEach((row) => {
        const key = row.productId;
        const summary = summaries.get(key) || {
          product: row.product ? copyProduct(row.product) : null,
          productId: row.productId,
          totalOnHand: 0,
          stockValue: 0,
          lowStockCount: 0,
          warehouses: []
        };

        summary.totalOnHand += row.onHand;
        summary.stockValue += row.stockValue;
        summary.lowStockCount += row.lowStock ? 1 : 0;
        summary.warehouses.push({
          warehouse: row.warehouse ? copyWarehouse(row.warehouse) : null,
          warehouseId: row.warehouseId,
          onHand: row.onHand,
          lowStock: row.lowStock
        });
        summaries.set(key, summary);
      });

      return Array.from(summaries.values())
        .sort((a, b) => a.product.sku.localeCompare(b.product.sku));
    }

    function reportSummary(options) {
      const filter = Object.assign({ month: "" }, options);
      const purchaseRows = listPurchases({ month: filter.month });
      const saleRows = listSales({ month: filter.month });
      const purchaseCost = purchaseRows.reduce((total, item) => total + item.quantity * item.unitCost, 0);
      const purchaseQuantity = purchaseRows.reduce((total, item) => total + item.quantity, 0);
      const salesRevenue = saleRows.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
      const salesQuantity = saleRows.reduce((total, item) => total + item.quantity, 0);
      const grossProfit = saleRows.reduce((total, item) => {
        const product = findProduct(item.productId);
        return total + item.quantity * (item.unitPrice - (product ? product.cost : 0));
      }, 0);

      return {
        purchaseCost,
        purchaseQuantity,
        purchaseCount: purchaseRows.length,
        salesRevenue,
        salesQuantity,
        salesCount: saleRows.length,
        grossProfit,
        marginRate: salesRevenue > 0 ? grossProfit / salesRevenue : 0
      };
    }

    function stockMovements(options) {
      const filter = Object.assign({ month: "", query: "" }, options);
      const query = normalizeText(filter.query).toLowerCase();
      const purchaseMovements = purchases.map((purchase) => {
        const product = findProduct(purchase.productId);
        const warehouse = findWarehouse(purchase.warehouseId);
        return {
          id: `purchase-${purchase.id}`,
          sourceId: purchase.id,
          type: "purchase",
          label: "進貨",
          date: purchase.date,
          productId: purchase.productId,
          warehouseId: purchase.warehouseId,
          warehouseCode: warehouse ? warehouse.code : "",
          warehouseName: warehouse ? warehouse.name : "",
          sku: product ? product.sku : "",
          productName: product ? product.name : "未知商品",
          quantity: purchase.quantity,
          amount: purchase.quantity * purchase.unitCost,
          party: purchase.supplier,
          note: purchase.note
          ,
          documentNo: purchase.documentNo
        };
      });
      const saleMovements = sales.map((sale) => {
        const product = findProduct(sale.productId);
        const warehouse = findWarehouse(sale.warehouseId);
        return {
          id: `sale-${sale.id}`,
          sourceId: sale.id,
          type: "sale",
          label: "銷售",
          date: sale.date,
          productId: sale.productId,
          warehouseId: sale.warehouseId,
          warehouseCode: warehouse ? warehouse.code : "",
          warehouseName: warehouse ? warehouse.name : "",
          sku: product ? product.sku : "",
          productName: product ? product.name : "未知商品",
          quantity: -sale.quantity,
          amount: sale.quantity * sale.unitPrice,
          party: sale.customer,
          note: sale.note
          ,
          documentNo: sale.documentNo
        };
      });
      const adjustmentMovements = adjustments.map((adjustment) => {
        const product = findProduct(adjustment.productId);
        const warehouse = findWarehouse(adjustment.warehouseId);
        return {
          id: `adjustment-${adjustment.id}`,
          sourceId: adjustment.id,
          type: "adjustment",
          label: "調整",
          date: adjustment.date,
          productId: adjustment.productId,
          warehouseId: adjustment.warehouseId,
          warehouseCode: warehouse ? warehouse.code : "",
          warehouseName: warehouse ? warehouse.name : "",
          sku: product ? product.sku : "",
          productName: product ? product.name : "未知商品",
          quantity: adjustment.quantity,
          amount: Math.abs(adjustment.quantity) * (product ? product.cost : 0),
          party: adjustment.reason,
          note: adjustment.note,
          documentNo: adjustment.documentNo
        };
      });

      return purchaseMovements
        .concat(saleMovements)
        .concat(adjustmentMovements)
        .filter((item) => !filter.month || item.date.slice(0, 7) === filter.month)
        .filter((item) => {
          if (!query) {
            return true;
          }

          return [item.sku, item.productName, item.warehouseCode, item.warehouseName, item.documentNo, item.party, item.note, item.label]
            .some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
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
      return inventoryReport(options).map((item) => ({
        sku: item.product.sku,
        name: item.product.name,
        warehouse: item.warehouse ? `${item.warehouse.code} ${item.warehouse.name}` : "",
        category: item.product.category,
        unit: item.product.unit,
        onHand: item.onHand,
        adjusted: item.adjusted,
        cost: item.product.cost,
        price: item.product.price,
        safetyStock: item.product.safetyStock,
        stockValue: item.stockValue,
        revenue: item.revenue,
        grossProfit: item.grossProfit,
        lowStock: item.lowStock ? "yes" : "no"
      }));
    }

    function snapshot() {
      return {
        products: products.map(copyProduct),
        partners: partners.map(copyPartner),
        productCategories: productCategories.map(copyProductCategory),
        warehouses: warehouses.map(copyWarehouse),
        adjustments: adjustments.map(copyAdjustment),
        purchases: purchases.map(copyPurchase),
        sales: sales.map(copySale)
      };
    }

    function stockForProduct(productId, warehouseId) {
      const product = findProduct(productId);
      const warehouse = warehouseId ? findWarehouse(warehouseId) : null;
      const purchased = purchases
        .filter((purchase) => purchase.productId === Number(productId) && (!warehouseId || purchase.warehouseId === Number(warehouseId)))
        .reduce((total, purchase) => total + purchase.quantity, 0);
      const sold = sales
        .filter((sale) => sale.productId === Number(productId) && (!warehouseId || sale.warehouseId === Number(warehouseId)))
        .reduce((total, sale) => total + sale.quantity, 0);
      const adjusted = adjustments
        .filter((adjustment) => adjustment.productId === Number(productId) && (!warehouseId || adjustment.warehouseId === Number(warehouseId)))
        .reduce((total, adjustment) => total + adjustment.quantity, 0);
      const revenue = sales
        .filter((sale) => sale.productId === Number(productId) && (!warehouseId || sale.warehouseId === Number(warehouseId)))
        .reduce((total, sale) => total + sale.quantity * sale.unitPrice, 0);
      const onHand = purchased + adjusted - sold;
      const cost = product ? product.cost : 0;

      return {
        product: product ? copyProduct(product) : null,
        productId: Number(productId),
        warehouse: warehouse ? copyWarehouse(warehouse) : null,
        warehouseId: warehouse ? warehouse.id : 0,
        onHand,
        purchased,
        sold,
        adjusted,
        stockValue: onHand * cost,
        revenue,
        grossProfit: revenue - sold * cost,
        lowStock: product ? onHand <= product.safetyStock : false
      };
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
      const warehouse = findWarehouse(id) || findWarehouse(defaultWarehouseId());
      if (warehouse && warehouse.active) {
        return warehouse;
      }

      return warehouses.find((item) => item.active) || warehouse || null;
    }

    function warehousesForReport(warehouseId) {
      if (warehouseId) {
        const warehouse = findWarehouse(warehouseId);
        return warehouse ? [warehouse] : [];
      }

      const active = warehouses.filter((warehouse) => warehouse.active);
      return active.length ? active : warehouses;
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
      exportInventoryRows,
      grossProfitRanking,
      warehouseStockSummary,
      productWarehouseSummary,
      inventoryReport,
      listPartners,
      listProductCategories,
      listWarehouses,
      listProducts,
      listPurchases,
      listSales,
      listAdjustments,
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

  function sortInventoryRows(rows, sort) {
    const bySkuAndWarehouse = (a, b) => a.product.sku.localeCompare(b.product.sku)
      || normalizeText(a.warehouse && a.warehouse.code).localeCompare(normalizeText(b.warehouse && b.warehouse.code));

    return rows.slice().sort((a, b) => {
      if (sort === "onHandAsc") {
        return a.onHand - b.onHand || bySkuAndWarehouse(a, b);
      }

      if (sort === "stockValueDesc") {
        return b.stockValue - a.stockValue || bySkuAndWarehouse(a, b);
      }

      if (sort === "grossProfitDesc") {
        return b.grossProfit - a.grossProfit || bySkuAndWarehouse(a, b);
      }

      if (sort === "lowStockFirst") {
        return Number(b.lowStock) - Number(a.lowStock) || a.onHand - b.onHand || bySkuAndWarehouse(a, b);
      }

      return bySkuAndWarehouse(a, b);
    });
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
