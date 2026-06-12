import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

const SHOP_NAME = "Yusuf Stock Pro";
const ADMIN_PIN = "0987";
const PAYMENT_METHODS = ["Cash", "M-Pesa"];
const ORDER_STATUSES = ["Pending", "Ready", "Collected", "Cancelled"];

const DEFAULT_WORKERS = ["Dennis", "Benjamin", "Kijana", "Muuo", "Mutavi", "Collins"];

const DEFAULT_BRANCHES = [
  { shop_number: 1, name: "Gossip Branch", is_active: true },
  { shop_number: 2, name: "Deliverance Road Branch", is_active: true },
  { shop_number: 3, name: "3d's Branch", is_active: true },
  { shop_number: 4, name: "Tuffoam Branch", is_active: true },
];

const money = (value) => `KSh ${Number(value || 0).toLocaleString()}`;

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const pad = (n) => String(n).padStart(2, "0");

function dateKeyFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const todayKey = () => dateKeyFromDate(new Date());

function parseDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return null;
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function normalizeSaleDate(saleDate, createdAt) {
  if (saleDate && /^\d{4}-\d{2}-\d{2}$/.test(String(saleDate))) {
    return String(saleDate);
  }

  const fromSale = saleDate ? new Date(saleDate) : null;
  if (fromSale && !Number.isNaN(fromSale.getTime())) {
    return dateKeyFromDate(fromSale);
  }

  const fromCreated = createdAt ? new Date(createdAt) : null;
  if (fromCreated && !Number.isNaN(fromCreated.getTime())) {
    return dateKeyFromDate(fromCreated);
  }

  return todayKey();
}

