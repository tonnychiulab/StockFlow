(function (global) {
  function renderReports(context) {
    const {
      document,
      store,
      month,
      movementQuery,
      formatMoney,
      formatPercent,
      escapeHtml,
      productName,
      warehouseName,
      movementBadge
    } = context;
    const summary = store.reportSummary({ month });
    const lowStock = store.inventoryReport({ lowStockOnly: true });
    const warehouseSummary = store.warehouseStockSummary();
    const transferSummary = store.warehouseTransferSummary({ month });
    const distribution = store.productWarehouseSummary().slice(0, 8);
    const sales = store.listSales({ month }).slice(0, 6);
    const purchases = store.listPurchases({ month }).slice(0, 6);
    const movements = store.stockMovements({
      month,
      query: movementQuery
    });

    document.querySelector("#report-sales-revenue").textContent = formatMoney(summary.salesRevenue);
    document.querySelector("#report-sales-count").textContent = `${summary.salesCount} 筆 / ${summary.salesQuantity} 件`;
    document.querySelector("#report-purchase-cost").textContent = formatMoney(summary.purchaseCost);
    document.querySelector("#report-purchase-count").textContent = `${summary.purchaseCount} 筆 / ${summary.purchaseQuantity} 件`;
    document.querySelector("#report-gross-profit").textContent = formatMoney(summary.grossProfit);
    document.querySelector("#report-margin-rate").textContent = `毛利率 ${formatPercent(summary.marginRate)}`;
    document.querySelector("#report-low-stock").textContent = lowStock.length;
    document.querySelector("#report-sales-label").textContent = month || "全部期間";
    document.querySelector("#report-purchases-label").textContent = month || "全部期間";

    document.querySelector("#warehouse-summary-cards").innerHTML = warehouseSummary.length
      ? warehouseSummary.map((item) => `
        <article class="ranking-card">
          <strong>${escapeHtml(item.warehouse ? item.warehouse.name : "未指定倉庫")}</strong>
          <span class="compact-meta">${escapeHtml(item.warehouse ? item.warehouse.code : "-")} / 商品列 ${item.productCount}</span>
          <span class="compact-meta">庫存 ${item.onHand} / 低庫存 ${item.lowStockCount}</span>
          <span class="compact-meta">庫存值 ${formatMoney(item.stockValue)}</span>
        </article>
      `).join("")
      : '<div class="empty">目前沒有倉庫庫存資料。</div>';

    document.querySelector("#warehouse-transfer-cards").innerHTML = transferSummary.length
      ? transferSummary.map((item) => `
        <article class="ranking-card">
          <strong>${escapeHtml(item.warehouse ? item.warehouse.name : "未指定倉庫")}</strong>
          <span class="compact-meta">${escapeHtml(item.warehouse ? item.warehouse.code : "-")} / 調撥 ${item.transferCount} 筆</span>
          <span class="compact-meta">調入 ${item.transferredIn} / 調出 ${item.transferredOut}</span>
          <span class="compact-meta">淨流量 ${item.netTransfer >= 0 ? "+" : ""}${item.netTransfer}</span>
        </article>
      `).join("")
      : '<div class="empty">這個期間沒有調撥流向資料。</div>';

    document.querySelector("#warehouse-distribution-list").innerHTML = distribution.length
      ? distribution.map((item) => `
        <article class="compact-card">
          <strong>${escapeHtml(item.product.name)}</strong>
          <span class="compact-meta">總庫存 ${item.totalOnHand} ${escapeHtml(item.product.unit)} / 庫存值 ${formatMoney(item.stockValue)}</span>
          <span class="compact-meta">${item.warehouses.map((warehouseRow) => `${escapeHtml(warehouseRow.warehouse ? warehouseRow.warehouse.code : "-")} ${warehouseRow.onHand}${warehouseRow.lowStock ? " 低" : ""}`).join(" / ")}</span>
        </article>
      `).join("")
      : '<div class="empty">目前沒有跨倉分布資料。</div>';

    document.querySelector("#report-sales-list").innerHTML = sales.length
      ? sales.map((item) => `
        <article class="record-card">
          <div>
            <strong>${escapeHtml(productName(item.productId))}</strong>
            <div class="record-meta">${escapeHtml(item.documentNo || "無單號")} / ${item.date} / ${escapeHtml(warehouseName(item.warehouseId))} / ${escapeHtml(item.customer || "未填客戶")} / ${item.quantity} 件</div>
          </div>
          <span class="amount expense">${formatMoney(item.quantity * item.unitPrice)}</span>
        </article>
      `).join("")
      : '<div class="empty">這個期間沒有銷售資料。</div>';

    document.querySelector("#report-purchase-list").innerHTML = purchases.length
      ? purchases.map((item) => `
        <article class="record-card">
          <div>
            <strong>${escapeHtml(productName(item.productId))}</strong>
            <div class="record-meta">${escapeHtml(item.documentNo || "無單號")} / ${item.date} / ${escapeHtml(warehouseName(item.warehouseId))} / ${escapeHtml(item.supplier || "未填供應商")} / ${item.quantity} 件</div>
          </div>
          <span class="amount income">${formatMoney(item.quantity * item.unitCost)}</span>
        </article>
      `).join("")
      : '<div class="empty">這個期間沒有進貨資料。</div>';

    const ranking = store.grossProfitRanking(8);
    document.querySelector("#report-profit-ranking").innerHTML = ranking.length
      ? ranking.map((item, index) => `
        <article class="ranking-card">
          <strong>${index + 1}. ${escapeHtml(item.product.name)}</strong>
          <span class="compact-meta">收入 ${formatMoney(item.revenue)}</span>
          <span class="compact-meta">毛利 ${formatMoney(item.grossProfit)}</span>
          <span class="compact-meta">庫存 ${item.onHand} ${escapeHtml(item.product.unit)}</span>
        </article>
      `).join("")
      : '<div class="empty">尚無銷售資料可排行。</div>';

    document.querySelector("#movement-count").textContent = `${movements.length} 筆`;
    document.querySelector("#movement-table").innerHTML = movements.length
      ? movements.map((item) => `
        <tr>
          <td>${item.date}</td>
          <td>${movementBadge(item.type)}</td>
          <td>
            <div class="row-title">
              <strong>${escapeHtml(item.documentNo || "無單號")}</strong>
              <span>${escapeHtml(item.sku)} / ${escapeHtml(item.productName)} / ${escapeHtml(item.warehouseName || "未指定倉庫")}</span>
            </div>
          </td>
          <td class="${item.quantity >= 0 ? "movement-positive" : "movement-negative"}">${item.quantity >= 0 ? "+" : ""}${item.quantity}</td>
          <td>${formatMoney(item.amount)}</td>
          <td>${escapeHtml(item.party || "未填")}</td>
          <td>${escapeHtml(item.note || "無備註")}</td>
        </tr>
      `).join("")
      : '<tr><td colspan="7" class="empty">這個期間沒有符合條件的庫存異動。</td></tr>';
  }

  global.StockFlowRenderers = {
    renderReports
  };

  if (typeof module !== "undefined") {
    module.exports = global.StockFlowRenderers;
  }
})(typeof window !== "undefined" ? window : globalThis);
