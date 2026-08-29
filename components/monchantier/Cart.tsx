import React from "react";
import { CartItem, Currency, Language } from "./types";

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
  onCheckout: () => void;
  lang: Language;
  t: (fr: string, en: string) => string;
  currency: Currency;
  fxRateUSDCDF: number | null;
}

export function Cart({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  t,
  currency,
  fxRateUSDCDF,
}: CartProps) {
  const getUnitPrice = (item: CartItem, curr: Currency): number | null => {
    const direct = item.product.prices?.[curr] ?? null;
    if (direct) return Number(direct);
    if (curr === "CDF" && item.product.prices?.USD && fxRateUSDCDF) {
      return Number(item.product.prices.USD) * Number(fxRateUSDCDF);
    }
    return null;
  };

  const calculateTotal = (): number => {
    return cartItems.reduce((sum, item) => {
      const unitPrice = getUnitPrice(item, currency);
      return sum + (unitPrice || 0) * item.quantity;
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
              {t("Panier", "Cart")}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {cartItems.length} {t("article(s)", "item(s)")}
            </p>
          </div>
          <button
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🛒</div>
              <p className="text-slate-600">{t("Votre panier est vide", "Your cart is empty")}</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const unitPrice = getUnitPrice(item, currency);
              const itemTotal = (unitPrice || 0) * item.quantity;
              
              return (
                <div
                  key={item.product.id}
                  className="flex gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <img
                    src={item.product.img}
                    alt={t(item.product.fr, item.product.en)}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">
                      {t(item.product.fr, item.product.en)}
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      {unitPrice
                        ? `${unitPrice.toLocaleString()} ${currency} / ${t(item.product.unitFr, item.product.unitEn)}`
                        : t("Prix non disponible", "Price unavailable")}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                        onClick={() => onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                      >
                        −
                      </button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <button
                        className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        className="ml-auto text-red-600 hover:text-red-700 text-sm font-semibold"
                        onClick={() => onRemoveItem(item.product.id)}
                      >
                        {t("Supprimer", "Remove")}
                      </button>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-2">
                      {t("Total", "Total")}: {itemTotal.toLocaleString()} {currency}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="border-t border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">
                {t("Total général", "Grand total")}
              </span>
              <span className="text-2xl font-extrabold text-orange-600">
                {calculateTotal().toLocaleString()} {currency}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-3 rounded-xl shadow"
            >
              {t("Procéder au paiement", "Proceed to checkout")}
            </button>
            <button
              onClick={onClose}
              className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold px-5 py-3 rounded-xl"
            >
              {t("Continuer mes achats", "Continue shopping")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
