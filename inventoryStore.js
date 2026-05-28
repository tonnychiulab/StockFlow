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

    let nextProductId = nextId(products);
    let nextPurchaseId = nextId(purchases);
    let nextSaleId = nextId(sales);
    let nextPartnerId = nextId(partners);

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

      if (!purchase || !product || !product.active) {
        return null;
      }

      nextPurchaseId += 1;
      purchases = [purchase].concat(purchases);
      products = products.map((item) => {
        if (item.id !== purchase.productId) {
          return item;
        }

        return Object.assign({}, item, { cost: purchase.unitCost });
      });

      return copyPurchase(purchase);
    }

    function addSale(input) {
      const sale = normalizeSale(input, nextSaleId);
      const product = findProduct(sale && sale.productId);

      if (!sale || !product || !product.active) {
        return null;
      }

      if (stockForProduct(sale.productId).onHand < sale.quantity) {
        return { error: "INSUFFICIENT_STOCK" };
      }

      nextSaleId += 1;
      sales = [sale].concat(sales);
      return copySale(sale);
    }

    function removePurchase(id) {
      const purchase = purchases.find((item) => item.id === Number(id));

      if (!purchase) {
        return false;
      }

      const currentStock = stockForProduct(purchase.productId).onHand;
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
          return [
            product && product.sku,
            product && product.name,
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
          return [
            product && product.sku,
            product && product.name,
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

    function inventoryReport(options) {
      const filter = Object.assign({ query: "", category: "", lowStockOnly: false, sort: "sku" }, options);
      const query = normalizeText(filter.query).toLowerCase();

      const rows = products
        .filter((product) => !filter.category || product.category === filter.category)
        .filter((product) => {
          if (!query) {
            return true;
          }

          return [product.sku, product.name, product.category]
            .some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .map((product) => stockForProduct(product.id))
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
        return {
          id: `purchase-${purchase.id}`,
          sourceId: purchase.id,
          type: "purchase",
          label: "進貨",
          date: purchase.date,
          productId: purchase.productId,
          sku: product ? product.sku : "",
          productName: product ? product.name : "未知商品",
          quantity: purchase.quantity,
          amount: purchase.quantity * purchase.unitCost,
          party: purchase.supplier,
          note: purchase.note
        };
      });
      const saleMovements = sales.map((sale) => {
        const product = findProduct(sale.productId);
        return {
          id: `sale-${sale.id}`,
          sourceId: sale.id,
          type: "sale",
          label: "銷售",
          date: sale.date,
          productId: sale.productId,
          sku: product ? product.sku : "",
          productName: product ? product.name : "未知商品",
          quantity: -sale.quantity,
          amount: sale.quantity * sale.unitPrice,
          party: sale.customer,
          note: sale.note
        };
      });

      return purchaseMovements
        .concat(saleMovements)
        .filter((item) => !filter.month || item.date.slice(0, 7) === filter.month)
        .filter((item) => {
          if (!query) {
            return true;
          }

          return [item.sku, item.productName, item.party, item.note, item.label]
            .some((value) => normalizeText(value).toLowerCase().includes(query));
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    }

    function categories() {
      return Array.from(new Set(products.map((product) => product.category)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }

    function exportInventoryRows() {
      return inventoryReport().map((item) => ({
        sku: item.product.sku,
        name: item.product.name,
        category: item.product.category,
        unit: item.product.unit,
        onHand: item.onHand,
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
        purchases: purchases.map(copyPurchase),
        sales: sales.map(copySale)
      };
    }

    function stockForProduct(productId) {
      const product = findProduct(productId);
      const purchased = purchases
        .filter((purchase) => purchase.productId === productId)
        .reduce((total, purchase) => total + purchase.quantity, 0);
      const sold = sales
        .filter((sale) => sale.productId === productId)
        .reduce((total, sale) => total + sale.quantity, 0);
      const revenue = sales
        .filter((sale) => sale.productId === productId)
        .reduce((total, sale) => total + sale.quantity * sale.unitPrice, 0);
      const onHand = purchased - sold;
      const cost = product ? product.cost : 0;

      return {
        product: product ? copyProduct(product) : null,
        productId,
        onHand,
        purchased,
        sold,
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

    return {
      addProduct,
      addPurchase,
      addSale,
      categories,
      dashboard,
      deactivateProduct,
      deactivatePartner,
      addPartner,
      exportInventoryRows,
      grossProfitRanking,
      inventoryReport,
      listPartners,
      listProducts,
      listPurchases,
      listSales,
      reportSummary,
      removePurchase,
      removeSale,
      snapshot,
      stockMovements,
      updatePartner,
      updateProduct
    };
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
    return rows.slice().sort((a, b) => {
      if (sort === "onHandAsc") {
        return a.onHand - b.onHand || a.product.sku.localeCompare(b.product.sku);
      }

      if (sort === "stockValueDesc") {
        return b.stockValue - a.stockValue || a.product.sku.localeCompare(b.product.sku);
      }

      if (sort === "grossProfitDesc") {
        return b.grossProfit - a.grossProfit || a.product.sku.localeCompare(b.product.sku);
      }

      if (sort === "lowStockFirst") {
        return Number(b.lowStock) - Number(a.lowStock) || a.onHand - b.onHand || a.product.sku.localeCompare(b.product.sku);
      }

      return a.product.sku.localeCompare(b.product.sku);
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
      quantity,
      unitCost,
      supplier: normalizeText(input && input.supplier),
      date,
      note: normalizeText(input && input.note)
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
      quantity,
      unitPrice,
      customer: normalizeText(input && input.customer),
      date,
      note: normalizeText(input && input.note)
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
      quantity: positiveNumber(purchase.quantity) || 0,
      unitCost: nonNegativeNumber(purchase.unitCost) || 0,
      supplier: normalizeText(purchase.supplier),
      date: normalizeDate(purchase.date),
      note: normalizeText(purchase.note)
    };
  }

  function copySale(sale) {
    return {
      id: Number(sale.id),
      productId: Number(sale.productId),
      quantity: positiveNumber(sale.quantity) || 0,
      unitPrice: nonNegativeNumber(sale.unitPrice) || 0,
      customer: normalizeText(sale.customer),
      date: normalizeDate(sale.date),
      note: normalizeText(sale.note)
    };
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

  global.createInventoryStore = createInventoryStore;

  if (typeof module !== "undefined") {
    module.exports = { createInventoryStore };
  }
})(typeof window !== "undefined" ? window : globalThis);
