import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

const SHOP_NAME = "Yusuf Stock Pro";
const ADMIN_PIN = "0987";
const PAYMENT_METHODS = ["Cash", "M-Pesa"];
const ORDER_STATUSES = ["Pending", "Ready", "Collected", "Cancelled"];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem("products");
    return saved ? JSON.parse(saved) : [];
  });

  const [sales, setSales] = useState(() => {
    const saved = localStorage.getItem("sales");
    return saved ? JSON.parse(saved) : [];
  });

  const [workers, setWorkers] = useState(() => {
    const saved = localStorage.getItem("workers");
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem("orders");
    return saved ? JSON.parse(saved) : [];
  });

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    stock: "",
    buyingPrice: "",
    sellingPrice: "",
  });

  const [editProduct, setEditProduct] = useState({
    originalName: "",
    name: "",
    category: "",
    stock: "",
    buyingPrice: "",
    sellingPrice: "",
  });

  const [sale, setSale] = useState({
    saleType: "product",
    category: "",
    product: "",
    quantity: "",
    sellingPrice: "",
    serviceName: "",
    serviceNote: "",
    paymentMethod: "Cash",
    soldBy: "",
  });

  const [newOrder, setNewOrder] = useState({
    clientName: "",
    clientPhone: "",
    orderType: "product",
    orderItem: "",
    totalAmount: "",
    depositPaid: "",
    orderDate: new Date().toISOString().slice(0, 10),
    collectionDate: "",
    status: "Pending",
    handledBy: "",
    notes: "",
  });

  const [productFilterCategory, setProductFilterCategory] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [saleProductSearch, setSaleProductSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [toast, setToast] = useState(null);

  const [stockUpdate, setStockUpdate] = useState({
    product: "",
    mode: "add",
    quantity: "",
  });

  const [newWorker, setNewWorker] = useState("");
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("isAdmin") === "true"
  );
  const [pinInput, setPinInput] = useState("");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 4500);
  };

  const goTo = (tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatProductFromSupabase = (product) => ({
    name: product.name,
    category: product.category || "General",
    stock: Number(product.stock || 0),
    buyingPrice: Number(product.buying_price || 0),
    sellingPrice: Number(product.selling_price || 0),
  });

  const formatSaleFromSupabase = (saleItem) => ({
    id: saleItem.id,
    saleType:
      saleItem.sale_type || (saleItem.service_name ? "service" : "product"),
    product: saleItem.product || saleItem.service_name || "Service",
    serviceName: saleItem.service_name || "",
    serviceNote: saleItem.service_note || "",
    quantity: Number(saleItem.quantity || 0),
    sellingPrice: Number(saleItem.selling_price || 0),
    paymentMethod: saleItem.payment_method,
    soldBy: saleItem.sold_by,
    total: Number(saleItem.total || 0),
    profit: Number(saleItem.profit || 0),
    date: saleItem.sale_date,
    time: saleItem.sale_time,
  });

  const formatOrderFromSupabase = (order) => ({
    id: order.id,
    clientName: order.client_name || "",
    clientPhone: order.client_phone || "",
    orderType: order.order_type || "product",
    orderItem: order.order_item || "",
    totalAmount: Number(order.total_amount || 0),
    depositPaid: Number(order.deposit_paid || 0),
    balance: Number(order.balance || 0),
    orderDate: order.order_date || "",
    collectionDate: order.collection_date || "",
    status: order.status || "Pending",
    handledBy: order.handled_by || "",
    notes: order.notes || "",
  });

  const loadDataFromSupabase = async () => {
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (!productsError && productsData) {
      setProducts(productsData.map(formatProductFromSupabase));
    }

    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: true });

    if (!salesError && salesData) {
      setSales(salesData.map(formatSaleFromSupabase));
    }

    const { data: workersData, error: workersError } = await supabase
      .from("workers")
      .select("*")
      .order("name", { ascending: true });

    if (!workersError && workersData) {
      setWorkers(workersData);
    }

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!ordersError && ordersData) {
      setOrders(ordersData.map(formatOrderFromSupabase));
    }
  };

  useEffect(() => {
    localStorage.setItem("products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem("sales", JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem("workers", JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem("orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    loadDataFromSupabase();

    const channel = supabase
      .channel("yusuf-stock-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        loadDataFromSupabase
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        loadDataFromSupabase
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workers" },
        loadDataFromSupabase
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        loadDataFromSupabase
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set(products.map((product) => product.category || "General"))
    ).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = saleProductSearch.trim().toLowerCase();

    return products
      .filter(
        (product) =>
          !sale.category || (product.category || "General") === sale.category
      )
      .filter((product) => Number(product.stock) > 0)
      .filter(
        (product) =>
          !search ||
          `${product.name} ${product.category}`.toLowerCase().includes(search)
      );
  }, [products, sale.category, saleProductSearch]);

  const productsToShow = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    return products
      .filter(
        (product) =>
          !productFilterCategory ||
          (product.category || "General") === productFilterCategory
      )
      .filter(
        (product) =>
          !search ||
          `${product.name} ${product.category}`.toLowerCase().includes(search)
      );
  }, [products, productFilterCategory, productSearch]);

  const stockProductsToShow = useMemo(() => {
    const search = stockSearch.trim().toLowerCase();
    return products.filter(
      (product) =>
        !search ||
        `${product.name} ${product.category}`.toLowerCase().includes(search)
    );
  }, [products, stockSearch]);

  const totalSales = useMemo(
    () => sales.reduce((sum, s) => sum + Number(s.total || 0), 0),
    [sales]
  );

  const totalProfit = useMemo(
    () => sales.reduce((sum, s) => sum + Number(s.profit || 0), 0),
    [sales]
  );

  const mpesaTotal = useMemo(() => {
    return sales
      .filter((s) => s.paymentMethod === "M-Pesa")
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
  }, [sales]);

  const cashTotal = useMemo(() => {
    return sales
      .filter((s) => s.paymentMethod === "Cash")
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
  }, [sales]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => Number(p.stock || 0) <= 5),
    [products]
  );

  const pendingOrders = useMemo(() => {
    return orders.filter(
      (order) => order.status !== "Collected" && order.status !== "Cancelled"
    );
  }, [orders]);

  const dailyReports = useMemo(() => {
    const grouped = {};

    sales.forEach((saleItem) => {
      const rawDate = saleItem.date || "Unknown date";
      const dateObject = new Date(rawDate);
      const validDate = !Number.isNaN(dateObject.getTime());
      const safeDate = validDate ? dateObject.toLocaleDateString() : rawDate;

      if (!grouped[safeDate]) {
        grouped[safeDate] = {
          date: safeDate,
          day: validDate
            ? dateObject.toLocaleDateString(undefined, { weekday: "long" })
            : "Day",
          totalSales: 0,
          totalProfit: 0,
          cash: 0,
          mpesa: 0,
          count: 0,
        };
      }

      grouped[safeDate].totalSales += Number(saleItem.total || 0);
      grouped[safeDate].totalProfit += Number(saleItem.profit || 0);
      grouped[safeDate].count += 1;

      if (saleItem.paymentMethod === "Cash") {
        grouped[safeDate].cash += Number(saleItem.total || 0);
      }

      if (saleItem.paymentMethod === "M-Pesa") {
        grouped[safeDate].mpesa += Number(saleItem.total || 0);
      }
    });

    return Object.values(grouped).reverse();
  }, [sales]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.name === selectedProductName) || null;
  }, [products, selectedProductName]);

  const selectedProductSales = useMemo(() => {
    if (!selectedProductName) return [];

    return sales.filter(
      (s) =>
        s.saleType !== "service" &&
        String(s.product || "").toLowerCase() ===
          selectedProductName.toLowerCase()
    );
  }, [sales, selectedProductName]);

  const selectedProductTotalSold = useMemo(() => {
    return selectedProductSales.reduce(
      (sum, s) => sum + Number(s.total || 0),
      0
    );
  }, [selectedProductSales]);

  const selectedProductProfit = useMemo(() => {
    return selectedProductSales.reduce(
      (sum, s) => sum + Number(s.profit || 0),
      0
    );
  }, [selectedProductSales]);

  const selectedProductQuantitySold = useMemo(() => {
    return selectedProductSales.reduce(
      (sum, s) => sum + Number(s.quantity || 0),
      0
    );
  }, [selectedProductSales]);

  const saleDisplayName = (s) =>
    s.saleType === "service" ? s.serviceName || s.product : s.product;

  const unlockAdmin = () => {
    if (pinInput === ADMIN_PIN) {
      setIsAdmin(true);
      localStorage.setItem("isAdmin", "true");
      setPinInput("");
      showToast("Admin mode unlocked ✅");
    } else {
      alert("Wrong PIN");
    }
  };

  const lockAdmin = () => {
    setIsAdmin(false);
    localStorage.removeItem("isAdmin");
    showToast("Admin mode locked");
  };

  const addWorker = async () => {
    const workerName = newWorker.trim();
    if (!workerName) return alert("Enter worker name");

    const workerExists = workers.some(
      (worker) => worker.name.toLowerCase() === workerName.toLowerCase()
    );

    if (workerExists) return alert("Worker already exists");

    const { error } = await supabase
      .from("workers")
      .insert({ name: workerName });

    if (error) {
      alert("Worker failed to save: " + error.message);
      return;
    }

    setNewWorker("");
    showToast(`Worker ${workerName} added ✅`);
  };

  const deleteWorker = async (workerId, workerName) => {
    const confirmDelete = confirm(`Delete worker ${workerName}?`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("workers")
      .delete()
      .eq("id", workerId);

    if (error) {
      alert("Worker delete failed: " + error.message);
      return;
    }

    setWorkers(workers.filter((worker) => worker.id !== workerId));
  };

  const addProduct = async () => {
    if (
      !newProduct.name ||
      newProduct.stock === "" ||
      newProduct.buyingPrice === "" ||
      newProduct.sellingPrice === ""
    ) {
      return alert("Fill all product details");
    }

    const productExists = products.some(
      (p) => p.name.toLowerCase() === newProduct.name.toLowerCase()
    );

    if (productExists) return alert("This product already exists");

    const { error } = await supabase.from("products").upsert(
      {
        name: newProduct.name.trim(),
        category: newProduct.category.trim() || "General",
        stock: Number(newProduct.stock),
        buying_price: Number(newProduct.buyingPrice),
        selling_price: Number(newProduct.sellingPrice),
      },
      { onConflict: "name" }
    );

    if (error) {
      alert("Product failed to save online: " + error.message);
      return;
    }

    setNewProduct({
      name: "",
      category: "",
      stock: "",
      buyingPrice: "",
      sellingPrice: "",
    });

    showToast("Product saved ✅");
  };

  const openProductDetail = (product) => {
    setSelectedProductName(product.name);

    setEditProduct({
      originalName: product.name,
      name: product.name,
      category: product.category || "General",
      stock: String(product.stock),
      buyingPrice: String(product.buyingPrice),
      sellingPrice: String(product.sellingPrice),
    });

    goTo("productDetail");
  };

  const cancelEditProduct = () => {
    if (selectedProduct) {
      setEditProduct({
        originalName: selectedProduct.name,
        name: selectedProduct.name,
        category: selectedProduct.category || "General",
        stock: String(selectedProduct.stock),
        buyingPrice: String(selectedProduct.buyingPrice),
        sellingPrice: String(selectedProduct.sellingPrice),
      });
    } else {
      setEditProduct({
        originalName: "",
        name: "",
        category: "",
        stock: "",
        buyingPrice: "",
        sellingPrice: "",
      });
    }
  };

  const saveEditedProduct = async () => {
    if (
      !editProduct.originalName ||
      !editProduct.name ||
      editProduct.stock === "" ||
      editProduct.buyingPrice === "" ||
      editProduct.sellingPrice === ""
    ) {
      return alert("Fill all edited product details");
    }

    const newName = editProduct.name.trim();

    const duplicateName = products.some(
      (p) =>
        p.name.toLowerCase() === newName.toLowerCase() &&
        p.name.toLowerCase() !== editProduct.originalName.toLowerCase()
    );

    if (duplicateName) return alert("Another product already has this name");

    const { error } = await supabase
      .from("products")
      .update({
        name: newName,
        category: editProduct.category.trim() || "General",
        stock: Number(editProduct.stock),
        buying_price: Number(editProduct.buyingPrice),
        selling_price: Number(editProduct.sellingPrice),
      })
      .eq("name", editProduct.originalName);

    if (error) {
      alert("Product update failed: " + error.message);
      return;
    }

    setSelectedProductName(newName);
    setEditProduct({ ...editProduct, originalName: newName, name: newName });
    showToast("Product updated ✅");
  };

  const updateStock = async () => {
    const product = products.find((p) => p.name === stockUpdate.product);
    if (!product) return alert("Choose a product first");

    const quantity = Number(stockUpdate.quantity);
    if (stockUpdate.quantity === "" || quantity < 0) {
      return alert("Enter a valid stock number");
    }

    const newStock =
      stockUpdate.mode === "add" ? Number(product.stock) + quantity : quantity;

    const { error } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("name", product.name);

    if (error) {
      alert("Stock update failed: " + error.message);
      return;
    }

    setProducts(
      products.map((p) =>
        p.name === product.name ? { ...p, stock: newStock } : p
      )
    );

    setStockUpdate({ product: "", mode: "add", quantity: "" });
    showToast(`Stock updated for ${product.name} ✅`);
  };

  const deleteProduct = async (productName) => {
    if (!isAdmin) return alert("Admin only");

    const confirmDelete = confirm(`Delete ${productName}?`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("name", productName);

    if (error) {
      alert("Supabase delete failed: " + error.message);
      return;
    }

    setProducts(products.filter((p) => p.name !== productName));

    if (selectedProductName === productName) {
      setSelectedProductName("");
      goTo("products");
    }
  };

  const addSale = async () => {
    const isService = sale.saleType === "service";
    const quantity = isService ? 1 : Number(sale.quantity);
    const sellingPrice = Number(sale.sellingPrice);
    const saleDate = new Date().toLocaleDateString();
    const saleTime = new Date().toLocaleTimeString();

    if (!sale.soldBy) return alert("Choose who sold it");
    if (!sellingPrice || sellingPrice <= 0) return alert("Enter selling price");

    if (isService) {
      const serviceName = sale.serviceName.trim();
      if (!serviceName) return alert("Enter service name");

      const total = sellingPrice;
      const profit = sellingPrice;

      const { error: saleError } = await supabase.from("sales").insert({
        sale_type: "service",
        product: serviceName,
        service_name: serviceName,
        service_note: sale.serviceNote.trim(),
        quantity: 1,
        selling_price: sellingPrice,
        payment_method: sale.paymentMethod,
        sold_by: sale.soldBy,
        total,
        profit,
        sale_date: saleDate,
        sale_time: saleTime,
      });

      if (saleError) {
        alert("Service failed to save: " + saleError.message);
        return;
      }

      setSale({
        saleType: "product",
        category: "",
        product: "",
        quantity: "",
        sellingPrice: "",
        serviceName: "",
        serviceNote: "",
        paymentMethod: "Cash",
        soldBy: "",
      });

      setSaleProductSearch("");
      showToast(
        `✅ Service "${serviceName}" done by ${sale.soldBy} • KSh ${total.toLocaleString()}`
      );
      return;
    }

    const product = products.find((p) => p.name === sale.product);
    if (!product) return alert("Choose a product first");

    if (!sale.category || !quantity || quantity <= 0 || !sellingPrice) {
      return alert(
        "Fill category, product, quantity, selling price, and sold by"
      );
    }

    if (quantity > Number(product.stock)) return alert("Not enough stock");

    const newStock = Number(product.stock) - quantity;
    const profit = (sellingPrice - Number(product.buyingPrice)) * quantity;
    const total = sellingPrice * quantity;

    const { error: saleError } = await supabase.from("sales").insert({
      sale_type: "product",
      product: sale.product,
      service_name: null,
      service_note: null,
      quantity,
      selling_price: sellingPrice,
      payment_method: sale.paymentMethod,
      sold_by: sale.soldBy,
      total,
      profit,
      sale_date: saleDate,
      sale_time: saleTime,
    });

    if (saleError) {
      alert("Sale failed to save: " + saleError.message);
      return;
    }

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("name", sale.product);

    if (stockError) {
      alert("Sale saved, but stock update failed: " + stockError.message);
      return;
    }

    setSale({
      saleType: "product",
      category: "",
      product: "",
      quantity: "",
      sellingPrice: "",
      serviceName: "",
      serviceNote: "",
      paymentMethod: "Cash",
      soldBy: "",
    });

    setSaleProductSearch("");
    showToast(
      `✅ ${product.name} ×${quantity} sold by ${
        sale.soldBy
      } • KSh ${total.toLocaleString()}`
    );
  };

  const deleteSale = async (saleIndex) => {
    if (!isAdmin) return alert("Admin only");

    const confirmDelete = confirm("Delete this sale?");
    if (!confirmDelete) return;

    const saleToDelete = sales[saleIndex];

    if (saleToDelete?.id) {
      const { error } = await supabase
        .from("sales")
        .delete()
        .eq("id", saleToDelete.id);

      if (error) {
        alert("Supabase delete failed: " + error.message);
        return;
      }
    }

    setSales(sales.filter((_, index) => index !== saleIndex));
  };

  const addOrder = async () => {
    const totalAmount = Number(newOrder.totalAmount || 0);
    const depositPaid = Number(newOrder.depositPaid || 0);
    const balance = totalAmount - depositPaid;

    if (
      !newOrder.clientName.trim() ||
      !newOrder.orderItem.trim() ||
      !newOrder.handledBy
    ) {
      return alert("Fill client name, ordered item/service, and handled by");
    }

    if (depositPaid > totalAmount) {
      return alert("Deposit cannot be more than total amount");
    }

    const { error } = await supabase.from("orders").insert({
      client_name: newOrder.clientName.trim(),
      client_phone: newOrder.clientPhone.trim(),
      order_type: newOrder.orderType,
      order_item: newOrder.orderItem.trim(),
      total_amount: totalAmount,
      deposit_paid: depositPaid,
      balance,
      order_date: newOrder.orderDate || new Date().toISOString().slice(0, 10),
      collection_date: newOrder.collectionDate || null,
      status: newOrder.status,
      handled_by: newOrder.handledBy,
      notes: newOrder.notes.trim(),
    });

    if (error) {
      alert("Order failed to save: " + error.message);
      return;
    }

    showToast(
      `🧾 Order saved for ${
        newOrder.clientName
      } • Deposit KSh ${depositPaid.toLocaleString()}`
    );

    setNewOrder({
      clientName: "",
      clientPhone: "",
      orderType: "product",
      orderItem: "",
      totalAmount: "",
      depositPaid: "",
      orderDate: new Date().toISOString().slice(0, 10),
      collectionDate: "",
      status: "Pending",
      handledBy: "",
      notes: "",
    });
  };

  const updateOrderStatus = async (orderId, status) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (error) {
      alert("Order update failed: " + error.message);
      return;
    }

    setOrders(
      orders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      )
    );

    showToast(`Order marked as ${status} ✅`);
  };

  const deleteOrder = async (orderId) => {
    if (!isAdmin) return alert("Admin only");

    const confirmDelete = confirm("Delete this order?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("orders").delete().eq("id", orderId);

    if (error) {
      alert("Order delete failed: " + error.message);
      return;
    }

    setOrders(orders.filter((order) => order.id !== orderId));
  };

  const parseCSVLine = (line) => {
    const values = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const importProductsFromCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

      if (lines.length < 2) {
        return alert("CSV file is empty or not formatted correctly");
      }

      const headers = parseCSVLine(lines[0]).map((header) =>
        header.trim().toLowerCase()
      );

      const importedProducts = lines
        .slice(1)
        .map((line) => {
          const values = parseCSVLine(line);
          const row = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });

          const buyingPrice = Number(row.buyingprice || row.buying_price || 0);
          const sellingPrice = Number(
            row.sellingprice || row.selling_price || buyingPrice
          );

          return {
            name: row.name || row.product || row.productname,
            category: row.category || "General",
            stock: Number(row.stock || row.quantity || 0),
            buyingPrice,
            sellingPrice,
          };
        })
        .filter((product) => product.name);

      if (importedProducts.length === 0) {
        return alert("No valid products found in the CSV");
      }

      setProducts((currentProducts) => {
        const productsMap = new Map();

        currentProducts.forEach((product) =>
          productsMap.set(product.name.toLowerCase(), product)
        );

        importedProducts.forEach((product) =>
          productsMap.set(product.name.toLowerCase(), product)
        );

        return Array.from(productsMap.values());
      });

      alert(`${importedProducts.length} products imported locally`);
      event.target.value = "";
    };

    reader.readAsText(file);
  };

  const downloadCSV = (filename, rows) => {
    if (!rows || rows.length === 0) {
      return alert("No data available to export");
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] ?? "";
            const safeValue = String(value).replaceAll('"', '""');
            return `"${safeValue}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportProductsCSV = () =>
    downloadCSV("yusuf_products_backup.csv", products);

  const exportSalesCSV = () => downloadCSV("yusuf_sales_backup.csv", sales);

  const exportOrdersCSV = () => downloadCSV("yusuf_orders_backup.csv", orders);

  const testSupabaseConnection = async () => {
    const { error } = await supabase.from("products").select("*").limit(1);

    if (error) {
      alert("Supabase error: " + error.message);
      return;
    }

    showToast("Supabase connected successfully ✅");
  };

  const syncProductsToSupabase = async () => {
    if (products.length === 0) return alert("No products to sync");

    const productsToUpload = products.map((product) => ({
      name: product.name,
      category: product.category || "General",
      stock: Number(product.stock || 0),
      buying_price: Number(product.buyingPrice || 0),
      selling_price: Number(product.sellingPrice || 0),
    }));

    const { error } = await supabase
      .from("products")
      .upsert(productsToUpload, { onConflict: "name" });

    if (error) {
      alert("Sync failed: " + error.message);
      return;
    }

    showToast(`${products.length} products synced to Supabase ✅`);
  };

  const loadProductsFromSupabase = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) return alert("Failed to load products: " + error.message);

    setProducts(data.map(formatProductFromSupabase));
    showToast(`${data.length} products loaded from Supabase ✅`);
  };

  const loadSalesFromSupabase = async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) return alert("Failed to load sales: " + error.message);

    setSales(data.map(formatSaleFromSupabase));
    showToast(`${data.length} sales loaded from Supabase ✅`);
  };

  const SideMenu = () => (
    <>
      {menuOpen && (
        <button
          className="menu-backdrop"
          type="button"
          onClick={() => setMenuOpen(false)}
        ></button>
      )}

      <aside className={menuOpen ? "side-menu open" : "side-menu"}>
        <div className="side-menu-head">
          <div>
            <h2>{SHOP_NAME}</h2>
            <p>{isAdmin ? "Admin Mode" : "Worker Mode"}</p>
          </div>

          <button type="button" onClick={() => setMenuOpen(false)}>
            ✕
          </button>
        </div>

        <button type="button" onClick={() => goTo("dashboard")}>
          🏠 Dashboard
        </button>

        <button type="button" onClick={() => goTo("products")}>
          📦 Products
        </button>

        <button type="button" onClick={() => goTo("sales")}>
          ➕ New Sale
        </button>

        <button type="button" onClick={() => goTo("orders")}>
          🧾 Client Orders
        </button>

        <button type="button" onClick={() => goTo("reports")}>
          📊 Reports
        </button>

        <button type="button" onClick={() => goTo("more")}>
          ⚙️ More
        </button>
      </aside>
    </>
  );

  const Dashboard = () => (
    <>
      <div className="hero-card">
        <div>
          <p className="muted">{SHOP_NAME}</p>
          <h1>KSh {totalProfit.toLocaleString()}</h1>
          <span className="green-text">▲ Total Profit</span>
        </div>

        <div className="mini-chart">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card pink">
          <p>Today Sales</p>
          <h2>KSh {totalSales.toLocaleString()}</h2>
        </div>

        <div className="stat-card teal">
          <p>Total Products</p>
          <h2>{products.length}</h2>
        </div>

        <button
          className="stat-card orange clickable-card"
          type="button"
          onClick={() => goTo("orders")}
        >
          <p>Open Orders</p>
          <h2>{pendingOrders.length}</h2>
        </button>

        <button
          className="stat-card danger clickable-card"
          type="button"
          onClick={() => goTo("reports")}
        >
          <p>Low Stock</p>
          <h2>{lowStockProducts.length}</h2>
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent Sales</h2>

          <button className="link-btn" type="button" onClick={() => goTo("sales")}>
            View all
          </button>
        </div>

        {sales.length === 0 ? (
          <p className="empty">No sales yet</p>
        ) : (
          sales
            .slice(-4)
            .reverse()
            .map((s, index) => (
              <div className="sale-row" key={s.id || index}>
                <div className="item-icon">
                  {s.saleType === "service" ? "🛠️" : "📦"}
                </div>

                <div>
                  <h3>{saleDisplayName(s)}</h3>
                  <p>
                    {s.saleType === "service" ? "Service" : `Qty ${s.quantity}`} •{" "}
                    {s.soldBy} • {s.paymentMethod}
                  </p>
                </div>

                <strong>KSh {Number(s.total || 0).toLocaleString()}</strong>
              </div>
            ))
        )}
      </div>
    </>
  );

  const Products = () => (
    <div className="panel">
      <h2>Products</h2>

      <div className="form-box">
        <h3>Search Products</h3>

        <input
          placeholder="Search product name or category..."
          autoComplete="off"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />

        <select
          value={productFilterCategory}
          onChange={(e) => setProductFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <p className="import-note">Showing {productsToShow.length} products</p>
      </div>

      {isAdmin && (
        <div className="form-box">
          <h3>Quick Stock Update</h3>

          <input
            placeholder="Search product before updating stock..."
            autoComplete="off"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />

          <select
            value={stockUpdate.product}
            onChange={(e) =>
              setStockUpdate({ ...stockUpdate, product: e.target.value })
            }
          >
            <option value="">Select product</option>
            {stockProductsToShow.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} - Current Stock: {p.stock}
              </option>
            ))}
          </select>

          <div className="payment-buttons">
            <button
              className={
                stockUpdate.mode === "add" ? "pay active mpesa" : "pay"
              }
              type="button"
              onClick={() => setStockUpdate({ ...stockUpdate, mode: "add" })}
            >
              Add Stock
            </button>

            <button
              className={stockUpdate.mode === "set" ? "pay active" : "pay"}
              type="button"
              onClick={() => setStockUpdate({ ...stockUpdate, mode: "set" })}
            >
              Set Exact
            </button>
          </div>

          <input
            type="number"
            inputMode="numeric"
            placeholder={
              stockUpdate.mode === "add"
                ? "Quantity to add"
                : "Set stock to this number"
            }
            value={stockUpdate.quantity}
            onChange={(e) =>
              setStockUpdate({ ...stockUpdate, quantity: e.target.value })
            }
          />

          <button className="primary-btn" type="button" onClick={updateStock}>
            Update Stock
          </button>
        </div>
      )}

      {isAdmin && (
        <>
          <div className="form-box">
            <h3>Import Products from CSV</h3>

            <p className="import-note">
              Upload your CSV file with columns: name, category, stock,
              buyingPrice, sellingPrice.
            </p>

            <input
              className="file-input"
              type="file"
              accept=".csv"
              onChange={importProductsFromCSV}
            />
          </div>

          <div className="form-box">
            <h3>Backup Data</h3>

            <p className="import-note">
              Download a backup copy of your products, sales, and orders.
            </p>

            <button
              className="primary-btn"
              type="button"
              onClick={exportProductsCSV}
            >
              Export Products CSV
            </button>

            <br />
            <br />

            <button
              className="secondary-btn"
              type="button"
              onClick={exportSalesCSV}
            >
              Export Sales CSV
            </button>

            <br />
            <br />

            <button
              className="secondary-btn"
              type="button"
              onClick={exportOrdersCSV}
            >
              Export Orders CSV
            </button>
          </div>

          <div className="form-box">
            <h3>Add Product</h3>

            <input
              placeholder="Product name"
              autoComplete="off"
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct({ ...newProduct, name: e.target.value })
              }
            />

            <input
              placeholder="Category e.g Accessories"
              autoComplete="off"
              value={newProduct.category}
              onChange={(e) =>
                setNewProduct({ ...newProduct, category: e.target.value })
              }
            />

            <input
              type="number"
              inputMode="numeric"
              placeholder="Stock quantity"
              value={newProduct.stock}
              onChange={(e) =>
                setNewProduct({ ...newProduct, stock: e.target.value })
              }
            />

            <input
              type="number"
              inputMode="numeric"
              placeholder="Buying price"
              value={newProduct.buyingPrice}
              onChange={(e) =>
                setNewProduct({ ...newProduct, buyingPrice: e.target.value })
              }
            />

            <input
              type="number"
              inputMode="numeric"
              placeholder="Selling price"
              value={newProduct.sellingPrice}
              onChange={(e) =>
                setNewProduct({ ...newProduct, sellingPrice: e.target.value })
              }
            />

            <button className="primary-btn" type="button" onClick={addProduct}>
              Add Product
            </button>
          </div>
        </>
      )}

      {!isAdmin && (
        <p className="import-note">
          Worker mode: you can view products and make sales. Admin controls are
          locked.
        </p>
      )}

      <div className="product-list">
        {productsToShow.length === 0 ? (
          <p className="empty">No products found</p>
        ) : (
          productsToShow.map((p) => (
            <div className="product-card" key={p.name}>
              <button
                className="product-main"
                type="button"
                onClick={() => openProductDetail(p)}
              >
                <div className="product-image">📱</div>

                <div className="product-info">
                  <h3>{p.name}</h3>
                  <p>{p.category || "General"}</p>
                  <span>KSh {Number(p.sellingPrice || 0).toLocaleString()}</span>
                </div>

                <div
                  className={
                    Number(p.stock || 0) <= 5 ? "stock-badge low" : "stock-badge"
                  }
                >
                  {p.stock}
                </div>
              </button>

              <div className="sale-actions">
                <button type="button" onClick={() => openProductDetail(p)}>
                  View/Edit
                </button>

                {isAdmin && (
                  <button type="button" onClick={() => deleteProduct(p.name)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const ProductDetail = () => {
    if (!selectedProduct) {
      return (
        <div className="panel">
          <h2>Product Details</h2>
          <p className="empty">Choose a product first</p>
          <button
            className="secondary-btn"
            type="button"
            onClick={() => goTo("products")}
          >
            Back to Products
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="panel">
          <button className="back-btn" type="button" onClick={() => goTo("products")}>
            ← Back to Products
          </button>

          <div className="product-detail-head">
            <div className="product-detail-icon">📱</div>

            <div>
              <p className="muted">{selectedProduct.category || "General"}</p>
              <h2>{selectedProduct.name}</h2>
              <p
                className={
                  Number(selectedProduct.stock || 0) <= 5
                    ? "danger-text"
                    : "green-text"
                }
              >
                Current stock: {selectedProduct.stock}
              </p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card teal">
              <p>Related Sales</p>
              <h2>{selectedProductSales.length}</h2>
            </div>

            <div className="stat-card pink">
              <p>Qty Sold</p>
              <h2>{selectedProductQuantitySold}</h2>
            </div>

            <div className="stat-card orange">
              <p>Total Sold</p>
              <h2>KSh {selectedProductTotalSold.toLocaleString()}</h2>
            </div>

            <div className="stat-card danger">
              <p>Profit</p>
              <h2>KSh {selectedProductProfit.toLocaleString()}</h2>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="panel">
            <h2>Edit Product</h2>

            <input
              placeholder="Product name"
              autoComplete="off"
              value={editProduct.name}
              onChange={(e) =>
                setEditProduct({ ...editProduct, name: e.target.value })
              }
            />

            <input
              placeholder="Category"
              autoComplete="off"
              value={editProduct.category}
              onChange={(e) =>
                setEditProduct({ ...editProduct, category: e.target.value })
              }
            />

            <input
              type="number"
              inputMode="numeric"
              placeholder="Stock"
              value={editProduct.stock}
              onChange={(e) =>
                setEditProduct({ ...editProduct, stock: e.target.value })
              }
            />

            <input
              type="number"
              inputMode="numeric"
              placeholder="Buying price"
              value={editProduct.buyingPrice}
              onChange={(e) =>
                setEditProduct({ ...editProduct, buyingPrice: e.target.value })
              }
            />

            <input
              type="number"
              inputMode="numeric"
              placeholder="Selling price"
              value={editProduct.sellingPrice}
              onChange={(e) =>
                setEditProduct({ ...editProduct, sellingPrice: e.target.value })
              }
            />

            <button className="primary-btn" type="button" onClick={saveEditedProduct}>
              Save Product Changes
            </button>

            <br />
            <br />

            <button className="secondary-btn" type="button" onClick={cancelEditProduct}>
              Reset Form
            </button>
          </div>
        )}

        <div className="panel">
          <h2>Related Sales</h2>

          {selectedProductSales.length === 0 ? (
            <p className="empty">No sales for this product yet</p>
          ) : (
            selectedProductSales
              .slice()
              .reverse()
              .map((s, index) => (
                <div className="sale-row" key={s.id || index}>
                  <div className="item-icon">✅</div>

                  <div>
                    <h3>{s.product}</h3>
                    <p>
                      Qty {s.quantity} • {s.soldBy} • {s.paymentMethod}
                    </p>
                    <p>
                      {s.date} {s.time}
                    </p>
                  </div>

                  <strong>KSh {Number(s.total || 0).toLocaleString()}</strong>
                </div>
              ))
          )}
        </div>
      </>
    );
  };

  const Sales = () => (
    <div className="panel">
      <h2>New Sale</h2>

      <div className="payment-buttons">
        <button
          className={sale.saleType === "product" ? "pay active" : "pay"}
          type="button"
          onClick={() =>
            setSale({
              ...sale,
              saleType: "product",
              serviceName: "",
              serviceNote: "",
            })
          }
        >
          Product
        </button>

        <button
          className={sale.saleType === "service" ? "pay active mpesa" : "pay"}
          type="button"
          onClick={() =>
            setSale({
              ...sale,
              saleType: "service",
              category: "",
              product: "",
              quantity: "",
            })
          }
        >
          Service
        </button>
      </div>

      {sale.saleType === "product" ? (
        <>
          <select
            value={sale.category}
            onChange={(e) =>
              setSale({ ...sale, category: e.target.value, product: "" })
            }
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <input
            placeholder="Search product e.g hot 50, charger, glass..."
            autoComplete="off"
            value={saleProductSearch}
            onChange={(e) => setSaleProductSearch(e.target.value)}
          />

          <select
            value={sale.product}
            disabled={!sale.category && !saleProductSearch}
            onChange={(e) => setSale({ ...sale, product: e.target.value })}
          >
            <option value="">
              {sale.category || saleProductSearch
                ? "Select product"
                : "Choose category or search first"}
            </option>

            {filteredProducts.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} - Stock: {p.stock}
              </option>
            ))}
          </select>

          <input
            type="number"
            inputMode="numeric"
            placeholder="Quantity sold"
            value={sale.quantity}
            onChange={(e) => setSale({ ...sale, quantity: e.target.value })}
          />
        </>
      ) : (
        <>
          <input
            placeholder="Service done e.g screen protector fixing"
            autoComplete="off"
            value={sale.serviceName}
            onChange={(e) => setSale({ ...sale, serviceName: e.target.value })}
          />

          <input
            placeholder="Service note (optional)"
            autoComplete="off"
            value={sale.serviceNote}
            onChange={(e) => setSale({ ...sale, serviceNote: e.target.value })}
          />
        </>
      )}

      <input
        type="number"
        inputMode="numeric"
        placeholder={sale.saleType === "service" ? "Service charge" : "Selling price"}
        value={sale.sellingPrice}
        onChange={(e) => setSale({ ...sale, sellingPrice: e.target.value })}
      />

      <select
        value={sale.soldBy}
        onChange={(e) => setSale({ ...sale, soldBy: e.target.value })}
      >
        <option value="">Sold by</option>
        {workers.map((worker) => (
          <option key={worker.id} value={worker.name}>
            {worker.name}
          </option>
        ))}
      </select>

      <div className="payment-buttons">
        {PAYMENT_METHODS.map((method) => (
          <button
            key={method}
            className={
              sale.paymentMethod === method
                ? `pay active ${method === "M-Pesa" ? "mpesa" : ""}`
                : "pay"
            }
            type="button"
            onClick={() => setSale({ ...sale, paymentMethod: method })}
          >
            {method}
          </button>
        ))}
      </div>

      <button className="primary-btn" type="button" onClick={addSale}>
        Complete {sale.saleType === "service" ? "Service" : "Sale"}
      </button>

      <div className="history">
        <h3>Sales History</h3>

        {sales.length === 0 ? (
          <p className="empty">No sales recorded</p>
        ) : (
          sales
            .slice()
            .reverse()
            .map((s, index) => {
              const realIndex = sales.length - 1 - index;

              return (
                <div className="sale-row" key={s.id || realIndex}>
                  <div className="item-icon">
                    {s.saleType === "service" ? "🛠️" : "✅"}
                  </div>

                  <div>
                    <h3>{saleDisplayName(s)}</h3>
                    <p>
                      {s.saleType === "service" ? "Service" : `Qty ${s.quantity}`} •{" "}
                      {s.soldBy} • {s.paymentMethod}
                    </p>
                  </div>

                  <div className="sale-actions">
                    <strong>KSh {Number(s.total || 0).toLocaleString()}</strong>

                    {isAdmin && (
                      <button type="button" onClick={() => deleteSale(realIndex)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );

  const Orders = () => (
    <>
      <div className="hero-card">
        <div>
          <p className="muted">Client Orders</p>
          <h1>{pendingOrders.length}</h1>
          <span className="green-text">Open orders waiting collection</span>
        </div>
      </div>

      <div className="panel">
        <h2>Add Client Order</h2>

        <div className="form-box">
          <h3>Order for Later Collection</h3>

          <input
            placeholder="Client name"
            autoComplete="off"
            value={newOrder.clientName}
            onChange={(e) =>
              setNewOrder({ ...newOrder, clientName: e.target.value })
            }
          />

          <input
            placeholder="Client phone number"
            autoComplete="off"
            value={newOrder.clientPhone}
            onChange={(e) =>
              setNewOrder({ ...newOrder, clientPhone: e.target.value })
            }
          />

          <div className="payment-buttons">
            <button
              className={newOrder.orderType === "product" ? "pay active" : "pay"}
              type="button"
              onClick={() => setNewOrder({ ...newOrder, orderType: "product" })}
            >
              Product
            </button>

            <button
              className={
                newOrder.orderType === "service" ? "pay active mpesa" : "pay"
              }
              type="button"
              onClick={() => setNewOrder({ ...newOrder, orderType: "service" })}
            >
              Service
            </button>
          </div>

          <input
            placeholder="Product/service ordered"
            autoComplete="off"
            value={newOrder.orderItem}
            onChange={(e) =>
              setNewOrder({ ...newOrder, orderItem: e.target.value })
            }
          />

          <input
            type="number"
            inputMode="numeric"
            placeholder="Total amount"
            value={newOrder.totalAmount}
            onChange={(e) =>
              setNewOrder({ ...newOrder, totalAmount: e.target.value })
            }
          />

          <input
            type="number"
            inputMode="numeric"
            placeholder="Deposit paid"
            value={newOrder.depositPaid}
            onChange={(e) =>
              setNewOrder({ ...newOrder, depositPaid: e.target.value })
            }
          />

          <label className="field-label">Order date</label>
          <input
            type="date"
            value={newOrder.orderDate}
            onChange={(e) =>
              setNewOrder({ ...newOrder, orderDate: e.target.value })
            }
          />

          <label className="field-label">Collection date</label>
          <input
            type="date"
            value={newOrder.collectionDate}
            onChange={(e) =>
              setNewOrder({ ...newOrder, collectionDate: e.target.value })
            }
          />

          <select
            value={newOrder.handledBy}
            onChange={(e) =>
              setNewOrder({ ...newOrder, handledBy: e.target.value })
            }
          >
            <option value="">Handled by</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.name}>
                {worker.name}
              </option>
            ))}
          </select>

          <select
            value={newOrder.status}
            onChange={(e) =>
              setNewOrder({ ...newOrder, status: e.target.value })
            }
          >
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <input
            placeholder="Notes (optional)"
            autoComplete="off"
            value={newOrder.notes}
            onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
          />

          <button className="primary-btn" type="button" onClick={addOrder}>
            Save Order
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Order List</h2>

        {orders.length === 0 ? (
          <p className="empty">No client orders yet</p>
        ) : (
          orders.map((order) => (
            <div className="order-card" key={order.id}>
              <div className="order-top">
                <h3>{order.clientName}</h3>
                <span className={`order-status ${String(order.status).toLowerCase()}`}>
                  {order.status}
                </span>
              </div>

              <p>
                <strong>{order.orderType === "service" ? "Service" : "Product"}:</strong>{" "}
                {order.orderItem}
              </p>

              <p>
                <strong>Phone:</strong> {order.clientPhone || "Not added"}
              </p>

              <p>
                <strong>Total:</strong> KSh{" "}
                {Number(order.totalAmount || 0).toLocaleString()} •{" "}
                <strong>Deposit:</strong> KSh{" "}
                {Number(order.depositPaid || 0).toLocaleString()}
              </p>

              <p>
                <strong>Balance:</strong> KSh{" "}
                {Number(order.balance || 0).toLocaleString()}
              </p>

              <p>
                <strong>Collect:</strong> {order.collectionDate || "Not set"} •{" "}
                <strong>By:</strong> {order.handledBy}
              </p>

              {order.notes && (
                <p>
                  <strong>Notes:</strong> {order.notes}
                </p>
              )}

              <div className="order-actions">
                {ORDER_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateOrderStatus(order.id, status)}
                  >
                    {status}
                  </button>
                ))}

                {isAdmin && (
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  const Reports = () => (
    <>
      <div className="hero-card">
        <div>
          <p className="muted">Sales Overview</p>
          <h1>KSh {totalSales.toLocaleString()}</h1>
          <span className="green-text">
            ▲ Profit: KSh {totalProfit.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="stats-grid two">
        <div className="stat-card teal">
          <p>Cash</p>
          <h2>KSh {cashTotal.toLocaleString()}</h2>
        </div>

        <div className="stat-card pink">
          <p>M-Pesa</p>
          <h2>KSh {mpesaTotal.toLocaleString()}</h2>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Daily Report</h2>
          <span className="report-count">{dailyReports.length} days</span>
        </div>

        {dailyReports.length === 0 ? (
          <p className="empty">No daily reports yet</p>
        ) : (
          <div className="daily-report-list">
            {dailyReports.map((report) => (
              <div className="daily-report-card" key={report.date}>
                <div className="daily-report-top">
                  <div>
                    <h3>{report.day}</h3>
                    <p>{report.date}</p>
                  </div>

                  <span>{report.count} sales</span>
                </div>

                <div className="daily-report-grid">
                  <div>
                    <p>Total Sales</p>
                    <strong>KSh {report.totalSales.toLocaleString()}</strong>
                  </div>

                  <div>
                    <p>Profit</p>
                    <strong>KSh {report.totalProfit.toLocaleString()}</strong>
                  </div>

                  <div>
                    <p>Cash</p>
                    <strong>KSh {report.cash.toLocaleString()}</strong>
                  </div>

                  <div>
                    <p>M-Pesa</p>
                    <strong>KSh {report.mpesa.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <button
          className="collapse-head"
          type="button"
          onClick={() => setLowStockOpen(!lowStockOpen)}
        >
          <span>
            <strong>Low Stock</strong>
            <small>{lowStockProducts.length} products need attention</small>
          </span>

          <b>{lowStockOpen ? "▲" : "▼"}</b>
        </button>

        {lowStockOpen && (
          <div className="collapse-body">
            {lowStockProducts.length === 0 ? (
              <p className="empty">No low stock products</p>
            ) : (
              lowStockProducts.map((p) => (
                <button
                  className="sale-row clickable-row"
                  key={p.name}
                  type="button"
                  onClick={() => openProductDetail(p)}
                >
                  <div className="item-icon warning">⚠️</div>

                  <div>
                    <h3>{p.name}</h3>
                    <p>Current stock: {p.stock}</p>
                  </div>

                  <strong>View</strong>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Client Orders</h2>

          <button className="link-btn" type="button" onClick={() => goTo("orders")}>
            Open
          </button>
        </div>

        <div className="stats-grid two">
          <div className="stat-card orange">
            <p>Open Orders</p>
            <h2>{pendingOrders.length}</h2>
          </div>

          <div className="stat-card teal">
            <p>Total Orders</p>
            <h2>{orders.length}</h2>
          </div>
        </div>
      </div>
    </>
  );

  const More = () => (
    <div className="panel">
      <h2>More</h2>

      <div className="form-box">
        <h3>{isAdmin ? "Admin Mode Active" : "Admin Login"}</h3>

        {!isAdmin ? (
          <>
            <input
              type="password"
              placeholder="Enter admin PIN"
              autoComplete="off"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />

            <button className="primary-btn" type="button" onClick={unlockAdmin}>
              Unlock Admin
            </button>
          </>
        ) : (
          <button className="secondary-btn" type="button" onClick={lockAdmin}>
            Lock Admin
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="form-box">
          <h3>Worker Management</h3>

          <input
            placeholder="Worker name"
            autoComplete="off"
            value={newWorker}
            onChange={(e) => setNewWorker(e.target.value)}
          />

          <button className="primary-btn" type="button" onClick={addWorker}>
            Add Worker
          </button>

          <br />
          <br />

          {workers.length === 0 ? (
            <p className="empty">No workers added yet</p>
          ) : (
            workers.map((worker) => (
              <div className="sale-row" key={worker.id}>
                <div className="item-icon">👤</div>

                <div>
                  <h3>{worker.name}</h3>
                  <p>Worker</p>
                </div>

                <div className="sale-actions">
                  <button
                    type="button"
                    onClick={() => deleteWorker(worker.id, worker.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isAdmin && (
        <>
          <button
            className="primary-btn"
            type="button"
            onClick={testSupabaseConnection}
          >
            Test Supabase Connection
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={syncProductsToSupabase}
          >
            Sync Products to Supabase
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={loadProductsFromSupabase}
          >
            Load Products from Supabase
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={loadSalesFromSupabase}
          >
            Load Sales from Supabase
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={loadDataFromSupabase}
          >
            Refresh All Data
          </button>

          <br />
          <br />
        </>
      )}

      <button className="more-card menu-card" type="button" onClick={() => goTo("orders")}>
        🧾 Client Orders — open page
      </button>

      <div className="more-card">📦 Real-time Stock — Supabase active</div>
      <div className="more-card">
        👥 Multi-worker Access — {isAdmin ? "Admin" : "Worker"} mode
      </div>
      <div className="more-card">🛠️ Product & Service Sales — active</div>
      <div className="more-card">🔐 Admin PIN — active</div>
    </div>
  );

  const pageTitle = () => {
    if (activeTab === "dashboard") return SHOP_NAME;
    if (activeTab === "products") return "Products";
    if (activeTab === "productDetail") return "Product Details";
    if (activeTab === "sales") return "New Sale";
    if (activeTab === "orders") return "Client Orders";
    if (activeTab === "reports") return "Reports";
    if (activeTab === "more") return "More";
    return SHOP_NAME;
  };

  return (
    <div className="phone-shell">
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      {SideMenu()}

      <div className="top-bar">
        <button className="menu-btn" type="button" onClick={() => setMenuOpen(true)}>
          ☰
        </button>

        <h2>{pageTitle()}</h2>

        <span className="bell">🔔</span>
      </div>

      <main className="screen">
        {activeTab === "dashboard" && Dashboard()}
        {activeTab === "products" && Products()}
        {activeTab === "productDetail" && ProductDetail()}
        {activeTab === "sales" && Sales()}
        {activeTab === "orders" && Orders()}
        {activeTab === "reports" && Reports()}
        {activeTab === "more" && More()}
      </main>

      <nav className="bottom-nav">
        <button
          className={activeTab === "dashboard" ? "active" : ""}
          type="button"
          onClick={() => goTo("dashboard")}
        >
          ⌂<span>Dashboard</span>
        </button>

        <button
          className={
            activeTab === "products" || activeTab === "productDetail"
              ? "active"
              : ""
          }
          type="button"
          onClick={() => goTo("products")}
        >
          ▣<span>Products</span>
        </button>

        <button className="big-add" type="button" onClick={() => goTo("sales")}>
          +
        </button>

        <button
          className={activeTab === "reports" ? "active" : ""}
          type="button"
          onClick={() => goTo("reports")}
        >
          ◴<span>Reports</span>
        </button>

        <button
          className={activeTab === "more" || activeTab === "orders" ? "active" : ""}
          type="button"
          onClick={() => goTo("more")}
        >
          ☰<span>More</span>
        </button>
      </nav>
    </div>
  );
}

export default App;