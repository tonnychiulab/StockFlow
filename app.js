const appVersion = "1.15.2";
const assetVersion = "1.15.2";
const today = new Date().toISOString().slice(0, 10);

const seedState = {
  productCategories: [
    { id: 1, code: "FOOD", name: "食品", sortOrder: 10, note: "可食用商品", active: true },
    { id: 2, code: "SUPPLY", name: "用品", sortOrder: 20, note: "杯器與周邊用品", active: true }
  ],
  warehouses: [
    { id: 1, code: "MAIN", name: "主倉", type: "warehouse", note: "預設倉庫", active: true },
    { id: 2, code: "STORE", name: "門市", type: "store", note: "前台銷售區", active: true }
  ],
  products: [
    { id: 1, sku: "P-COF-001", name: "精品咖啡豆", category: "食品", unit: "包", cost: 260, price: 450, safetyStock: 5, active: true },
    { id: 2, sku: "P-MUG-002", name: "陶瓷馬克杯", category: "用品", unit: "個", cost: 120, price: 280, safetyStock: 8, active: true },
    { id: 3, sku: "P-TEA-003", name: "冷泡茶包", category: "食品", unit: "盒", cost: 95, price: 180, safetyStock: 10, active: true }
  ],
  partners: [
    { id: 1, role: "supplier", name: "晨光供應", contact: "林小姐", phone: "02-2345-1000", note: "咖啡豆與包材", active: true },
    { id: 2, role: "supplier", name: "器物社", contact: "陳先生", phone: "02-2345-2000", note: "杯器用品", active: true },
    { id: 3, role: "customer", name: "門市客", contact: "", phone: "", note: "一般零售", active: true },
    { id: 4, role: "customer", name: "團購", contact: "王小姐", phone: "09-0000-0000", note: "小批量訂單", active: true }
  ],
  purchases: [
    { id: 1, productId: 1, quantity: 18, unitCost: 260, supplier: "晨光供應", date: today, note: "首批進貨" },
    { id: 2, productId: 2, quantity: 12, unitCost: 120, supplier: "器物社", date: today, note: "門市補貨" },
    { id: 3, productId: 3, quantity: 20, unitCost: 95, supplier: "茶園合作社", date: today, note: "新品上架" }
  ],
  sales: [
    { id: 1, productId: 1, quantity: 13, unitPrice: 450, customer: "門市客", date: today, note: "零售" },
    { id: 2, productId: 2, quantity: 3, unitPrice: 280, customer: "門市客", date: today, note: "零售" },
    { id: 3, productId: 3, quantity: 5, unitPrice: 180, customer: "團購", date: today, note: "小批量" }
  ],
  adjustments: [
    { id: 1, productId: 2, quantity: -1, reason: "盤點差異", date: today, note: "展示品耗損", documentNo: "ADJ-202605-001" }
  ],
  transfers: []
};

const storage = StockFlowStorage.createInventoryStorage({ seedState, appVersion, assetVersion });
const initialLoad = storage.loadState();
let store = createInventoryStore(initialLoad.state);
let activeTab = "overview";
let editingProductId = null;
let editingPartnerId = null;
let pendingRestoreState = null;

const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");
const statusLine = document.querySelector("#status-line");
const productForm = document.querySelector("#product-form");
const productFormTitle = document.querySelector("#product-form-title");
const productSubmitButton = document.querySelector("#product-submit-button");
const cancelProductEdit = document.querySelector("#cancel-product-edit");
const partnerForm = document.querySelector("#partner-form");
const partnerFormTitle = document.querySelector("#partner-form-title");
const partnerSubmitButton = document.querySelector("#partner-submit-button");
const cancelPartnerEdit = document.querySelector("#cancel-partner-edit");
const categoryForm = document.querySelector("#category-form");
const warehouseForm = document.querySelector("#warehouse-form");
const purchaseForm = document.querySelector("#purchase-form");
const saleForm = document.querySelector("#sale-form");
const adjustmentForm = document.querySelector("#adjustment-form");
const transferForm = document.querySelector("#transfer-form");
const productQuery = document.querySelector("#product-query");
const productCategoryFilter = document.querySelector("#product-category-filter");
const categoryQuery = document.querySelector("#category-query");
const warehouseQuery = document.querySelector("#warehouse-query");
const partnerQuery = document.querySelector("#partner-query");
const partnerRoleFilter = document.querySelector("#partner-role-filter");
const purchaseQuery = document.querySelector("#purchase-query");
const purchaseMonth = document.querySelector("#purchase-month");
const saleQuery = document.querySelector("#sale-query");
const saleMonth = document.querySelector("#sale-month");
const adjustmentQuery = document.querySelector("#adjustment-query");
const adjustmentMonth = document.querySelector("#adjustment-month");
const transferQuery = document.querySelector("#transfer-query");
const transferMonth = document.querySelector("#transfer-month");
const reportMonth = document.querySelector("#report-month");
const movementQuery = document.querySelector("#movement-query");
const stockQuery = document.querySelector("#stock-query");
const categoryFilter = document.querySelector("#category-filter");
const warehouseFilter = document.querySelector("#warehouse-filter");
const stockSort = document.querySelector("#stock-sort");
const lowStockOnly = document.querySelector("#low-stock-only");
const exportButton = document.querySelector("#export-button");
const resetButton = document.querySelector("#reset-button");
const backupExportButton = document.querySelector("#backup-export-button");
const backupFileInput = document.querySelector("#backup-file-input");
const restoreButton = document.querySelector("#restore-button");
const backupPreview = document.querySelector("#backup-preview");

