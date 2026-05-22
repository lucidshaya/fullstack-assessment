import { useEffect, useState } from "react";
import { listOrdersAdmin, listProducts, updateProductAdmin } from "../api";
import type { Order, Product } from "../types";

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Record<number, Partial<Product>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const token = localStorage.getItem("admin_token") || "";

  useEffect(() => {
    if (!token) {
      setIsUnauthorized(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all([listOrdersAdmin(), listProducts()])
      .then(([ordersData, productsData]) => {
        setOrders(ordersData);
        setProducts(productsData);
        setIsUnauthorized(false);
      })
      .catch((err: any) => {
        console.error("Admin load error:", err);
        const errMsg = err.message || "";
        if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("Unauthorized") || errMsg.includes("Forbidden")) {
          setIsUnauthorized(true);
        } else {
          setError(errMsg || "Failed to load admin data");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  function onChangeField(id: number, field: keyof Product, value: string) {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("admin_token", tokenInput.trim());
    setIsUnauthorized(false);
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    window.location.reload();
  };

  async function save(p: Product) {
    const draft = editing[p.id] || {};
    try {
      await updateProductAdmin(p.id, {
        price: draft.price !== undefined ? Number(draft.price) : undefined,
        stock: draft.stock !== undefined ? Number(draft.stock) : undefined,
        description: draft.description as string | undefined,
        name: draft.name as string | undefined,
      });
      setProducts((current) =>
        current.map((it) =>
          it.id === p.id
            ? { ...it, ...draft, price: String(draft.price ?? it.price) }
            : it,
        ),
      );
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[p.id];
        return copy;
      });
    } catch (err: any) {
      alert(err.message || "Failed to update product. Please check your admin token or connection.");
    }
  }

  if (isUnauthorized) {
    return (
      <div className="page admin-login-page">
        <h1>Admin Authorization Required</h1>
        <form onSubmit={handleSaveToken} className="admin-login-form">
          <p>Please enter the admin token to access the dashboard:</p>
          <input
            type="password"
            placeholder="Admin Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            required
            style={{
              padding: "10px 14px",
              width: "100%",
              maxWidth: "320px",
              display: "block",
              marginBottom: "12px",
              borderRadius: "6px",
              border: "1px solid #d0d0d3",
              fontSize: "14px"
            }}
          />
          <button type="submit" className="primary">Authorize</button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="page"><p>Loading admin panel...</p></div>;
  if (error) return <div className="page"><p className="error-message">Error: {error}</p></div>;

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        <button onClick={handleLogout} style={{ padding: "6px 12px", background: "#ff4d4d", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Logout</button>
      </div>

      <section>
        <h2>Orders</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, idx) => (
              <tr key={idx}>
                <td>{o.id}</td>
                <td>{o.customerId}</td>
                <td>${o.totalAmount}</td>
                <td>{o.status}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Products</h2>
        <ul className="admin-products">
          {products.map((p, idx) => (
            <li key={idx} className="admin-product">
              <input
                type="text"
                defaultValue={p.name}
                onChange={(e) => onChangeField(p.id, "name", e.target.value)}
              />
              <input
                type="text"
                defaultValue={p.price}
                onChange={(e) => onChangeField(p.id, "price", e.target.value)}
              />
              <input
                type="text"
                defaultValue={String(p.stock)}
                onChange={(e) => onChangeField(p.id, "stock", e.target.value)}
              />
              <textarea
                defaultValue={p.description}
                onChange={(e) =>
                  onChangeField(p.id, "description", e.target.value)
                }
              />
              <button onClick={() => save(p)}>Save</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
