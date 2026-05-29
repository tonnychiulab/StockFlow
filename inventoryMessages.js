(function (global) {
  const messages = {
    productSaveFailed: "商品儲存失敗，請確認 SKU 不重複且欄位有效。",
    duplicateSku: "商品儲存失敗，SKU 已被其他商品使用。",
    partnerSaveFailed: "往來對象儲存失敗，請確認名稱有效。",
    duplicatePartner: "往來對象儲存失敗，同類型名稱已存在。",
    categorySaveFailed: "產品類別儲存失敗，請確認代碼和名稱不可重複。",
    warehouseSaveFailed: "倉庫儲存失敗，請確認代碼和名稱不可重複。",
    purchaseOrderFailed: "採購單建立失敗，請確認商品仍啟用且明細有效。",
    saleOrderFailed: "銷售單建立失敗，請確認商品仍啟用且明細有效。",
    transferOrderFailed: "調撥單建立失敗，請確認來源與目的倉庫不同、商品仍啟用且明細有效。",
    insufficientStock: "庫存不足，無法建立銷售。",
    adjustmentFailed: "盤點調整建立失敗，請確認商品仍啟用且數量有效。",
    noDifference: "盤點數量與系統庫存相同，無需建立調整單。",
    negativeStockOnRemove: "此進貨已被後續銷售使用，作廢後會造成負庫存，因此已拒絕。"
  };

  function message(key) {
    return messages[key] || "操作失敗，請確認資料是否有效。";
  }

  function transactionError(result, fallbackKey) {
    if (result && result.error === "INSUFFICIENT_STOCK") {
      return message("insufficientStock");
    }

    if (result && result.error === "NO_DIFFERENCE") {
      return message("noDifference");
    }

    if (result && result.error === "NEGATIVE_STOCK") {
      return message("negativeStockOnRemove");
    }

    return message(fallbackKey);
  }

  global.StockFlowMessages = {
    message,
    transactionError
  };

  if (typeof module !== "undefined") {
    module.exports = global.StockFlowMessages;
  }
})(typeof window !== "undefined" ? window : globalThis);
