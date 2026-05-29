const assert = require("node:assert/strict");
const { createInventoryStore } = require("./inventoryStore");

const store = createInventoryStore({
  products: [
    { id: 1, sku: "A001", name: "Coffee Beans", category: "Food", unit: "bag", cost: 250, price: 420, safetyStock: 5, active: true }
  ],
  purchases: [],
  sales: []
});

assert.equal(store.addProduct({ sku: "A001", name: "Duplicate", category: "Food", unit: "bag", cost: 1, price: 2, safetyStock: 0 }), null);
assert.equal(store.addProduct({ sku: "B002", name: "Tea", category: "Drink", unit: "box", cost: 120, price: 260, safetyStock: 3 }).sku, "B002");
assert.equal(store.addProduct({ sku: "", name: "Bad", category: "Other", unit: "pc", cost: 1, price: 2, safetyStock: 0 }), null);
assert.equal(store.updateProduct(2, { sku: "B002", name: "Tea Box", category: "Drink", unit: "box", cost: 130, price: 280, safetyStock: 4 }).name, "Tea Box");
assert.equal(store.updateProduct(2, { sku: "A001", name: "Bad SKU", category: "Drink", unit: "box", cost: 130, price: 280, safetyStock: 4 }).error, "DUPLICATE_SKU");
assert.equal(store.updateProduct(999, { sku: "X", name: "Missing", category: "Other", unit: "pc", cost: 1, price: 2, safetyStock: 0 }), null);
assert.equal(store.addPartner({ role: "supplier", name: "Vendor", contact: "Ann", phone: "100", note: "Main" }).name, "Vendor");
assert.equal(store.addPartner({ role: "customer", name: "Retail", contact: "Ben", phone: "200", note: "Shop" }).role, "customer");
assert.equal(store.addPartner({ role: "supplier", name: "Vendor" }), null);
assert.equal(store.updatePartner(1, { role: "supplier", name: "Vendor Prime", contact: "Ann", phone: "101", note: "Updated" }).name, "Vendor Prime");
assert.equal(store.listPartners({ role: "supplier", query: "prime" }).length, 1);
assert.equal(store.deactivatePartner(1).active, false);
assert.equal(store.listPartners({ role: "supplier", activeOnly: true }).length, 0);

assert.equal(store.addPurchase({ productId: 1, quantity: 10, unitCost: 260, supplier: "Vendor", date: "2026-05-10", note: "PO-1" }).quantity, 10);
assert.equal(store.inventoryReport().find((item) => item.productId === 1).onHand, 10);
assert.equal(store.listPurchases({ query: "vendor", month: "2026-05" }).length, 1);
assert.equal(store.listPurchases({ query: "vendor", month: "2026-04" }).length, 0);

assert.equal(store.addSale({ productId: 1, quantity: 4, unitPrice: 450, customer: "Retail", date: "2026-05-11", note: "SO-1" }).quantity, 4);
assert.equal(store.inventoryReport().find((item) => item.productId === 1).onHand, 6);
assert.equal(store.addSale({ productId: 1, quantity: 99, unitPrice: 450, customer: "Retail", date: "2026-05-12" }).error, "INSUFFICIENT_STOCK");
assert.equal(store.listSales({ query: "retail", month: "2026-05" }).length, 1);
assert.equal(store.listSales({ query: "retail", month: "2026-04" }).length, 0);
assert.equal(store.reportSummary({ month: "2026-05" }).salesRevenue, 1800);
assert.equal(store.reportSummary({ month: "2026-05" }).purchaseCost, 2600);
assert.equal(store.reportSummary({ month: "2026-05" }).salesQuantity, 4);
assert.equal(store.stockMovements({ month: "2026-05" }).length, 2);
assert.equal(store.stockMovements({ query: "vendor" })[0].type, "purchase");
assert.equal(store.stockMovements({ query: "retail" }).some((item) => item.quantity < 0), true);

const stock = store.inventoryReport().find((item) => item.productId === 1);
assert.equal(stock.purchased, 10);
assert.equal(stock.sold, 4);
assert.equal(stock.revenue, 1800);
assert.equal(stock.grossProfit, 760);
assert.equal(stock.lowStock, false);

