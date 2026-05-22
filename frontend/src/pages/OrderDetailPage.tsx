import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { chargeOrder, getOrder } from "../api";
import type { Order } from "../types";

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    let active = true;
    let intervalId: any = null;

    const fetchOrder = () => {
      getOrder(id)
        .then((data) => {
          if (!active) return;
          setOrder(data);
          if (data.status !== "PENDING" && intervalId) {
            clearInterval(intervalId);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch order", err);
        });
    };

    fetchOrder();

    intervalId = setInterval(() => {
      getOrder(id)
        .then((data) => {
          if (!active) return;
          setOrder(data);
          if (data.status !== "PENDING") {
            clearInterval(intervalId);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch order during interval", err);
        });
    }, 2000);

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [id]);

  if (!order) return <p>Loading order...</p>;

  async function pay() {
    if (paying) return;
    setPaying(true);
    setError(null);
    try {
      const result = await chargeOrder(order!.id);
      setOrder(result.order);
    } catch (err: any) {
      setError(err.message || "Payment declined. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="page">
      <h1>Order #{order.id}</h1>
      <p>
        Status: <span className={`status ${order.status}`}>{order.status}</span>
      </p>
      <p>Total: ${order.totalAmount}</p>

      <h2>Items</h2>
      <ul>
        {(order.items || []).map((item, idx) => (
          <li key={idx}>
            {item.name} x {item.quantity} @ ${item.unitPrice}
          </li>
        ))}
      </ul>

      <h2>Payments</h2>
      {(order.payments || []).length === 0 && <p>No payments yet.</p>}
      <ul>
        {(order.payments || []).map((p, idx) => (
          <li key={idx}>
            {p.status} - ${p.amount} ({p.providerTxnId})
          </li>
        ))}
      </ul>

      {error && <div className="error-message" style={{ color: "red", margin: "10px 0" }}>{error}</div>}

      {order.status === "PENDING" && (
        <button className="primary" onClick={pay} disabled={paying}>
          {paying ? "Charging..." : "Pay now"}
        </button>
      )}
    </div>
  );
}
