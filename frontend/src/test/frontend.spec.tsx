import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import CartPage from "../pages/CartPage";
import ProductDetailPage from "../pages/ProductDetailPage";
import { createOrder, getProduct } from "../api";

vi.mock("../api", () => ({
  createOrder: vi.fn(),
  getProduct: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual: any = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "1" }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../state/CartContext", () => ({
  useCart: () => ({
    items: [
      { productId: 1, name: "Wireless Headphones", price: 10.0, quantity: 2 }
    ],
    total: 20.0,
    remove: vi.fn(),
    clear: vi.fn(),
  }),
}));

describe("Frontend Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CartPage double-submit and error handling", () => {
    it("prevents double-checkout and handles API errors gracefully", async () => {
      let rejectCheckout: any;
      const checkoutPromise = new Promise((_, reject) => {
        rejectCheckout = reject;
      });
      
      vi.mocked(createOrder).mockImplementation(() => checkoutPromise as any);

      render(
        <BrowserRouter>
          <CartPage />
        </BrowserRouter>
      );

      const button = screen.getByRole("button", { name: /checkout/i });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);

      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("Processing...");
      expect(createOrder).toHaveBeenCalledTimes(1);

      fireEvent.click(button);
      expect(createOrder).toHaveBeenCalledTimes(1);

      rejectCheckout(new Error("API Error: Stock check failed"));

      await waitFor(() => {
        expect(screen.getByText("API Error: Stock check failed")).toBeInTheDocument();
      });

      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent("Checkout");
    });
  });

  describe("ProductDetailPage XSS prevention", () => {
    it("renders HTML description as plain text instead of executing HTML", async () => {
      const maliciousDescription = '<img src="x" onerror="alert(1)" /> Malicious HTML';
      
      vi.mocked(getProduct).mockResolvedValue({
        id: 1,
        sku: "SKU-001",
        name: "Malicious Product",
        description: maliciousDescription,
        price: "10.00",
        stock: 5,
        createdAt: "",
        updatedAt: "",
      });

      render(
        <BrowserRouter>
          <ProductDetailPage />
        </BrowserRouter>
      );

      const descElement = await screen.findByText(maliciousDescription);
      expect(descElement).toBeInTheDocument();
      expect(descElement.tagName).toBe("P");
    });
  });
});