store.addSale({ productId: 1, quantity: 1, unitPrice: 450, customer: "Retail", date: "2026-05-13" });
assert.equal(store.inventoryReport({ lowStockOnly: true }).some((item) => item.productId === 1), true);
assert.equal(store.exportInventoryRows().some((row) => row.sku === "A001" && row.lowStock === "yes"), true);
assert.equal(store.inventoryReport({ sort: "lowStockFirst" })[0].lowStock, true);
assert.equal(store.inventoryReport({ sort: "grossProfitDesc" })[0].productId, 1);

const dashboard = store.dashboard();
assert.equal(dashboard.activeProducts, 2);
assert.equal(dashboard.lowStockCount >= 1, true);
assert.equal(store.grossProfitRanking(1)[0].product.sku, "A001");
assert.equal(store.removeSale(2), true);
assert.equal(store.inventoryReport().find((item) => item.productId === 1).onHand, 6);
assert.equal(store.removePurchase(1).error, "NEGATIVE_STOCK");
assert.equal(store.removeSale(1), true);
assert.equal(store.removePurchase(1), true);
assert.equal(store.inventoryReport().find((item) => item.productId === 1).onHand, 0);
assert.equal(store.removeSale(999), false);
assert.equal(store.removePurchase(999), false);

const orderStore = createInventoryStore({
  products: [
    { id: 1, sku: "A001", name: "Coffee Beans", category: "Food", unit: "bag", cost: 250, price: 420, safetyStock: 5, active: true },
    { id: 2, sku: "B002", name: "Tea Box", category: "Drink", unit: "box", cost: 120, price: 260, safetyStock: 3, active: true }
  ],
  purchases: [],
  sales: []
});
const purchaseOrder = orderStore.addPurchaseOrder({
  supplier: "Vendor Prime",
  date: "2026-05-14",
  note: "PO batch",
  items: [
    { productId: 1, quantity: 2, unitCost: 270 },
    { productId: 2, quantity: 3, unitCost: 140 }
  ]
});
assert.equal(purchaseOrder.documentNo, "PO-202605-001");
assert.equal(purchaseOrder.lines.length, 2);
assert.equal(purchaseOrder.total, 960);
assert.equal(orderStore.listPurchases({ query: "PO-202605-001" }).length, 2);

const saleOrder = orderStore.addSaleOrder({
  customer: "Retail",
  date: "2026-05-15",
  note: "SO batch",
  items: [
    { productId: 1, quantity: 1, unitPrice: 460 },
    { productId: 2, quantity: 2, unitPrice: 290 }
  ]
});
assert.equal(saleOrder.documentNo, "SO-202605-001");
assert.equal(saleOrder.lines.length, 2);
assert.equal(saleOrder.total, 1040);
assert.equal(orderStore.listSales({ query: "SO-202605-001" }).length, 2);
assert.equal(orderStore.addSaleOrder({ customer: "Retail", date: "2026-05-16", items: [{ productId: 2, quantity: 99, unitPrice: 290 }] }).error, "INSUFFICIENT_STOCK");

const adjustmentStore = createInventoryStore({
  products: [
    { id: 1, sku: "A001", name: "Coffee Beans", category: "Food", unit: "bag", cost: 250, price: 420, safetyStock: 5, active: true }
  ],
  purchases: [
    { id: 1, productId: 1, quantity: 10, unitCost: 250, supplier: "Vendor", date: "2026-05-10", note: "Start" }
  ],
  sales: [
    { id: 1, productId: 1, quantity: 4, unitPrice: 450, customer: "Retail", date: "2026-05-11", note: "Sold" }
  ],
  adjustments: []
});
const stockCount = adjustmentStore.addStockCount({
  productId: 1,
  countedQuantity: 8,
  reason: "Count",
  date: "2026-05-12",
  note: "Shelf count"
});
assert.equal(stockCount.documentNo, "ADJ-202605-001");
assert.equal(stockCount.quantity, 2);
assert.equal(adjustmentStore.inventoryReport().find((item) => item.productId === 1).adjusted, 2);
assert.equal(adjustmentStore.inventoryReport().find((item) => item.productId === 1).onHand, 8);
assert.equal(adjustmentStore.listAdjustments({ query: "shelf", month: "2026-05" }).length, 1);
assert.equal(adjustmentStore.stockMovements({ query: "ADJ-202605-001" })[0].type, "adjustment");
assert.equal(adjustmentStore.addStockCount({ productId: 1, countedQuantity: 8, reason: "Same", date: "2026-05-13" }).error, "NO_DIFFERENCE");
assert.equal(adjustmentStore.exportInventoryRows()[0].adjusted, 2);

console.log("inventoryStore tests passed");
