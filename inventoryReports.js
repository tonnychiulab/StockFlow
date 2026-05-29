(function (global) {
  const utils = global.StockFlowUtils || (typeof require !== "undefined" ? require("./inventoryUtils") : {});
  const models = global.StockFlowModels || (typeof require !== "undefined" ? require("./inventoryModels") : {});
  const { normalizeText } = utils;
  const { copyProduct, copyWarehouse } = models;

  function inventoryReport(state, options) {
    const filter = Object.assign({ query: "", category: "", lowStockOnly: false, sort: "sku" }, options);
    const query = normalizeText(filter.query).toLowerCase();
    const rows = state.products
      .filter((product) => !filter.category || product.category === filter.category)
      .reduce((result, product) => result.concat(warehousesForReport(state, filter.warehouseId).map((warehouse) => stockForProduct(state, product.id, warehouse.id))), [])
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

  function dashboard(state) {
    const stock = inventoryReport(state);
    const activeProducts = state.products.filter((product) => product.active).length;

    return {
      activeProducts,
      stockValue: stock.reduce((total, item) => total + item.stockValue, 0),
      lowStockCount: stock.filter((item) => item.lowStock).length,
      revenue: stock.reduce((total, item) => total + item.revenue, 0),
      grossProfit: stock.reduce((total, item) => total + item.grossProfit, 0)
    };
  }

  function grossProfitRanking(state, limit) {
    return inventoryReport(state)
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.grossProfit - a.grossProfit || b.revenue - a.revenue)
      .slice(0, limit || 5);
  }

  function warehouseStockSummary(state, options) {
    const summaries = new Map();

    inventoryReport(state, options).forEach((row) => {
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

  function productWarehouseSummary(state, options) {
    const summaries = new Map();

    inventoryReport(state, options).forEach((row) => {
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

  function reportSummary(state, options) {
    const filter = Object.assign({ month: "" }, options);
    const purchaseRows = filterByMonth(state.purchases, filter.month);
    const saleRows = filterByMonth(state.sales, filter.month);
    const purchaseCost = purchaseRows.reduce((total, item) => total + item.quantity * item.unitCost, 0);
    const purchaseQuantity = purchaseRows.reduce((total, item) => total + item.quantity, 0);
    const salesRevenue = saleRows.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    const salesQuantity = saleRows.reduce((total, item) => total + item.quantity, 0);
    const grossProfit = saleRows.reduce((total, item) => {
      const product = findProduct(state, item.productId);
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

  function stockMovements(state, options) {
    const filter = Object.assign({ month: "", query: "" }, options);
    const query = normalizeText(filter.query).toLowerCase();
    const purchaseMovements = state.purchases.map((purchase) => {
      const product = findProduct(state, purchase.productId);
      const warehouse = findWarehouse(state, purchase.warehouseId);
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
        note: purchase.note,
        documentNo: purchase.documentNo
      };
    });
    const saleMovements = state.sales.map((sale) => {
      const product = findProduct(state, sale.productId);
      const warehouse = findWarehouse(state, sale.warehouseId);
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
        note: sale.note,
        documentNo: sale.documentNo
      };
    });
    const adjustmentMovements = state.adjustments.map((adjustment) => {
      const product = findProduct(state, adjustment.productId);
      const warehouse = findWarehouse(state, adjustment.warehouseId);
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

  function exportInventoryRows(state, options) {
    return inventoryReport(state, options).map((item) => ({
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

  function stockForProduct(state, productId, warehouseId) {
    const product = findProduct(state, productId);
    const warehouse = warehouseId ? findWarehouse(state, warehouseId) : null;
    const purchased = state.purchases
      .filter((purchase) => purchase.productId === Number(productId) && (!warehouseId || purchase.warehouseId === Number(warehouseId)))
      .reduce((total, purchase) => total + purchase.quantity, 0);
    const sold = state.sales
      .filter((sale) => sale.productId === Number(productId) && (!warehouseId || sale.warehouseId === Number(warehouseId)))
      .reduce((total, sale) => total + sale.quantity, 0);
    const adjusted = state.adjustments
      .filter((adjustment) => adjustment.productId === Number(productId) && (!warehouseId || adjustment.warehouseId === Number(warehouseId)))
      .reduce((total, adjustment) => total + adjustment.quantity, 0);
    const revenue = state.sales
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

  function warehousesForReport(state, warehouseId) {
    if (warehouseId) {
      const warehouse = findWarehouse(state, warehouseId);
      return warehouse ? [warehouse] : [];
    }

    const active = state.warehouses.filter((warehouse) => warehouse.active);
    return active.length ? active : state.warehouses;
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

  function filterByMonth(rows, month) {
    return rows.filter((row) => !month || row.date.slice(0, 7) === month);
  }

  function findProduct(state, id) {
    return state.products.find((product) => product.id === Number(id)) || null;
  }

  function findWarehouse(state, id) {
    return state.warehouses.find((warehouse) => warehouse.id === Number(id)) || null;
  }

  const api = {
    inventoryReport,
    dashboard,
    grossProfitRanking,
    warehouseStockSummary,
    productWarehouseSummary,
    reportSummary,
    stockMovements,
    exportInventoryRows,
    stockForProduct
  };

  global.StockFlowReports = api;

  if (typeof module !== "undefined") {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