setDefaultDates();
document.querySelector("#app-version").textContent = `v${appVersion}`;
bindEvents();
render();
if (initialLoad.notice) {
  setStatus(initialLoad.notice);
}

function bindEvents() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      render();
    });
  });

  productForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(productForm));
    const wasEditing = Boolean(editingProductId);
    const product = wasEditing
      ? store.updateProduct(editingProductId, data)
      : store.addProduct(data);

    if (!product) {
      setStatus(StockFlowMessages.message("productSaveFailed"), true);
      return;
    }

    if (product.error === "DUPLICATE_SKU") {
      setStatus(StockFlowMessages.message("duplicateSku"), true);
      return;
    }

    resetProductForm();
    saveState();
    setStatus(`${wasEditing ? "已更新" : "已新增"}商品：${product.name}`);
    render();
  });

  cancelProductEdit.addEventListener("click", () => {
    resetProductForm();
    setStatus("已取消商品編輯。");
    renderProducts();
  });

  partnerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(partnerForm));
    const wasEditing = Boolean(editingPartnerId);
    const partner = wasEditing
      ? store.updatePartner(editingPartnerId, data)
      : store.addPartner(data);

    if (!partner) {
      setStatus(StockFlowMessages.message("partnerSaveFailed"), true);
      return;
    }

    if (partner.error === "DUPLICATE_PARTNER") {
      setStatus(StockFlowMessages.message("duplicatePartner"), true);
      return;
    }

    resetPartnerForm();
    saveState();
    setStatus(`${wasEditing ? "已更新" : "已新增"}往來對象：${partner.name}`);
    render();
  });

  cancelPartnerEdit.addEventListener("click", () => {
    resetPartnerForm();
    setStatus("已取消往來對象編輯。");
    renderPartners();
  });

  categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const category = store.addProductCategory(Object.fromEntries(new FormData(categoryForm)));

    if (!category) {
      setStatus(StockFlowMessages.message("categorySaveFailed"), true);
      return;
    }

    categoryForm.reset();
    categoryForm.elements.sortOrder.value = "10";
    saveState();
    setStatus(`已新增產品類別：${category.name}`);
    render();
  });

  warehouseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const warehouse = store.addWarehouse(Object.fromEntries(new FormData(warehouseForm)));

    if (!warehouse) {
      setStatus(StockFlowMessages.message("warehouseSaveFailed"), true);
      return;
    }

    warehouseForm.reset();
    saveState();
    setStatus(`已新增倉庫：${warehouse.name}`);
    render();
  });

  purchaseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(purchaseForm));
    const purchase = store.addPurchaseOrder({
      supplier: data.supplier,
      warehouseId: data.warehouseId,
      date: data.date,
      note: data.note,
      items: collectOrderItems(data, "unitCost")
    });

    if (!purchase) {
      setStatus(StockFlowMessages.transactionError(purchase, "purchaseOrderFailed"), true);
      return;
    }

    purchaseForm.reset();
    setDefaultDates();
    saveState();
    setStatus(`已建立採購單 ${purchase.documentNo}，共 ${purchase.lines.length} 筆明細。`);
    render();
  });

  saleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(saleForm));
    const sale = store.addSaleOrder({
      customer: data.customer,
      warehouseId: data.warehouseId,
      date: data.date,
      note: data.note,
      items: collectOrderItems(data, "unitPrice")
    });

    if (!sale) {
      setStatus(StockFlowMessages.message("saleOrderFailed"), true);
      return;
    }

    if (sale.error === "INSUFFICIENT_STOCK") {
      setStatus(StockFlowMessages.transactionError(sale, "saleOrderFailed"), true);
      return;
    }

    saleForm.reset();
    setDefaultDates();
    saveState();
    setStatus(`已建立銷售單 ${sale.documentNo}，共 ${sale.lines.length} 筆明細。`);
    render();
  });

  adjustmentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(adjustmentForm));
    const adjustment = store.addStockCount(data);

    if (!adjustment) {
      setStatus(StockFlowMessages.message("adjustmentFailed"), true);
      return;
    }

    if (adjustment.error === "NO_DIFFERENCE") {
      setStatus(StockFlowMessages.transactionError(adjustment, "adjustmentFailed"));
      return;
    }

    adjustmentForm.reset();
    setDefaultDates();
    saveState();
    setStatus(`已建立盤點調整 ${adjustment.documentNo}，異動 ${adjustment.quantity > 0 ? "+" : ""}${adjustment.quantity}。`);
    render();
  });

  transferForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(transferForm));
    const transfer = store.addTransferOrder({
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      date: data.date,
      note: data.note,
      items: collectTransferItems(data)
    });

    if (!transfer) {
      setStatus(StockFlowMessages.message("transferOrderFailed"), true);
      return;
    }

    if (transfer.error === "INSUFFICIENT_STOCK") {
      setStatus(StockFlowMessages.transactionError(transfer, "transferOrderFailed"), true);
      return;
    }

    transferForm.reset();
    setDefaultDates();
    saveState();
    setStatus(`已建立調撥單 ${transfer.documentNo}，共 ${transfer.lines.length} 筆明細。`);
    render();
  });

  document.querySelector("#product-table").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-product-id]");
    if (editButton) {
      startProductEdit(Number(editButton.dataset.editProductId));
      return;
    }

    const button = event.target.closest("[data-deactivate-id]");

    if (!button) {
      return;
    }

    const product = store.deactivateProduct(Number(button.dataset.deactivateId));

    if (product) {
      saveState();
      setStatus(`已停用商品：${product.name}`);
      render();
    }
  });

  document.querySelector("#partner-table").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-partner-id]");
    if (editButton) {
      startPartnerEdit(Number(editButton.dataset.editPartnerId));
      return;
    }

    const button = event.target.closest("[data-deactivate-partner-id]");

    if (!button) {
      return;
    }

    const partner = store.deactivatePartner(Number(button.dataset.deactivatePartnerId));

    if (partner) {
      saveState();
      setStatus(`已停用往來對象：${partner.name}`);
      render();
    }
  });

  document.querySelector("#category-table").addEventListener("click", (event) => {
    const button = event.target.closest("[data-deactivate-category-id]");

    if (!button) {
      return;
    }

    const category = store.deactivateProductCategory(Number(button.dataset.deactivateCategoryId));

    if (category) {
      saveState();
      setStatus(`已停用產品類別：${category.name}`);
      render();
    }
  });

  document.querySelector("#warehouse-table").addEventListener("click", (event) => {
    const button = event.target.closest("[data-deactivate-warehouse-id]");

    if (!button) {
      return;
    }

    const warehouse = store.deactivateWarehouse(Number(button.dataset.deactivateWarehouseId));

    if (warehouse) {
      saveState();
      setStatus(`已停用倉庫：${warehouse.name}`);
      render();
    }
  });

  document.querySelector("#purchase-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-purchase-id]");

    if (!button) {
      return;
    }

    const result = store.removePurchase(Number(button.dataset.removePurchaseId));

    if (result && result.error === "NEGATIVE_STOCK") {
      setStatus(StockFlowMessages.transactionError(result, "negativeStockOnRemove"), true);
      return;
    }

    if (result) {
      saveState();
      setStatus("已作廢進貨紀錄，庫存已重新計算。");
      render();
    }
  });

  document.querySelector("#sale-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-sale-id]");

    if (!button) {
      return;
    }

    if (store.removeSale(Number(button.dataset.removeSaleId))) {
      saveState();
      setStatus("已作廢銷售紀錄，庫存已回補。");
      render();
    }
  });

  productQuery.addEventListener("input", renderProducts);
  productCategoryFilter.addEventListener("change", renderProducts);
  categoryQuery.addEventListener("input", renderProductCategories);
  warehouseQuery.addEventListener("input", renderWarehouses);
  partnerQuery.addEventListener("input", renderPartners);
  partnerRoleFilter.addEventListener("change", renderPartners);
  purchaseQuery.addEventListener("input", renderPurchases);
  purchaseMonth.addEventListener("change", renderPurchases);
  saleQuery.addEventListener("input", renderSales);
  saleMonth.addEventListener("change", renderSales);
  adjustmentQuery.addEventListener("input", renderAdjustments);
  adjustmentMonth.addEventListener("change", renderAdjustments);
  transferQuery.addEventListener("input", renderTransfers);
  transferMonth.addEventListener("change", renderTransfers);
  reportMonth.addEventListener("change", renderReports);
  movementQuery.addEventListener("input", renderReports);
  stockQuery.addEventListener("input", renderStock);
  categoryFilter.addEventListener("change", renderStock);
  warehouseFilter.addEventListener("change", renderStock);
  stockSort.addEventListener("change", renderStock);
  lowStockOnly.addEventListener("change", renderStock);

  exportButton.addEventListener("click", () => {
    downloadCsv("inventory-report.csv", toCsv(store.exportInventoryRows(currentStockOptions())));
    setStatus("已匯出庫存 CSV。");
  });

  backupExportButton.addEventListener("click", () => {
    downloadJson(`stockflow-backup-${today}.json`, storage.createStorageEnvelope(store.snapshot()));
    setStatus("已匯出完整備份 JSON。");
  });

  backupFileInput.addEventListener("change", () => {
    pendingRestoreState = null;
    restoreButton.disabled = true;
    const file = backupFileInput.files && backupFileInput.files[0];

    if (!file) {
      backupPreview.textContent = "尚未選擇備份檔。";
      backupPreview.classList.add("empty");
      return;
    }

    readBackupFile(file);
  });

  restoreButton.addEventListener("click", () => {
    if (!pendingRestoreState) {
      return;
    }

    store = createInventoryStore(pendingRestoreState);
    pendingRestoreState = null;
    restoreButton.disabled = true;
    backupFileInput.value = "";
    saveState();
    setStatus("已完成整包還原，資料已重新載入。");
    render();
  });

  resetButton.addEventListener("click", () => {
    store = createInventoryStore(seedState);
    saveState();
    setStatus("已重置為範例資料。");
    render();
  });
}