function niceDate(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return dateKey || "Unknown date";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dayOnly(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return "Day";
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function categoryType(category = "") {
  const text = String(category).toLowerCase();

  if (text.includes("charger") || text.includes("adapter")) return "charger";
  if (text.includes("protector") || text.includes("glass") || text.includes("screen")) return "protector";
  if (text.includes("earpod") || text.includes("airpod") || text.includes("bud")) return "earpods";
  if (text.includes("earphone") || text.includes("handsfree") || text.includes("wired")) return "earphones";
  if (text.includes("headphone") || text.includes("headset")) return "headphones";
  if (text.includes("cable") || text.includes("usb")) return "cable";
  if (text.includes("power") || text.includes("bank")) return "powerbank";
  if (text.includes("cover") || text.includes("case") || text.includes("pouch")) return "cover";
  if (text.includes("repair") || text.includes("motherboard") || text.includes("flex")) return "repair";

  return "phone";
}

function CategoryVector({ category }) {
  return (
    <div className={`category-vector ${categoryType(category)}`}>
      <span className="v-one" />
      <span className="v-two" />
      <span className="v-three" />
    </div>
  );
}

function ChoiceGrid({
  label,
  helper,
  value,
  options,
  onChange,
  emptyText,
  branch = false,
}) {
  const selected = options.find((item) => item.name === value);

  return (
    <div className="choice-panel">
      <div className="choice-head">
        <div>
          <label className="field-label no-margin">{label}</label>
          <p>{helper}</p>
        </div>

        <span className={selected ? "selected-pill active" : "selected-pill"}>
          {selected ? selected.name : "Not selected"}
        </span>
      </div>

      {options.length === 0 ? (
        <p className="empty small-empty">{emptyText}</p>
      ) : (
        <div className="choice-grid">
          {options.map((item) => {
            const active = value === item.name;

            return (
              <button
                key={item.id || item.name}
                type="button"
                className={active ? "choice-card active" : "choice-card"}
                onClick={() => onChange(item.name)}
              >
                <span className="choice-avatar">
                  {branch
                    ? item.shop_number
                      ? `S${item.shop_number}`
                      : "🏪"
                    : initials(item.name)}
                </span>

                <span className="choice-info">
                  <strong>{item.name}</strong>
                  <small>{branch ? "Branch" : "Worker"}</small>
                </span>

                <span className="choice-mark">{active ? "✓" : "+"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("isAdmin") === "true"
  );
  const [pinInput, setPinInput] = useState("");
  const [toast, setToast] = useState(null);

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [orders, setOrders] = useState([]);

  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [stockSearch, setStockSearch] = useState("");
  const [expandedReport, setExpandedReport] = useState(todayKey());
  const [reportBranch, setReportBranch] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    stock: "",
    buyingPrice: "",
    sellingPrice: "",
  });

  const [editProduct, setEditProduct] = useState({
    name: "",
    category: "",
    stock: "",
    buyingPrice: "",
    sellingPrice: "",
  });

  const [stockUpdate, setStockUpdate] = useState({
    product: "",
    mode: "add",
    quantity: "",
  });

  const [sale, setSale] = useState({
    saleType: "product",
    category: "",
    product: "",
    quantity: "",
    sellingPrice: "",
    serviceName: "",
    serviceNote: "",
    soldBy: "",
    branchName: "",
    paymentMethod: "Cash",
  });

  const [newOrder, setNewOrder] = useState({
    clientName: "",
    clientPhone: "",
    orderType: "product",
    orderItem: "",
    totalAmount: "",
    depositPaid: "",
    collectionDate: "",
    status: "Pending",
    handledBy: "",
    notes: "",
  });

  const [newWorker, setNewWorker] = useState("");
  const [editingWorkerId, setEditingWorkerId] = useState("");
  const [workerEditName, setWorkerEditName] = useState("");

  const [newBranch, setNewBranch] = useState({
    shop_number: "",
    name: "",
  });

  const [editingBranchId, setEditingBranchId] = useState("");

  const [branchEdit, setBranchEdit] = useState({
    shop_number: "",
    name: "",
  });

  const loadTimer = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 3500);
  };

  const goTo = (tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const mapProduct = (p) => ({
    id: p.id,
    name: p.name,
    category: p.category || "General",
    stock: num(p.stock),
    buyingPrice: num(p.buying_price),
    sellingPrice: num(p.selling_price),
  });

  const mapSale = (s) => {
    const dateKey = normalizeSaleDate(s.sale_date, s.created_at);

    return {
      id: s.id,
      saleType: s.sale_type || (s.service_name ? "service" : "product"),
      product: s.product || s.service_name || "Service",
      serviceName: s.service_name || "",
      serviceNote: s.service_note || "",
      quantity: num(s.quantity),
      sellingPrice: num(s.selling_price),
      paymentMethod: s.payment_method || "Cash",
      soldBy: s.worker_name || s.sold_by || "Unassigned",
      branchName: s.branch_name || "Unassigned",
      total: num(s.total),
      profit: num(s.profit),
      dateKey,
      saleDate: s.sale_date || dateKey,
      saleTime: s.sale_time || "",
      createdAt: s.created_at || "",
    };
  };

  const mapWorker = (w) => ({
    id: w.id,
    name: w.name,
    is_active: w.is_active !== false,
  });

  const mapBranch = (b) => ({
    id: b.id,
    shop_number: b.shop_number,
    name: b.name,
    is_active: b.is_active !== false,
  });

  const mapOrder = (o) => ({
    id: o.id,
    clientName: o.client_name || "",
    clientPhone: o.client_phone || "",
    orderType: o.order_type || "product",
    orderItem: o.order_item || "",
    totalAmount: num(o.total_amount),
    depositPaid: num(o.deposit_paid),
    balance: num(o.balance),
    orderDate: o.order_date || "",
    collectionDate: o.collection_date || "",
    status: o.status || "Pending",
    handledBy: o.handled_by || "",
    notes: o.notes || "",
  });

  const loadData = async () => {
    const [p, s, w, b, o] = await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("sales").select("*").order("created_at", { ascending: false }),
      supabase.from("workers").select("*").order("name", { ascending: true }),
      supabase.from("branches").select("*").order("shop_number", { ascending: true }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
    ]);

    if (!p.error && p.data) {
      setProducts(p.data.map(mapProduct));
    }

    if (!s.error && s.data) {
      setSales(s.data.map(mapSale));
    }

    if (!w.error && w.data) {
      const list = w.data.map(mapWorker);
      setWorkers(
        list.length
          ? list
          : DEFAULT_WORKERS.map((name) => ({ name, is_active: true }))
      );
    }

    if (!b.error && b.data) {
      const list = b.data.map(mapBranch);
      setBranches(list.length ? list : DEFAULT_BRANCHES);
    }

    if (!o.error && o.data) {
      setOrders(o.data.map(mapOrder));
    }
  };

  const scheduleLoad = () => {
    window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(loadData, 650);
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("yusuf-stock-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        scheduleLoad
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        scheduleLoad
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workers" },
        scheduleLoad
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "branches" },
        scheduleLoad
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        scheduleLoad
      )
      .subscribe();

    return () => {
      window.clearTimeout(loadTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const activeWorkers = useMemo(() => {
    const list = workers.filter((w) => w.is_active !== false && w.name);

    return list.length
      ? list
      : DEFAULT_WORKERS.map((name) => ({ name, is_active: true }));
  }, [workers]);

  const activeBranches = useMemo(() => {
    const list = branches.filter((b) => b.is_active !== false && b.name);
    return list.length ? list : DEFAULT_BRANCHES;
  }, [branches]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(products.map((p) => p.category || "General"))
    ).sort();
  }, [products]);

  const categoryStats = useMemo(() => {
    return categories.map((category) => {
      const list = products.filter((p) => (p.category || "General") === category);

      return {
        category,
        count: list.length,
        stock: list.reduce((sum, p) => sum + num(p.stock), 0),
      };
    });
  }, [categories, products]);

  const productsToShow = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    return products
      .filter(
        (p) =>
          selectedCategory === "All" ||
          (p.category || "General") === selectedCategory
      )
      .filter(
        (p) =>
          !search ||
          `${p.name} ${p.category}`.toLowerCase().includes(search)
      );
  }, [products, selectedCategory, productSearch]);

  const saleProducts = useMemo(() => {
    const search = sale.product.trim().toLowerCase();

    return products
      .filter((p) => !sale.category || (p.category || "General") === sale.category)
      .filter((p) => num(p.stock) > 0)
      .filter(
        (p) =>
          !search ||
          `${p.name} ${p.category}`.toLowerCase().includes(search)
      );
  }, [products, sale.category, sale.product]);

  const lowStock = useMemo(
    () => products.filter((p) => num(p.stock) <= 5),
    [products]
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => !["Collected", "Cancelled"].includes(o.status)),
    [orders]
  );

  const todaysSales = useMemo(
    () => sales.filter((s) => s.dateKey === todayKey()),
    [sales]
  );

  const todaySalesTotal = useMemo(
    () => todaysSales.reduce((sum, s) => sum + num(s.total), 0),
    [todaysSales]
  );

  const todayProfit = useMemo(
    () => todaysSales.reduce((sum, s) => sum + num(s.profit), 0),
    [todaysSales]
  );

  const dailyReports = useMemo(() => {
    const today = parseDateKey(todayKey());
    const saleKeys = sales.map((s) => s.dateKey).filter(Boolean).sort();
    const earliest = saleKeys[0] ? parseDateKey(saleKeys[0]) : today;
    const start = earliest && today ? earliest : today;
    const days = Math.max(0, Math.round((today - start) / 86400000));
    const keys = [];

    for (let i = 0; i <= days; i += 1) {
      keys.push(dateKeyFromDate(addDays(today, -i)));
    }

    return keys.map((key) => {
      const daySales = sales.filter((s) => s.dateKey === key);

      const branchNames = Array.from(
        new Set([
          ...activeBranches.map((b) => b.name),
          ...daySales.map((s) => s.branchName || "Unassigned"),
        ])
      ).filter(Boolean);

      const branchReports = branchNames.map((branchName) => {
        const list = daySales.filter(
          (s) => (s.branchName || "Unassigned") === branchName
        );

        const branch = activeBranches.find((b) => b.name === branchName);

        return {
          branchName,
          shop_number: branch?.shop_number,
          totalSales: list.reduce((sum, s) => sum + num(s.total), 0),
          totalProfit: list.reduce((sum, s) => sum + num(s.profit), 0),
          count: list.length,
          sales: list,
        };
      });

      const workerMap = {};

      daySales.forEach((s) => {
        const name = s.soldBy || "Unassigned";

        if (!workerMap[name]) {
          workerMap[name] = {
            workerName: name,
            totalSales: 0,
            totalProfit: 0,
            count: 0,
          };
        }

        workerMap[name].totalSales += num(s.total);
        workerMap[name].totalProfit += num(s.profit);
        workerMap[name].count += 1;
      });

      return {
        dateKey: key,
        day: dayOnly(key),
        label: niceDate(key),
        sales: daySales,
        totalSales: daySales.reduce((sum, s) => sum + num(s.total), 0),
        totalProfit: daySales.reduce((sum, s) => sum + num(s.profit), 0),
        cash: daySales
          .filter((s) => s.paymentMethod === "Cash")
          .reduce((sum, s) => sum + num(s.total), 0),
        mpesa: daySales
          .filter((s) => s.paymentMethod === "M-Pesa")
          .reduce((sum, s) => sum + num(s.total), 0),
        count: daySales.length,
        branchReports,
        workerReports: Object.values(workerMap).sort(
          (a, b) => b.totalSales - a.totalSales
        ),
      };
    });
  }, [sales, activeBranches]);

  const openProduct = (product) => {
    setSelectedProduct(product);
    setEditProduct({
      name: product.name,
      category: product.category,
      stock: String(product.stock),
      buyingPrice: String(product.buyingPrice),
      sellingPrice: String(product.sellingPrice),
    });
    goTo("productDetail");
  };

  const selectedProductSales = useMemo(() => {
    if (!selectedProduct) return [];

    return sales.filter(
      (s) => s.product?.toLowerCase() === selectedProduct.name.toLowerCase()
    );
  }, [sales, selectedProduct]);

  const unlockAdmin = () => {
    if (pinInput !== ADMIN_PIN) return alert("Wrong PIN");

    setIsAdmin(true);
    localStorage.setItem("isAdmin", "true");
    setPinInput("");
    showToast("Admin mode unlocked ✅");
  };

  const lockAdmin = () => {
    setIsAdmin(false);
    localStorage.removeItem("isAdmin");
    showToast("Admin mode locked");
  };

  const addProduct = async () => {
    const name = newProduct.name.trim();

    if (
      !name ||
      newProduct.stock === "" ||
      newProduct.buyingPrice === "" ||
      newProduct.sellingPrice === ""
    ) {
      return alert("Fill product name, stock, buying price, and selling price");
    }

    const exists = products.some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) return alert("This product already exists");

    const { error } = await supabase.from("products").upsert(
      {
        name,
        category: newProduct.category.trim() || "General",
        stock: num(newProduct.stock),
        buying_price: num(newProduct.buyingPrice),
        selling_price: num(newProduct.sellingPrice),
      },
      { onConflict: "name" }
    );

    if (error) return alert("Product failed to save: " + error.message);

    setNewProduct({
      name: "",
      category: "",
      stock: "",
      buyingPrice: "",
      sellingPrice: "",
    });

    showToast("Product saved ✅");
    loadData();
  };

  const saveProduct = async () => {
    if (!selectedProduct) return;

    const name = editProduct.name.trim();

    if (
      !name ||
      editProduct.stock === "" ||
      editProduct.buyingPrice === "" ||
      editProduct.sellingPrice === ""
    ) {
      return alert("Fill all product details");
    }

    const duplicate = products.some(
      (p) =>
        p.name.toLowerCase() === name.toLowerCase() &&
        p.name.toLowerCase() !== selectedProduct.name.toLowerCase()
    );

    if (duplicate) return alert("Another product already has this name");

    const { error } = await supabase
      .from("products")
      .update({
        name,
        category: editProduct.category.trim() || "General",
        stock: num(editProduct.stock),
        buying_price: num(editProduct.buyingPrice),
        selling_price: num(editProduct.sellingPrice),
      })
      .eq("name", selectedProduct.name);

    if (error) return alert("Product update failed: " + error.message);

    showToast("Product updated ✅");

    setSelectedProduct({
      ...selectedProduct,
      name,
      category: editProduct.category,
      stock: num(editProduct.stock),
      buyingPrice: num(editProduct.buyingPrice),
      sellingPrice: num(editProduct.sellingPrice),
    });

    loadData();
  };

  const deleteProduct = async (name) => {
    if (!isAdmin) return alert("Admin only");

    if (!confirm(`Delete ${name}?`)) return;

    const { error } = await supabase.from("products").delete().eq("name", name);

    if (error) return alert("Delete failed: " + error.message);

    showToast("Product deleted");
    goTo("products");
    loadData();
  };

  const updateStock = async () => {
    const product = products.find((p) => p.name === stockUpdate.product);

    if (!product) return alert("Choose product");

    const quantity = num(stockUpdate.quantity);

    if (stockUpdate.quantity === "" || quantity < 0) {
      return alert("Enter a valid stock number");
    }

    const newStock =
      stockUpdate.mode === "add" ? num(product.stock) + quantity : quantity;

    const { error } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("name", product.name);

    if (error) return alert("Stock update failed: " + error.message);

    setStockUpdate({ product: "", mode: "add", quantity: "" });
    showToast("Stock updated ✅");
    loadData();
  };

  const addSale = async () => {
    const isService = sale.saleType === "service";
    const sellingPrice = num(sale.sellingPrice);
    const quantity = isService ? 1 : num(sale.quantity);
    const saleDate = todayKey();
    const saleTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (!sale.soldBy) return alert("Choose worker");
    if (!sale.branchName) return alert("Choose shop branch");
    if (!sellingPrice || sellingPrice <= 0) return alert("Enter selling price");

    if (isService) {
      const serviceName = sale.serviceName.trim();

      if (!serviceName) return alert("Enter service name");

      const total = sellingPrice;
      const profit = sellingPrice;

      const { error } = await supabase.from("sales").insert({
        sale_type: "service",
        product: serviceName,
        service_name: serviceName,
        service_note: sale.serviceNote.trim(),
        quantity: 1,
        selling_price: sellingPrice,
        payment_method: sale.paymentMethod,
        sold_by: sale.soldBy,
        worker_name: sale.soldBy,
        branch_name: sale.branchName,
        total,
        profit,
        sale_date: saleDate,
        sale_time: saleTime,
      });

      if (error) return alert("Service failed to save: " + error.message);

      setSale((current) => ({
        ...current,
        saleType: "product",
        category: "",
        product: "",
        quantity: "",
        sellingPrice: "",
        serviceName: "",
        serviceNote: "",
      }));

      showToast(`Service saved • ${sale.soldBy} • ${sale.branchName}`);
      loadData();
      return;
    }

    const product = products.find((p) => p.name === sale.product);

    if (!product) return alert("Choose product");
    if (!quantity || quantity <= 0) return alert("Enter quantity");
    if (quantity > num(product.stock)) return alert("Not enough stock");

    const total = sellingPrice * quantity;
    const profit = (sellingPrice - num(product.buyingPrice)) * quantity;
    const newStock = num(product.stock) - quantity;

    const { error: saleError } = await supabase.from("sales").insert({
      sale_type: "product",
      product: product.name,
      service_name: null,
      service_note: null,
      quantity,
      selling_price: sellingPrice,
      payment_method: sale.paymentMethod,
      sold_by: sale.soldBy,
      worker_name: sale.soldBy,
      branch_name: sale.branchName,
      total,
      profit,
      sale_date: saleDate,
      sale_time: saleTime,
    });

    if (saleError) return alert("Sale failed to save: " + saleError.message);

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("name", product.name);

    if (stockError) {
      return alert("Sale saved, but stock failed to update: " + stockError.message);
    }

    setSale((current) => ({
      ...current,
      category: "",
      product: "",
      quantity: "",
      sellingPrice: "",
      serviceName: "",
      serviceNote: "",
    }));

    showToast(`${product.name} sold • ${sale.branchName}`);
    loadData();
  };

  const deleteSale = async (id) => {
    if (!isAdmin) return alert("Admin only");

    if (!confirm("Delete this sale?")) return;

    const { error } = await supabase.from("sales").delete().eq("id", id);

    if (error) return alert("Sale delete failed: " + error.message);

    showToast("Sale deleted");
    loadData();
  };

  const addOrder = async () => {
    const totalAmount = num(newOrder.totalAmount);
    const depositPaid = num(newOrder.depositPaid);

    if (!newOrder.clientName.trim() || !newOrder.orderItem.trim() || !newOrder.handledBy) {
      return alert("Fill client name, item/service, and handled by");
    }

    if (depositPaid > totalAmount) return alert("Deposit cannot be more than total");

    const { error } = await supabase.from("orders").insert({
      client_name: newOrder.clientName.trim(),
      client_phone: newOrder.clientPhone.trim(),
      order_type: newOrder.orderType,
      order_item: newOrder.orderItem.trim(),
      total_amount: totalAmount,
      deposit_paid: depositPaid,
      balance: totalAmount - depositPaid,
      order_date: todayKey(),
      collection_date: newOrder.collectionDate || null,
      status: newOrder.status,
      handled_by: newOrder.handledBy,
      notes: newOrder.notes.trim(),
    });

    if (error) return alert("Order failed to save: " + error.message);

    setNewOrder({
      clientName: "",
      clientPhone: "",
      orderType: "product",
      orderItem: "",
      totalAmount: "",
      depositPaid: "",
      collectionDate: "",
      status: "Pending",
      handledBy: "",
      notes: "",
    });

    showToast("Order saved ✅");
    loadData();
  };

  const updateOrderStatus = async (id, status) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);

    if (error) return alert("Order update failed: " + error.message);

    showToast(`Order marked ${status}`);
    loadData();
  };

  const deleteOrder = async (id) => {
    if (!isAdmin) return alert("Admin only");

    if (!confirm("Delete order?")) return;

    const { error } = await supabase.from("orders").delete().eq("id", id);

    if (error) return alert("Order delete failed: " + error.message);

    showToast("Order deleted");
    loadData();
  };

  const addWorker = async () => {
    const name = newWorker.trim();

    if (!name) return alert("Enter worker name");

    if (workers.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
      return alert("Worker already exists");
    }

    const { error } = await supabase.from("workers").insert({
      name,
      is_active: true,
    });

    if (error) return alert("Worker failed to save: " + error.message);

    setNewWorker("");
    showToast("Worker added ✅");
    loadData();
  };

  const saveWorker = async (worker) => {
    const name = workerEditName.trim();

    if (!name) return alert("Enter worker name");

    const duplicate = workers.some(
      (w) => w.id !== worker.id && w.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) return alert("Another worker already has that name");

    const { error } = await supabase
      .from("workers")
      .update({ name })
      .eq("id", worker.id);

    if (error) return alert("Worker update failed: " + error.message);

    setEditingWorkerId("");
    setWorkerEditName("");
    showToast("Worker updated ✅");
    loadData();
  };

  const toggleWorker = async (worker) => {
    const { error } = await supabase
      .from("workers")
      .update({ is_active: worker.is_active === false })
      .eq("id", worker.id);

    if (error) return alert("Worker status failed: " + error.message);

    showToast(worker.is_active === false ? "Worker reactivated" : "Worker deactivated");
    loadData();
  };

  const addBranch = async () => {
    const name = newBranch.name.trim();

    if (!name) return alert("Enter branch name");

    if (branches.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      return alert("Branch already exists");
    }

    const { error } = await supabase.from("branches").insert({
      name,
      shop_number: newBranch.shop_number ? num(newBranch.shop_number) : null,
      is_active: true,
    });

    if (error) return alert("Branch failed to save: " + error.message);

    setNewBranch({ shop_number: "", name: "" });
    showToast("Branch added ✅");
    loadData();
  };

  const saveBranch = async (branch) => {
    const name = branchEdit.name.trim();

    if (!name) return alert("Enter branch name");

    const duplicate = branches.some(
      (b) => b.id !== branch.id && b.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) return alert("Another branch already has that name");

    const { error } = await supabase
      .from("branches")
      .update({
        name,
        shop_number: branchEdit.shop_number ? num(branchEdit.shop_number) : null,
      })
      .eq("id", branch.id);

    if (error) return alert("Branch update failed: " + error.message);

    setEditingBranchId("");
    setBranchEdit({ shop_number: "", name: "" });
    showToast("Branch updated ✅");
    loadData();
  };

  const toggleBranch = async (branch) => {
    const { error } = await supabase
      .from("branches")
      .update({ is_active: branch.is_active === false })
      .eq("id", branch.id);

    if (error) return alert("Branch status failed: " + error.message);

    showToast(branch.is_active === false ? "Branch reactivated" : "Branch deactivated");
    loadData();
  };

  const downloadCSV = (filename, rows) => {
    if (!rows.length) return alert("No data to export");

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  };

  const testConnection = async () => {
    const { error } = await supabase.from("products").select("*").limit(1);

    if (error) return alert("Supabase error: " + error.message);

    showToast("Supabase connected ✅");
  };

  const saleName = (s) =>
    s.saleType === "service" ? s.serviceName || s.product : s.product;

  const SideMenu = () => (
    <>
      {menuOpen && (
        <button
          className="menu-backdrop"
          type="button"
          onClick={() => setMenuOpen(false)}
        />
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

        <button type="button" onClick={() => goTo("dashboard")}>🏠 Dashboard</button>
        <button type="button" onClick={() => goTo("products")}>📦 Products</button>
        <button type="button" onClick={() => goTo("sales")}>➕ New Sale</button>
        <button type="button" onClick={() => goTo("orders")}>🧾 Client Orders</button>
        <button type="button" onClick={() => goTo("reports")}>📊 Reports</button>
        <button type="button" onClick={() => goTo("more")}>⚙️ More</button>
      </aside>
    </>
  );

  const Dashboard = () => (
    <>
      <div className="hero-card">
        <div>
          <p className="muted">Today • {niceDate(todayKey())}</p>
          <h1>{money(todaySalesTotal)}</h1>
          <span className="green-text">Today’s Total Sales</span>
        </div>

        <div className="mini-chart">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card pink">
          <p>Today Profit</p>
          <h2>{money(todayProfit)}</h2>
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
          onClick={() => goTo("products")}
        >
          <p>Low Stock</p>
          <h2>{lowStock.length}</h2>
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
          sales.slice(0, 5).map((s) => (
            <div className="sale-row" key={s.id}>
              <div className="item-icon">{s.saleType === "service" ? "🛠️" : "📦"}</div>

              <div>
                <h3>{saleName(s)}</h3>
                <p>{s.soldBy} • {s.branchName} • {s.paymentMethod}</p>
              </div>

              <strong>{money(s.total)}</strong>
            </div>
          ))
        )}
      </div>
    </>
  );

  const Products = () => (
    <div className="panel stable-form">
      <div className="panel-head">
        <h2>Products</h2>
        <span className="report-count">{productsToShow.length} shown</span>
      </div>

      <input
        placeholder="Search product or category..."
        autoComplete="off"
        value={productSearch}
        onChange={(e) => setProductSearch(e.target.value)}
      />

      <div className="category-tabs">
        <button
          type="button"
          className={selectedCategory === "All" ? "cat-tab active" : "cat-tab"}
          onClick={() => setSelectedCategory("All")}
        >
          All
        </button>

        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={selectedCategory === cat ? "cat-tab active" : "cat-tab"}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="category-card-grid">
        {categoryStats.slice(0, 10).map((cat) => (
          <button
            key={cat.category}
            type="button"
            className={selectedCategory === cat.category ? "category-card active" : "category-card"}
            onClick={() => setSelectedCategory(cat.category)}
          >
            <CategoryVector category={cat.category} />
            <strong>{cat.category}</strong>
            <small>{cat.count} products • {cat.stock} stock</small>
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="form-box">
          <h3>Quick Stock Update</h3>

          <input
            placeholder="Search product before choosing below..."
            autoComplete="off"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />

          <select
            value={stockUpdate.product}
            onChange={(e) => setStockUpdate({ ...stockUpdate, product: e.target.value })}
          >
            <option value="">Select product</option>
            {products
              .filter(
                (p) =>
                  !stockSearch ||
                  `${p.name} ${p.category}`.toLowerCase().includes(stockSearch.toLowerCase())
              )
              .map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} - Current stock: {p.stock}
                </option>
              ))}
          </select>

          <div className="payment-buttons">
            <button
              type="button"
              className={stockUpdate.mode === "add" ? "pay active mpesa" : "pay"}
              onClick={() => setStockUpdate({ ...stockUpdate, mode: "add" })}
            >
              Add Stock
            </button>

            <button
              type="button"
              className={stockUpdate.mode === "set" ? "pay active" : "pay"}
              onClick={() => setStockUpdate({ ...stockUpdate, mode: "set" })}
            >
              Set Exact
            </button>
          </div>

          <input
            type="number"
            inputMode="numeric"
            placeholder={stockUpdate.mode === "add" ? "Quantity to add" : "Set exact stock"}
            value={stockUpdate.quantity}
            onChange={(e) => setStockUpdate({ ...stockUpdate, quantity: e.target.value })}
          />

          <button className="primary-btn" type="button" onClick={updateStock}>
            Update Stock
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="form-box">
          <h3>Add Product</h3>

          <input
            placeholder="Product name"
            autoComplete="off"
            value={newProduct.name}
            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
          />

          <input
            placeholder="Category e.g Chargers"
            autoComplete="off"
            value={newProduct.category}
            onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
          />

          <input
            type="number"
            inputMode="numeric"
            placeholder="Stock quantity"
            value={newProduct.stock}
            onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
          />

          <input
            type="number"
            inputMode="decimal"
            placeholder="Buying price"
            value={newProduct.buyingPrice}
            onChange={(e) => setNewProduct({ ...newProduct, buyingPrice: e.target.value })}
          />

          <input
            type="number"
            inputMode="decimal"
            placeholder="Selling price"
            value={newProduct.sellingPrice}
            onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: e.target.value })}
          />

          <button className="primary-btn" type="button" onClick={addProduct}>
            Add Product
          </button>
        </div>
      )}

      <div className="product-table">
        {productsToShow.length === 0 ? (
          <p className="empty">No products found</p>
        ) : (
          productsToShow.map((p) => (
            <button
              className="product-row"
              type="button"
              key={p.name}
              onClick={() => openProduct(p)}
            >
              <CategoryVector category={p.category} />

              <div className="product-copy">
                <h3>{p.name}</h3>
                <p>{p.category || "General"}</p>
                <strong>{money(p.sellingPrice)}</strong>
              </div>

              <div className={p.stock <= 5 ? "stock-badge low" : "stock-badge"}>
                {p.stock}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const ProductDetail = () => {
    if (!selectedProduct) {
      return (
        <div className="panel">
          <button className="back-btn" type="button" onClick={() => goTo("products")}>
            ← Back
          </button>
          <p className="empty">Select a product first</p>
        </div>
      );
    }

    const productSalesTotal = selectedProductSales.reduce(
      (sum, s) => sum + num(s.total),
      0
    );

    const productProfit = selectedProductSales.reduce(
      (sum, s) => sum + num(s.profit),
      0
    );

    const qtySold = selectedProductSales.reduce(
      (sum, s) => sum + num(s.quantity),
      0
    );

    return (
      <>
        <div className="panel">
          <button className="back-btn" type="button" onClick={() => goTo("products")}>
            ← Back to Products
          </button>

          <div className="product-detail-head">
            <CategoryVector category={selectedProduct.category} />

            <div>
              <p className="muted">{selectedProduct.category}</p>
              <h2>{selectedProduct.name}</h2>
              <p className={selectedProduct.stock <= 5 ? "danger-text" : "green-text"}>
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
              <h2>{qtySold}</h2>
            </div>

            <div className="stat-card orange">
              <p>Total Sold</p>
              <h2>{money(productSalesTotal)}</h2>
            </div>

            <div className="stat-card danger">
              <p>Profit</p>
              <h2>{money(productProfit)}</h2>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="panel stable-form">
            <h2>Edit Product</h2>

            <input
              value={editProduct.name}
              onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
            />

            <input
              value={editProduct.category}
              onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
            />

            <input
              type="number"
              value={editProduct.stock}
              onChange={(e) => setEditProduct({ ...editProduct, stock: e.target.value })}
            />

            <input
              type="number"
              value={editProduct.buyingPrice}
              onChange={(e) => setEditProduct({ ...editProduct, buyingPrice: e.target.value })}
            />

            <input
              type="number"
              value={editProduct.sellingPrice}
              onChange={(e) => setEditProduct({ ...editProduct, sellingPrice: e.target.value })}
            />

            <button className="primary-btn" type="button" onClick={saveProduct}>
              Save Changes
            </button>

            <br />
            <br />

            <button
              className="secondary-btn"
              type="button"
              onClick={() => deleteProduct(selectedProduct.name)}
            >
              Delete Product
            </button>
          </div>
        )}

        <div className="panel">
          <h2>Related Sales</h2>

          {selectedProductSales.length === 0 ? (
            <p className="empty">No sales yet</p>
          ) : (
            selectedProductSales.map((s) => (
              <div className="sale-row" key={s.id}>
                <div className="item-icon">✅</div>

                <div>
                  <h3>{saleName(s)}</h3>
                  <p>Qty {s.quantity} • {s.soldBy} • {s.branchName}</p>
                  <p>{niceDate(s.dateKey)} • {s.paymentMethod}</p>
                </div>

                <strong>{money(s.total)}</strong>
              </div>
            ))
          )}
        </div>
      </>
    );
  };

  const Sales = () => (
    <div className="panel stable-form">
      <h2>New Sale</h2>

      <div className="payment-buttons">
        <button
          type="button"
          className={sale.saleType === "product" ? "pay active" : "pay"}
          onClick={() => setSale({ ...sale, saleType: "product" })}
        >
          Product
        </button>

        <button
          type="button"
          className={sale.saleType === "service" ? "pay active mpesa" : "pay"}
          onClick={() => setSale({ ...sale, saleType: "service" })}
        >
          Service
        </button>
      </div>

      {sale.saleType === "product" ? (
        <>
          <select
            value={sale.category}
            onChange={(e) => setSale({ ...sale, category: e.target.value, product: "" })}
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <input
            placeholder="Search product e.g charger, glass, earpods..."
            autoComplete="off"
            value={sale.product}
            onChange={(e) => setSale({ ...sale, product: e.target.value })}
          />

          <select
            value={products.some((p) => p.name === sale.product) ? sale.product : ""}
            onChange={(e) =>
              setSale({
                ...sale,
                product: e.target.value,
                sellingPrice:
                  products.find((p) => p.name === e.target.value)?.sellingPrice ||
                  sale.sellingPrice,
              })
            }
          >
            <option value="">Choose product from list</option>
            {saleProducts.map((p) => (
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
            placeholder="Service done e.g screen replacement"
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
        inputMode="decimal"
        placeholder={sale.saleType === "service" ? "Service charge" : "Selling price per item"}
        value={sale.sellingPrice}
        onChange={(e) => setSale({ ...sale, sellingPrice: e.target.value })}
      />

      <ChoiceGrid
        label="Sold by"
        helper="Tap the worker recording this sale."
        value={sale.soldBy}
        options={activeWorkers}
        onChange={(name) => setSale({ ...sale, soldBy: name })}
        emptyText="No active workers. Add workers in Admin Settings."
      />

      <ChoiceGrid
        label="Shop branch"
        helper="Tap the branch where this sale happened."
        value={sale.branchName}
        options={activeBranches}
        onChange={(name) => setSale({ ...sale, branchName: name })}
        emptyText="No active branches. Add branches in Admin Settings."
        branch
      />

      <div className="payment-buttons">
        {PAYMENT_METHODS.map((method) => (
          <button
            key={method}
            type="button"
            className={
              sale.paymentMethod === method
                ? `pay active ${method === "M-Pesa" ? "mpesa" : ""}`
                : "pay"
            }
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
          sales.slice(0, 30).map((s) => (
            <div className="sale-row" key={s.id}>
              <div className="item-icon">
                {s.saleType === "service" ? "🛠️" : "🛒"}
              </div>

              <div>
                <h3>{saleName(s)}</h3>
                <p>
                  {s.saleType === "service" ? "Service" : `Qty ${s.quantity}`} •{" "}
                  {s.soldBy} • {s.branchName}
                </p>
                <p>{niceDate(s.dateKey)} • {s.paymentMethod}</p>
              </div>

              <strong>{money(s.total)}</strong>

              {isAdmin && (
                <button
                  className="tiny-delete"
                  type="button"
                  onClick={() => deleteSale(s.id)}
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const Reports = () => (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Reports</h2>
          <p className="panel-subtitle">Daily sales, profit, branches, and workers.</p>
        </div>

        <span className="report-count">{dailyReports.length} days</span>
      </div>

      <div className="daily-report-list">
        {dailyReports.map((report) => {
          const open = expandedReport === report.dateKey;
          const selected = reportBranch[report.dateKey] || "all";
          const selectedSales =
            selected === "all"
              ? report.sales
              : report.sales.filter((s) => s.branchName === selected);

          return (
            <div className="daily-report-card" key={report.dateKey}>
              <button
                className="report-toggle"
                type="button"
                onClick={() => setExpandedReport(open ? "" : report.dateKey)}
              >
                <div>
                  <h3>{report.day}</h3>
                  <p>{report.label}</p>
                </div>

                <span>{report.count} sales</span>
              </button>

              <div className="daily-report-grid">
                <div>
                  <p>Total Sales</p>
                  <strong>{money(report.totalSales)}</strong>
                </div>

                <div>
                  <p>Profit</p>
                  <strong>{money(report.totalProfit)}</strong>
                </div>

                <div>
                  <p>Cash</p>
                  <strong>{money(report.cash)}</strong>
                </div>

                <div>
                  <p>M-Pesa</p>
                  <strong>{money(report.mpesa)}</strong>
                </div>
              </div>

              {open && (
                <div className="report-details">
                  <h3 className="section-title">Branches</h3>

                  <div className="branch-tabs">
                    <button
                      type="button"
                      className={selected === "all" ? "branch-tab active" : "branch-tab"}
                      onClick={() =>
                        setReportBranch({ ...reportBranch, [report.dateKey]: "all" })
                      }
                    >
                      All branches
                    </button>

                    {report.branchReports.map((b) => (
                      <button
                        key={b.branchName}
                        type="button"
                        className={selected === b.branchName ? "branch-tab active" : "branch-tab"}
                        onClick={() =>
                          setReportBranch({
                            ...reportBranch,
                            [report.dateKey]: b.branchName,
                          })
                        }
                      >
                        <strong>{b.branchName}</strong>
                        <small>{money(b.totalSales)} sales • {money(b.totalProfit)} profit</small>
                      </button>
                    ))}
                  </div>

                  <h3 className="section-title">Worker Summary</h3>

                  {report.workerReports.length === 0 ? (
                    <p className="empty small-empty">No worker sales this day</p>
                  ) : (
                    <div className="worker-summary-list">
                      {report.workerReports.map((w) => (
                        <div className="worker-summary-row" key={w.workerName}>
                          <strong>{w.workerName}</strong>
                          <span>{money(w.totalSales)} sales</span>
                          <span>{money(w.totalProfit)} profit</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <h3 className="section-title">
                    {selected === "all" ? "All Sales" : selected}
                  </h3>

                  {selectedSales.length === 0 ? (
                    <p className="empty small-empty">No sales in this branch/day</p>
                  ) : (
                    selectedSales.map((s) => (
                      <div className="sale-row" key={s.id}>
                        <div className="item-icon">
                          {s.saleType === "service" ? "🛠️" : "📦"}
                        </div>

                        <div>
                          <h3>{saleName(s)}</h3>
                          <p>{s.branchName} • Sold by {s.soldBy}</p>
                          <p>{s.paymentMethod} • Profit {money(s.profit)}</p>
                        </div>

                        <strong>{money(s.total)}</strong>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const Orders = () => (
    <div className="panel stable-form">
      <h2>Client Orders</h2>

      <div className="form-box">
        <h3>Add Order</h3>

        <input
          placeholder="Client name"
          value={newOrder.clientName}
          onChange={(e) => setNewOrder({ ...newOrder, clientName: e.target.value })}
        />

        <input
          placeholder="Client phone"
          value={newOrder.clientPhone}
          onChange={(e) => setNewOrder({ ...newOrder, clientPhone: e.target.value })}
        />

        <input
          placeholder="Item or service ordered"
          value={newOrder.orderItem}
          onChange={(e) => setNewOrder({ ...newOrder, orderItem: e.target.value })}
        />

        <input
          type="number"
          placeholder="Total amount"
          value={newOrder.totalAmount}
          onChange={(e) => setNewOrder({ ...newOrder, totalAmount: e.target.value })}
        />

        <input
          type="number"
          placeholder="Deposit paid"
          value={newOrder.depositPaid}
          onChange={(e) => setNewOrder({ ...newOrder, depositPaid: e.target.value })}
        />

        <input
          type="date"
          value={newOrder.collectionDate}
          onChange={(e) => setNewOrder({ ...newOrder, collectionDate: e.target.value })}
        />

        <select
          value={newOrder.handledBy}
          onChange={(e) => setNewOrder({ ...newOrder, handledBy: e.target.value })}
        >
          <option value="">Handled by</option>
          {activeWorkers.map((w) => (
            <option key={w.id || w.name} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Notes"
          value={newOrder.notes}
          onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
        />

        <button className="primary-btn" type="button" onClick={addOrder}>
          Save Order
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="empty">No orders yet</p>
      ) : (
        orders.map((o) => (
          <div className="order-card" key={o.id}>
            <div className="order-top">
              <h3>{o.orderItem}</h3>
              <span className={`order-status ${String(o.status).toLowerCase()}`}>
                {o.status}
              </span>
            </div>

            <p><strong>Client:</strong> {o.clientName} • {o.clientPhone}</p>
            <p>
              <strong>Total:</strong> {money(o.totalAmount)} •{" "}
              <strong>Deposit:</strong> {money(o.depositPaid)} •{" "}
              <strong>Balance:</strong> {money(o.balance)}
            </p>
            <p><strong>Handled by:</strong> {o.handledBy}</p>
            <p><strong>Collection:</strong> {o.collectionDate || "-"}</p>

            {o.notes && <p><strong>Notes:</strong> {o.notes}</p>}

            <div className="order-actions">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateOrderStatus(o.id, status)}
                >
                  {status}
                </button>
              ))}

              {isAdmin && (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => deleteOrder(o.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const ManageWorkers = () => (
    <div className="panel stable-form">
      <button className="back-btn" type="button" onClick={() => goTo("more")}>
        ← Back
      </button>

      <h2>Manage Workers</h2>

      {!isAdmin ? (
        <p className="empty">Unlock admin mode first.</p>
      ) : (
        <>
          <div className="form-box">
            <h3>Add Worker</h3>

            <input
              placeholder="Worker name"
              value={newWorker}
              onChange={(e) => setNewWorker(e.target.value)}
            />

            <button className="primary-btn" type="button" onClick={addWorker}>
              Add Worker
            </button>
          </div>

          <div className="management-list">
            {workers.map((w) => (
              <div className="management-card" key={w.id || w.name}>
                {editingWorkerId === w.id ? (
                  <>
                    <input
                      value={workerEditName}
                      onChange={(e) => setWorkerEditName(e.target.value)}
                    />

                    <div className="mini-actions">
                      <button type="button" onClick={() => saveWorker(w)}>Save</button>
                      <button type="button" onClick={() => setEditingWorkerId("")}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h3>{w.name}</h3>
                      <p>{w.is_active === false ? "Inactive" : "Active"}</p>
                    </div>

                    <div className="mini-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkerId(w.id);
                          setWorkerEditName(w.name);
                        }}
                      >
                        Edit
                      </button>

                      <button type="button" onClick={() => toggleWorker(w)}>
                        {w.is_active === false ? "Reactivate" : "Deactivate"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const ManageBranches = () => (
    <div className="panel stable-form">
      <button className="back-btn" type="button" onClick={() => goTo("more")}>
        ← Back
      </button>

      <h2>Manage Branches</h2>

      {!isAdmin ? (
        <p className="empty">Unlock admin mode first.</p>
      ) : (
        <>
          <div className="form-box">
            <h3>Add Branch</h3>

            <input
              type="number"
              placeholder="Shop number"
              value={newBranch.shop_number}
              onChange={(e) =>
                setNewBranch({ ...newBranch, shop_number: e.target.value })
              }
            />

            <input
              placeholder="Branch name"
              value={newBranch.name}
              onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
            />

            <button className="primary-btn" type="button" onClick={addBranch}>
              Add Branch
            </button>
          </div>

          <div className="management-list">
            {branches.map((b) => (
              <div className="management-card" key={b.id || b.name}>
                {editingBranchId === b.id ? (
                  <>
                    <input
                      type="number"
                      value={branchEdit.shop_number}
                      onChange={(e) =>
                        setBranchEdit({
                          ...branchEdit,
                          shop_number: e.target.value,
                        })
                      }
                    />

                    <input
                      value={branchEdit.name}
                      onChange={(e) =>
                        setBranchEdit({ ...branchEdit, name: e.target.value })
                      }
                    />

                    <div className="mini-actions">
                      <button type="button" onClick={() => saveBranch(b)}>Save</button>
                      <button type="button" onClick={() => setEditingBranchId("")}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h3>
                        {b.shop_number ? `Shop ${b.shop_number}: ` : ""}
                        {b.name}
                      </h3>
                      <p>{b.is_active === false ? "Inactive" : "Active"}</p>
                    </div>

                    <div className="mini-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBranchId(b.id);
                          setBranchEdit({
                            shop_number: b.shop_number || "",
                            name: b.name,
                          });
                        }}
                      >
                        Edit
                      </button>

                      <button type="button" onClick={() => toggleBranch(b)}>
                        {b.is_active === false ? "Reactivate" : "Deactivate"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const More = () => (
    <div className="panel stable-form">
      <h2>More</h2>

      <div className="form-box">
        <h3>{isAdmin ? "Admin Mode Active" : "Unlock Admin"}</h3>

        {isAdmin ? (
          <button className="secondary-btn" type="button" onClick={lockAdmin}>
            Lock Admin
          </button>
        ) : (
          <>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter admin PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />

            <button className="primary-btn" type="button" onClick={unlockAdmin}>
              Unlock Admin
            </button>
          </>
        )}
      </div>

      <button className="more-card" type="button" onClick={() => goTo("workersAdmin")}>
        👥 Manage Workers
      </button>

      <button className="more-card" type="button" onClick={() => goTo("branchesAdmin")}>
        🏪 Manage Branches
      </button>

      <button className="more-card" type="button" onClick={() => goTo("orders")}>
        🧾 Client Orders
      </button>

      <button className="more-card" type="button" onClick={testConnection}>
        🔌 Test Supabase
      </button>

      {isAdmin && (
        <div className="form-box">
          <h3>Backup Data</h3>

          <button
            className="primary-btn"
            type="button"
            onClick={() => downloadCSV("yusuf_products_backup.csv", products)}
          >
            Export Products
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={() => downloadCSV("yusuf_sales_backup.csv", sales)}
          >
            Export Sales
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={() => downloadCSV("yusuf_orders_backup.csv", orders)}
          >
            Export Orders
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={() => downloadCSV("yusuf_workers_backup.csv", workers)}
          >
            Export Workers
          </button>

          <br />
          <br />

          <button
            className="secondary-btn"
            type="button"
            onClick={() => downloadCSV("yusuf_branches_backup.csv", branches)}
          >
            Export Branches
          </button>
        </div>
      )}
    </div>
  );

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "products":
        return <Products />;
      case "productDetail":
        return <ProductDetail />;
      case "sales":
        return <Sales />;
      case "reports":
        return <Reports />;
      case "orders":
        return <Orders />;
      case "workersAdmin":
        return <ManageWorkers />;
      case "branchesAdmin":
        return <ManageBranches />;
      case "more":
        return <More />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="phone-shell">
      {toast && (
        <div className={toast.type === "error" ? "toast error" : "toast"}>
          {toast.message}
        </div>
      )}

      <header className="top-bar">
        <button className="menu-btn" type="button" onClick={() => setMenuOpen(true)}>
          ☰
        </button>

        <h2>{SHOP_NAME}</h2>

        <button className="bell" type="button" onClick={() => goTo("reports")}>
          🔔
        </button>
      </header>

      <SideMenu />

      <main className="screen">{renderScreen()}</main>

      <nav className="bottom-nav">
        <button
          type="button"
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => goTo("dashboard")}
        >
          🏠
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          className={activeTab === "products" ? "active" : ""}
          onClick={() => goTo("products")}
        >
          ▣
          <span>Products</span>
        </button>

        <button className="big-add" type="button" onClick={() => goTo("sales")}>
          +
        </button>

        <button
          type="button"
          className={activeTab === "reports" ? "active" : ""}
          onClick={() => goTo("reports")}
        >
          ◴
          <span>Reports</span>
        </button>

        <button
          type="button"
          className={activeTab === "more" ? "active" : ""}
          onClick={() => goTo("more")}
        >
          ☰
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

export default App;