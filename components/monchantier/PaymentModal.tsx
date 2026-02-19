import React, { useState } from "react";
import { Currency, Language, MobileNetwork, PaymentMethod, CartItem, Status } from "./types";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  lang: Language;
  t: (fr: string, en: string) => string;
  fxRateUSDCDF: number | null;
  fxLoading: boolean;
  onPaymentSuccess?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  cartItems,
  lang,
  t,
  fxRateUSDCDF,
  fxLoading,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [payPhone, setPayPhone] = useState("+243");
  const [payNetwork, setPayNetwork] = useState<MobileNetwork>("vodacom");
  const [payCurrency, setPayCurrency] = useState<Currency>("CDF");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("mobilemoney");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [payStatus, setPayStatus] = useState<Status>("idle");
  const [payMsg, setPayMsg] = useState("");

  const getUnitPrice = (item: CartItem, currency: Currency) => {
    const direct = item.product.prices?.[currency] ?? null;
    if (direct) return Number(direct);
    if (currency === "CDF" && item.product.prices?.USD && fxRateUSDCDF) {
      return Number(item.product.prices.USD) * Number(fxRateUSDCDF);
    }
    return null;
  };

  const calculateTotal = (): number => {
    return cartItems.reduce((sum, item) => {
      const unitPrice = getUnitPrice(item, payCurrency);
      return sum + (unitPrice || 0) * item.quantity;
    }, 0);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert(t(
        "La géolocalisation n'est pas supportée par votre navigateur.",
        "Geolocation is not supported by your browser."
      ));
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(coords);
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        let errorMsg = t(
          "Impossible d'obtenir votre position.",
          "Unable to get your location."
        );
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = t(
            "Permission refusée. Activez la géolocalisation dans votre navigateur.",
            "Permission denied. Enable location access in your browser."
          );
        }
        alert(errorMsg);
      }
    );
  };

  const handlePayment = async () => {
    if (cartItems.length === 0) return;
    try {
      setPayStatus("loading");
      setPayMsg("");

      const totalAmount = calculateTotal();

      // 1) Mobile Money (Klasha)
      if (payMethod === "mobilemoney") {
        const res = await fetch("/api/payments/mobilemoney/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAmount,
            currency: payCurrency,
            phone: payPhone,
            network: payNetwork,
            fullname: "Client MonChantier",
            email: "client@monchantier.net",
            tx_ref: `MC-${Date.now()}`,
            metadata: {
              items: cartItems.map(item => ({
                productId: item.product.id,
                productName: lang === "fr" ? item.product.fr : item.product.en,
                quantity: item.quantity,
              })),
              method: payMethod,
              deliveryAddress: deliveryAddress,
              location: location,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Payment init failed");
        setPayStatus("success");
        setPayMsg(
          t(
            "Demande envoyée. Confirme le paiement sur ton téléphone.",
            "Prompt sent. Please confirm the payment on your phone."
          )
        );
        if (onPaymentSuccess) onPaymentSuccess();
        return;
      }

      // 2) Card checkout (Stripe) — redirect
      if (payMethod === "card") {
        const res = await fetch("/api/payments/card/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAmount,
            currency: payCurrency,
            items: cartItems.map(item => ({
              productId: item.product.id,
              productName: lang === "fr" ? item.product.fr : item.product.en,
              quantity: item.quantity,
            })),
            deliveryAddress: deliveryAddress,
            location: location,
            successUrl: window.location.origin + "/payment/success",
            cancelUrl: window.location.origin + "/payment/cancel",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Checkout failed");
        if (data?.checkoutUrl) window.location.href = data.checkoutUrl;
        else throw new Error("checkoutUrl manquant");
        return;
      }

      // 3) PayPal checkout — redirect
      if (payMethod === "paypal") {
        const res = await fetch("/api/payments/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAmount,
            currency: payCurrency,
            items: cartItems.map(item => ({
              productId: item.product.id,
              productName: lang === "fr" ? item.product.fr : item.product.en,
              quantity: item.quantity,
            })),
            deliveryAddress: deliveryAddress,
            location: location,
            returnUrl: window.location.origin + "/payment/success",
            cancelUrl: window.location.origin + "/payment/cancel",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "PayPal order failed");
        if (data?.approveUrl) window.location.href = data.approveUrl;
        else throw new Error("approveUrl manquant");
        return;
      }

      setPayStatus("error");
      setPayMsg(t("Méthode inconnue", "Unknown method"));
    } catch (err: any) {
      setPayStatus("error");
      setPayMsg(err?.message || "Erreur");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
              {t("Paiement", "Payment")}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                "Choisis ta méthode de paiement et confirme ta commande.",
                "Choose your payment method and confirm your order."
              )}
            </p>
          </div>
          <button className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setPayMethod("mobilemoney")}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                payMethod === "mobilemoney"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-slate-50 border-slate-300"
              }`}
            >
              {t("Mobile Money", "Mobile Money")}
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("card")}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                payMethod === "card"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-slate-50 border-slate-300"
              }`}
            >
              {t("Carte bancaire", "Card")}
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("paypal")}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                payMethod === "paypal"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-slate-50 border-slate-300"
              }`}
            >
              PayPal
            </button>
          </div>
          
          <div className="text-sm text-slate-600 mb-2">{t("Articles", "Items")}</div>
          <div className="space-y-2 mb-4">
            {cartItems.map((item) => {
              const unitPrice = getUnitPrice(item, payCurrency);
              const itemTotal = (unitPrice || 0) * item.quantity;
              
              return (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span className="text-slate-700">
                    {t(item.product.fr, item.product.en)} × {item.quantity}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {itemTotal.toLocaleString()} {payCurrency}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-sm text-slate-600">{t("Total de la commande", "Order total")}</div>
          <div className="mt-1 font-bold text-lg text-orange-600 mb-4">
            {calculateTotal().toLocaleString()} {payCurrency}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-slate-600">
            <div>
              {t("Taux BCC USD→CDF", "BCC rate USD→CDF")}:{" "}
              {fxLoading ? t("Chargement…", "Loading…") : fxRateUSDCDF ? fxRateUSDCDF.toLocaleString() : "—"}
            </div>
            <a
              className="text-orange-700 hover:text-orange-800 font-semibold"
              href="https://www.bcc.cd/operations-et-marches/domaine-operationnel/operations-de-change/cours-de-change"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Source", "Source")}
            </a>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="currency-select" className="text-xs font-semibold text-slate-700">{t("Devise", "Currency")}</label>
              <select
                id="currency-select"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={payCurrency}
                onChange={(e) => setPayCurrency(e.target.value as Currency)}
              >
                <option value="CDF">CDF</option>
                <option value="USD">USD</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                {t(
                  "Si tu choisis USD, le serveur convertit automatiquement en CDF pour Mobile Money.",
                  "If you choose USD, the server converts to CDF for Mobile Money."
                )}
              </p>
            </div>

            {/* Réseau + Numéro uniquement pour Mobile Money */}
            {payMethod === "mobilemoney" ? (
              <>
                <div>
                  <label htmlFor="network-select" className="text-xs font-semibold text-slate-700">{t("Réseau", "Network")}</label>
                  <select
                    id="network-select"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={payNetwork}
                    onChange={(e) => setPayNetwork(e.target.value as MobileNetwork)}
                  >
                    <option value="vodacom">Vodacom</option>
                    <option value="airtel">Airtel</option>
                    <option value="orange">Orange</option>
                    <option value="mpesa">M-Pesa</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">{t("Numéro", "Phone")}</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    placeholder={t("Ex: +243…", "e.g., +243…")}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="sm:col-span-1">
                  <div className="text-xs font-semibold text-slate-700">{t("Paiement", "Payment")}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {payMethod === "card"
                      ? t(
                          "Paiement par carte (Visa/Mastercard) via prestataire.",
                          "Card payment (Visa/Mastercard) via provider."
                        )
                      : t("Paiement PayPal via redirection sécurisée.", "PayPal payment via secure redirect.")}
                  </div>
                </div>
                <div className="sm:col-span-1">
                  <div className="text-xs font-semibold text-slate-700">{t("Note", "Note")}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {t("Cette option ouvre une page de paiement (checkout).", "This option opens a checkout page.")}
                  </div>
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">{t("Adresse de livraison", "Delivery address")}</label>
              <div className="flex gap-2">
                <input
                  className="mt-1 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t("Ex: Dilala, Av. Kasaï, n°12", "e.g., Dilala, Kasaï Ave, #12")}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="mt-1 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  title={t("Partager ma position", "Share my location")}
                >
                  {locationLoading ? (
                    <svg className="w-5 h-5 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {location && (
                <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                  <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("Position partagée", "Location shared")}
                  </div>
                  <div className="text-emerald-600 mt-1">
                    {t("Latitude", "Latitude")}: {location.lat.toFixed(6)}, {t("Longitude", "Longitude")}: {location.lng.toFixed(6)}
                  </div>
                </div>
              )}
              <p className="mt-1 text-[11px] text-slate-500">
                {t(
                  "Indique l'adresse précise ou partage ta position GPS pour la livraison.",
                  "Provide the exact address or share your GPS location for delivery."
                )}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{t("Total", "Total")}</label>
              <div className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-orange-600">
                {calculateTotal().toLocaleString()} {payCurrency}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {t("Le montant total de tous les articles.", "The total amount for all items.")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={payStatus === "loading" || cartItems.length === 0}
            onClick={handlePayment}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl shadow"
          >
            {payStatus === "loading" ? t("En cours…", "Processing…") : t("Lancer le paiement", "Initiate payment")}
          </button>
          {payMsg && <p className={`mt-3 text-sm ${payStatus === "error" ? "text-red-600" : "text-emerald-700"}`}>{payMsg}</p>}
          <p className="mt-3 text-xs text-slate-500">
            {t(
              "Note: le paiement automatique nécessite un prestataire (API) côté serveur + webhooks.",
              "Note: automated payments require a server-side provider API + webhooks."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