function render() {
  renderTabs();
  renderMetrics();
  renderProductOptions();
  renderWarehouseOptions();
  renderPartnerOptions();
  renderOverview();
  renderProductCategoryOptions();
  renderProductFilters();
  renderProducts();
  renderProductCategories();
  renderWarehouses();
  renderPartners();
  renderPurchases();
  renderSales();
  renderAdjustments();
  renderTransfers();
  renderReports();
  renderStockFilters();
  renderStock();
}

function renderTabs() {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === activeTab);
  });

  views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === activeTab);
  });
}

function renderMetrics() {
  const dashboard = store.dashboard();
  document.querySelector("#metric-products").textContent = dashboard.activeProducts;
  document.querySelector("#metric-stock-value").textContent = formatMoney(dashboard.stockValue);
  document.querySelector("#metric-revenue").textContent = formatMoney(dashboard.revenue);
  document.querySelector("#metric-low-stock").textContent = dashboard.lowStockCount;
}

function renderOverview() {
  const lowStock = store.inventoryReport({ lowStockOnly: true });
  document.querySelector("#overview-low-count").textContent = `${lowStock.length} 項`;
  document.querySelector("#low-stock-list").innerHTML = lowStock.length
    ? lowStock.map((item) => `
      <article class="compact-card">
        <strong>${escapeHtml(item.product.name)}</strong>
        <span class="compact-meta">${escapeHtml(item.product.sku)} / 目前 ${item.onHand} ${escapeHtml(item.product.unit)} / 安全 ${item.product.safetyStock}</span>
      </article>
    `).join("")
    : '<div class="empty">目前沒有低庫存商品。</div>';

  const activities = store.listPurchases().slice(0, 3).map((item) => Object.assign({ kind: "進貨" }, item))
    .concat(store.listSales().slice(0, 3).map((item) => Object.assign({ kind: "銷售" }, item)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 6);

  document.querySelector("#recent-activity").innerHTML = activities.length
    ? activities.map((item) => {
      const product = productName(item.productId);
      const amount = item.kind === "進貨" ? item.quantity * item.unitCost : item.quantity * item.unitPrice;
      return `
        <article class="compact-card">
          <strong>${item.kind} / ${escapeHtml(product)}</strong>
          <span class="compact-meta">${item.date} / ${item.quantity} / ${formatMoney(amount)}</span>
        </article>
      `;
    }).join("")
    : '<div class="empty">尚無進貨或銷售紀錄。</div>';

  const ranking = store.grossProfitRanking(5);
  document.querySelector("#profit-ranking").innerHTML = ranking.length
    ? ranking.map((item, index) => `
      <article class="ranking-card">
        <strong>${index + 1}. ${escapeHtml(item.product.name)}</strong>
        <span class="compact-meta">收入 ${formatMoney(item.revenue)}</span>
        <span class="compact-meta">毛利 ${formatMoney(item.grossProfit)}</span>
        <span class="compact-meta">庫存 ${item.onHand} ${escapeHtml(item.product.unit)}</span>
      </article>
    `).join("")
    : '<div class="empty">尚無銷售資料可排行。</div>';
}

function renderProducts() {
  const products = store.listProducts({
    query: productQuery.value,
    category: productCategoryFilter.value
  });
  const body = document.querySelector("#product-table");

  body.innerHTML = products.length
    ? products.map((product) => `
      <tr>
        <td>${escapeHtml(product.sku)}</td>
        <td>
          <div class="row-title">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.unit)}</span>
          </div>
        </td>
        <td>${escapeHtml(product.category)}</td>
        <td>${formatMoney(product.cost)}</td>
        <td>${formatMoney(product.price)}</td>
        <td>${product.active ? '<span class="badge">啟用</span>' : '<span class="badge warn">停用</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="text-button" type="button" data-edit-product-id="${product.id}">編輯</button>
            ${product.active ? `<button class="text-button" type="button" data-deactivate-id="${product.id}">停用</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="7" class="empty">沒有符合條件的商品。</td></tr>';
}

function startProductEdit(productId) {
  const product = store.listProducts().find((item) => item.id === productId);

  if (!product) {
    setStatus("找不到要編輯的商品。", true);
    return;
  }

  editingProductId = product.id;
  productForm.elements.id.value = product.id;
  productForm.elements.sku.value = product.sku;
  productForm.elements.name.value = product.name;
  productForm.elements.category.value = product.category;
  productForm.elements.unit.value = product.unit;
  productForm.elements.cost.value = product.cost;
  productForm.elements.price.value = product.price;
  productForm.elements.safetyStock.value = product.safetyStock;
  productFormTitle.textContent = "編輯商品";
  productSubmitButton.textContent = "更新商品";
  cancelProductEdit.classList.remove("is-hidden");
  setStatus(`正在編輯商品：${product.name}`);
}

function resetProductForm() {
  editingProductId = null;
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.category.value = store.categories()[0] || "一般";
  productForm.elements.unit.value = "件";
  productForm.elements.safetyStock.value = "5";
  productFormTitle.textContent = "新增商品";
  productSubmitButton.textContent = "新增商品";
  cancelProductEdit.classList.add("is-hidden");
}

function renderProductCategories() {
  const categories = store.listProductCategories({ query: categoryQuery.value });
  document.querySelector("#category-count").textContent = `${categories.length} 筆`;
  document.querySelector("#category-table").innerHTML = categories.length
    ? categories.map((category) => `
      <tr>
        <td>${escapeHtml(category.code)}</td>
        <td>${escapeHtml(category.name)}</td>
        <td>${category.sortOrder}</td>
        <td>${escapeHtml(category.note || "無備註")}</td>
        <td>${category.active ? '<span class="badge">啟用</span>' : '<span class="badge warn">停用</span>'}</td>
        <td>
          <div class="table-actions">
            ${category.active ? `<button class="text-button" type="button" data-deactivate-category-id="${category.id}">停用</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">沒有符合條件的產品類別。</td></tr>';
}

function renderWarehouses() {
  const warehouses = store.listWarehouses({ query: warehouseQuery.value });
  document.querySelector("#warehouse-count").textContent = `${warehouses.length} 筆`;
  document.querySelector("#warehouse-table").innerHTML = warehouses.length
    ? warehouses.map((warehouse) => `
      <tr>
        <td>${escapeHtml(warehouse.code)}</td>
        <td>${escapeHtml(warehouse.name)}</td>
        <td>${escapeHtml(warehouseTypeLabel(warehouse.type))}</td>
        <td>${escapeHtml(warehouse.note || "無備註")}</td>
        <td>${warehouse.active ? '<span class="badge">啟用</span>' : '<span class="badge warn">停用</span>'}</td>
        <td>
          <div class="table-actions">
            ${warehouse.active ? `<button class="text-button" type="button" data-deactivate-warehouse-id="${warehouse.id}">停用</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">沒有符合條件的倉庫。</td></tr>';
}

function renderPartners() {
  const partners = store.listPartners({
    query: partnerQuery.value,
    role: partnerRoleFilter.value
  });
  const body = document.querySelector("#partner-table");

  body.innerHTML = partners.length
    ? partners.map((partner) => `
      <tr>
        <td>${partner.role === "supplier" ? "供應商" : "客戶"}</td>
        <td>
          <div class="row-title">
            <strong>${escapeHtml(partner.name)}</strong>
            <span>${escapeHtml(partner.note || "無備註")}</span>
          </div>
        </td>
        <td>${escapeHtml(partner.contact || "未填")}</td>
        <td>${escapeHtml(partner.phone || "未填")}</td>
        <td>${partner.active ? '<span class="badge">啟用</span>' : '<span class="badge warn">停用</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="text-button" type="button" data-edit-partner-id="${partner.id}">編輯</button>
            ${partner.active ? `<button class="text-button" type="button" data-deactivate-partner-id="${partner.id}">停用</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">沒有符合條件的往來對象。</td></tr>';
}

function startPartnerEdit(partnerId) {
  const partner = store.listPartners().find((item) => item.id === partnerId);

  if (!partner) {
    setStatus("找不到要編輯的往來對象。", true);
    return;
  }

  editingPartnerId = partner.id;
  partnerForm.elements.id.value = partner.id;
  partnerForm.elements.role.value = partner.role;
  partnerForm.elements.name.value = partner.name;
  partnerForm.elements.contact.value = partner.contact;
  partnerForm.elements.phone.value = partner.phone;
  partnerForm.elements.note.value = partner.note;
  partnerFormTitle.textContent = "編輯往來對象";
  partnerSubmitButton.textContent = "更新對象";
  cancelPartnerEdit.classList.remove("is-hidden");
  setStatus(`正在編輯往來對象：${partner.name}`);
}

function resetPartnerForm() {
  editingPartnerId = null;
  partnerForm.reset();
  partnerForm.elements.id.value = "";
  partnerForm.elements.role.value = "supplier";
  partnerFormTitle.textContent = "新增往來對象";
  partnerSubmitButton.textContent = "新增對象";
  cancelPartnerEdit.classList.add("is-hidden");
}

function renderPurchases() {
  const purchases = store.listPurchases({
    query: purchaseQuery.value,
    month: purchaseMonth.value
  });
  document.querySelector("#purchase-count").textContent = `${purchases.length} 筆`;
  document.querySelector("#purchase-list").innerHTML = purchases.length
    ? purchases.map((item) => `
      <article class="record-card">
        <div>
          <strong>${escapeHtml(productName(item.productId))}</strong>
          <div class="record-meta">${escapeHtml(item.documentNo || "無單號")} / ${item.date} / ${escapeHtml(warehouseName(item.warehouseId))} / ${escapeHtml(item.supplier || "未填供應商")} / ${escapeHtml(item.note || "無備註")}</div>
        </div>
        <div class="record-side">
          <span class="amount income">+${item.quantity} / ${formatMoney(item.quantity * item.unitCost)}</span>
          <button class="text-button" type="button" data-remove-purchase-id="${item.id}">作廢</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty">尚無進貨紀錄。</div>';
}

function renderSales() {
  const sales = store.listSales({
    query: saleQuery.value,
    month: saleMonth.value
  });
  document.querySelector("#sale-count").textContent = `${sales.length} 筆`;
  document.querySelector("#sale-list").innerHTML = sales.length
    ? sales.map((item) => `
      <article class="record-card">
        <div>
          <strong>${escapeHtml(productName(item.productId))}</strong>
          <div class="record-meta">${escapeHtml(item.documentNo || "無單號")} / ${item.date} / ${escapeHtml(warehouseName(item.warehouseId))} / ${escapeHtml(item.customer || "未填客戶")} / ${escapeHtml(item.note || "無備註")}</div>
        </div>
        <div class="record-side">
          <span class="amount expense">-${item.quantity} / ${formatMoney(item.quantity * item.unitPrice)}</span>
          <button class="text-button" type="button" data-remove-sale-id="${item.id}">作廢</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty">尚無銷售紀錄。</div>';
}

function renderAdjustments() {
  const adjustments = store.listAdjustments({
    query: adjustmentQuery.value,
    month: adjustmentMonth.value
  });
  document.querySelector("#adjustment-count").textContent = `${adjustments.length} 筆`;
  document.querySelector("#adjustment-list").innerHTML = adjustments.length
    ? adjustments.map((item) => `
      <article class="record-card">
        <div>
          <strong>${escapeHtml(productName(item.productId))}</strong>
          <div class="record-meta">${escapeHtml(item.documentNo || "無單號")} / ${item.date} / ${escapeHtml(warehouseName(item.warehouseId))} / ${escapeHtml(item.reason || "調整")} / ${escapeHtml(item.note || "無備註")}</div>
        </div>
        <div class="record-side">
          <span class="amount ${item.quantity >= 0 ? "income" : "expense"}">${item.quantity >= 0 ? "+" : ""}${item.quantity}</span>
        </div>
      </article>
    `).join("")
    : '<div class="empty">尚無盤點調整紀錄。</div>';
}

function renderTransfers() {
  const transfers = store.listTransfers({
    query: transferQuery.value,
    month: transferMonth.value
  });
  document.querySelector("#transfer-count").textContent = `${transfers.length} 筆`;
  document.querySelector("#transfer-list").innerHTML = transfers.length
    ? transfers.map((item) => `
      <article class="record-card">
        <div>
          <strong>${escapeHtml(productName(item.productId))}</strong>
          <div class="record-meta">${escapeHtml(item.documentNo || "無單號")} / ${item.date} / ${escapeHtml(warehouseName(item.fromWarehouseId))} -> ${escapeHtml(warehouseName(item.toWarehouseId))} / ${escapeHtml(item.note || "無備註")}</div>
        </div>
        <div class="record-side">
          <span class="amount">${item.quantity}</span>
        </div>
      </article>
    `).join("")
    : '<div class="empty">尚無調撥紀錄。</div>';
}

function renderReports() {
  StockFlowRenderers.renderReports({
    document,
    store,
    month: reportMonth.value,
    movementQuery: movementQuery.value,
    formatMoney,
    formatPercent,
    escapeHtml,
    productName,
    warehouseName,
    movementBadge
  });
}

function renderStockFilters() {
  renderCategorySelect(categoryFilter, "全部分類");
  renderWarehouseFilter(warehouseFilter, "全部倉庫");
}

function renderProductFilters() {
  renderCategorySelect(productCategoryFilter, "全部分類");
}

function renderProductCategoryOptions() {
  const categories = store.categories();
  const options = categories.map((category) => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`).join("");

  document.querySelectorAll("[data-category-select]").forEach((select) => {
    const selected = select.value;
    select.innerHTML = options || '<option value="一般">一般</option>';
    if (selected && categories.includes(selected)) {
      select.value = selected;
    }
  });
}

function renderCategorySelect(select, emptyLabel) {
  const current = select.value;
  const categories = store.categories();
  const options = [`<option value="">${escapeHtml(emptyLabel)}</option>`]
    .concat(categories.map((category) => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`));

  select.innerHTML = options.join("");
  select.value = categories.includes(current) ? current : "";
}

function renderWarehouseFilter(select, emptyLabel) {
  const current = select.value;
  const warehouses = store.listWarehouses({ activeOnly: true });
  const options = [`<option value="">${escapeHtml(emptyLabel)}</option>`]
    .concat(warehouses.map((warehouse) => `<option value="${warehouse.id}">${escapeHtml(warehouse.code)} / ${escapeHtml(warehouse.name)}</option>`));

  select.innerHTML = options.join("");
  select.value = warehouses.some((warehouse) => String(warehouse.id) === current) ? current : "";
}

function renderStock() {
  const rows = store.inventoryReport(currentStockOptions());
  const body = document.querySelector("#stock-table");

  body.innerHTML = rows.length
    ? rows.map((item) => `
      <tr>
        <td>${escapeHtml(item.product.sku)}</td>
        <td>
          <div class="row-title">
            <strong>${escapeHtml(item.product.name)}</strong>
            <span>${escapeHtml(item.product.unit)} / ${escapeHtml(item.warehouse ? item.warehouse.name : "未指定倉庫")}</span>
          </div>
        </td>
        <td>${escapeHtml(item.warehouse ? item.warehouse.code : "-")}</td>
        <td>${escapeHtml(item.product.category)}</td>
        <td>${item.onHand}</td>
        <td>${item.adjusted}</td>
        <td>${item.product.safetyStock}</td>
        <td>${formatMoney(item.stockValue)}</td>
        <td>${formatMoney(item.revenue)}</td>
        <td>${formatMoney(item.grossProfit)}</td>
        <td>${item.lowStock ? '<span class="badge danger">低庫存</span>' : '<span class="badge">正常</span>'}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="11" class="empty">沒有符合條件的庫存資料。</td></tr>';
}

function currentStockOptions() {
  return {
    query: stockQuery.value,
    category: categoryFilter.value,
    warehouseId: warehouseFilter.value,
    lowStockOnly: lowStockOnly.checked,
    sort: stockSort.value
  };
}

function renderProductOptions() {
  const products = store.listProducts({ activeOnly: true });
  const inventoryRows = store.inventoryReport();
  const options = products.map((product) => {
    const stock = inventoryRows
      .filter((item) => item.productId === product.id)
      .reduce((total, item) => total + item.onHand, 0);
    return `<option value="${product.id}">${escapeHtml(product.sku)} / ${escapeHtml(product.name)} / 總庫存 ${stock}</option>`;
  }).join("");

  document.querySelectorAll("[data-product-select]").forEach((select) => {
    const selected = select.value;
    const blank = select.required ? "" : '<option value="">不新增第二筆</option>';
    select.innerHTML = options ? blank + options : '<option value="">尚無啟用商品</option>';
    if (selected && Array.from(select.options).some((option) => option.value === selected)) {
      select.value = selected;
    }
  });
}

function renderWarehouseOptions() {
  const warehouses = store.listWarehouses({ activeOnly: true });
  const options = warehouses
    .map((warehouse) => `<option value="${warehouse.id}">${escapeHtml(warehouse.code)} / ${escapeHtml(warehouse.name)}</option>`)
    .join("");

  document.querySelectorAll("[data-warehouse-select]").forEach((select) => {
    const selected = select.value;
    select.innerHTML = options || '<option value="">沒有可用倉庫</option>';
    if (selected && Array.from(select.options).some((option) => option.value === selected)) {
      select.value = selected;
    }
  });
}

function renderPartnerOptions() {
  const supplierOptions = store.listPartners({ role: "supplier", activeOnly: true })
    .map((partner) => `<option value="${escapeAttr(partner.name)}"></option>`)
    .join("");
  const customerOptions = store.listPartners({ role: "customer", activeOnly: true })
    .map((partner) => `<option value="${escapeAttr(partner.name)}"></option>`)
    .join("");

  document.querySelector("#supplier-options").innerHTML = supplierOptions;
  document.querySelector("#customer-options").innerHTML = customerOptions;
}

function collectOrderItems(data, priceField) {
  const secondPriceField = `${priceField}2`;
  const items = [{
    productId: data.productId,
    quantity: data.quantity,
    [priceField]: data[priceField]
  }];

  if (data.productId2 && data.quantity2 && data[secondPriceField]) {
    items.push({
      productId: data.productId2,
      quantity: data.quantity2,
      [priceField]: data[secondPriceField]
    });
  }

  return items;
}

function collectTransferItems(data) {
  const items = [{
    productId: data.productId,
    quantity: data.quantity
  }];

  if (data.productId2 && data.quantity2) {
    items.push({
      productId: data.productId2,
      quantity: data.quantity2
    });
  }

  return items;
}

function productName(productId) {
  const product = store.listProducts().find((item) => item.id === Number(productId));
  return product ? product.name : "未知商品";
}

function warehouseName(warehouseId) {
  const warehouse = store.listWarehouses().find((item) => item.id === Number(warehouseId));
  return warehouse ? `${warehouse.code} ${warehouse.name}` : "未指定倉庫";
}

function movementBadge(type) {
  if (type === "purchase") {
    return '<span class="badge">進貨</span>';
  }

  if (type === "adjustment") {
    return '<span class="badge neutral">調整</span>';
  }

  if (type === "transfer") {
    return '<span class="badge neutral">調撥</span>';
  }

  return '<span class="badge warn">銷售</span>';
}

function warehouseTypeLabel(type) {
  if (type === "store") {
    return "門市";
  }

  if (type === "display") {
    return "展示";
  }

  if (type === "return") {
    return "退貨區";
  }

  return "倉庫";
}

function saveState() {
  storage.saveState(store.snapshot());
}

function readBackupFile(file) {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "null"));
      const result = storage.validateBackupEnvelope(parsed);

      if (!result.valid) {
        backupPreview.innerHTML = `<strong>備份檔無法還原</strong><span>${escapeHtml(result.message)}</span>`;
        backupPreview.classList.remove("empty");
        setStatus("備份檔檢查失敗。", true);
        return;
      }

      pendingRestoreState = result.state;
      restoreButton.disabled = false;
      backupPreview.innerHTML = renderBackupSummary(result.summary);
      backupPreview.classList.remove("empty");
      setStatus("備份檔檢查通過，請確認後還原。");
    } catch (error) {
      backupPreview.innerHTML = "<strong>備份檔無法讀取</strong><span>請確認檔案是 JSON 格式。</span>";
      backupPreview.classList.remove("empty");
      setStatus("備份檔讀取失敗。", true);
    }
  });

  reader.readAsText(file);
}

function renderBackupSummary(summary) {
  return `
    <strong>備份檔檢查通過</strong>
    <span>備份時間：${escapeHtml(summary.savedAt)}</span>
    <span>App 版本：${escapeHtml(summary.appVersion)} / 資料版本：${escapeHtml(summary.schemaVersion)}</span>
    <span>產品類別 ${summary.productCategories} 筆，倉庫 ${summary.warehouses} 筆，商品 ${summary.products} 筆，往來對象 ${summary.partners} 筆</span>
    <span>進貨 ${summary.purchases} 筆，銷售 ${summary.sales} 筆，盤點調整 ${summary.adjustments} 筆，調撥 ${summary.transfers || 0} 筆</span>
  `;
}

function setDefaultDates() {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) {
      input.value = today;
    }
  });
}

function setStatus(message, isError) {
  statusLine.textContent = message;
  statusLine.classList.toggle("is-error", Boolean(isError));
  statusLine.classList.toggle("is-success", Boolean(message && !isError));
}

function formatMoney(value) {
  return new Intl.NumberFormat("zh-Hant-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function toCsv(rows) {
  const header = ["sku", "name", "warehouse", "category", "unit", "onHand", "adjusted", "cost", "price", "safetyStock", "stockValue", "revenue", "grossProfit", "lowStock"];
  return [header.join(",")]
    .concat(rows.map((row) => header.map((key) => csvCell(row[key])).join(",")))
    .join("\n");
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename, data) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
