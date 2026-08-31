'use client';

import React, { useEffect, useState } from "react";
import { Header } from "./monchantier/Header";
import { Hero } from "./monchantier/Hero";
import { Products } from "./monchantier/Products";
import { Services } from "./monchantier/Services";
import { About } from "./monchantier/About";
import { Partners } from "./monchantier/Partners";
import { Contact } from "./monchantier/Contact";
import { Footer } from "./monchantier/Footer";
import { Cart } from "./monchantier/Cart";
import { PaymentModal } from "./monchantier/PaymentModal";
import { useFxRate } from "./monchantier/hooks/useFxRate";
import { Language, Product, CartItem, Currency } from "./monchantier/types";

const CART_STORAGE_KEY = "monchantier:cart";

export default function MonChantierSite() {
  const [lang, setLang] = useState<Language>("fr");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [currency] = useState<Currency>("CDF");
  const { fxRateUSDCDF, fxLoading } = useFxRate();

  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);

  // Hydrate the cart from localStorage once on mount (client-only — avoids
  // an SSR/client markup mismatch if read eagerly in useState).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCartItems(parsed);
      }
    } catch {
      // Ignore corrupted/unavailable storage — start with an empty cart.
    } finally {
      setCartHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // Storage full or unavailable (private browsing) — cart still works in-memory.
    }
  }, [cartItems, cartHydrated]);

  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    // Show a brief notification or animation here if desired
  };

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (productId: number) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleCheckout = () => {
    setCartOpen(false);
    setPayOpen(true);
  };

  const getTotalItems = () => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-800">
      <Header 
        lang={lang} 
        setLang={setLang} 
        t={t}
        cartItemCount={getTotalItems()}
        onCartClick={() => setCartOpen(true)}
      />
      <Hero t={t} />
      <Products lang={lang} t={t} onAddToCart={handleAddToCart} onOrderClick={() => setCartOpen(true)} />
      <Services lang={lang} t={t} onAddToCart={handleAddToCart} />
      <About t={t} />
      <Partners lang={lang} t={t} />
      <Contact lang={lang} t={t} />
      <Footer t={t} />
      <Cart
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
        lang={lang}
        t={t}
        currency={currency}
        fxRateUSDCDF={fxRateUSDCDF}
      />
      <PaymentModal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        cartItems={cartItems}
        lang={lang}
        t={t}
        fxRateUSDCDF={fxRateUSDCDF}
        fxLoading={fxLoading}
        onPaymentSuccess={() => setCartItems([])}
      />
    </div>
  );
}
