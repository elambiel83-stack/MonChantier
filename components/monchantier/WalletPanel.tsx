"use client";

import { useEffect, useState } from "react";

type WalletCurrency = "USD" | "CDF";
type MobileNetwork = "vodacom" | "airtel" | "orange" | "mpesa";

type WalletDepositTransaction = {
  id: string;
  type: "deposit";
  state: "pending" | "confirmed";
  reference: string;
  method: "mobilemoney" | "card" | "paypal";
  currency: WalletCurrency;
  amount: number;
  balanceAfter: number | null;
  createdAt: string;
};

type WalletExchangeTransaction = {
  id: string;
  type: "exchange";
  fromCurrency: WalletCurrency;
  fromAmount: number;
  toCurrency: WalletCurrency;
  toAmount: number;
  bccRate: number;
  appliedRate: number;
  marginPercent: number;
  createdAt: string;
};

type WalletTransaction = WalletDepositTransaction | WalletExchangeTransaction;

type Wallet = {
  identity: string;
  balances: Record<WalletCurrency, number>;
  transactions: WalletTransaction[];
};

const METHOD_LABELS: Record<string, string> = {
  mobilemoney: "Mobile Money",
  card: "Carte bancaire",
  paypal: "PayPal",
};

function formatAmount(amount: number, currency: WalletCurrency) {
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

export default function WalletPanel() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");

  const [depositMethod, setDepositMethod] = useState<"mobilemoney" | "card" | "paypal">("mobilemoney");
  const [depositCurrency, setDepositCurrency] = useState<WalletCurrency>("USD");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPhone, setDepositPhone] = useState("+243");
  const [depositNetwork, setDepositNetwork] = useState<MobileNetwork>("vodacom");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState("");

  const [exchangeFrom, setExchangeFrom] = useState<WalletCurrency>("USD");
  const [exchangeTo, setExchangeTo] = useState<WalletCurrency>("CDF");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [exchangeQuote, setExchangeQuote] = useState<{
    bccRate: number;
    marginPercent: number;
    appliedRate: number;
    convertedAmount: number;
  } | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState("");

  const loadWallet = async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { wallet: Wallet };
      setWallet(data.wallet);
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWallet();

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("wallet_reference");
    if (!reference) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/wallet/deposit/status?reference=${encodeURIComponent(reference)}`);
        const data = await res.json();
        if (data?.found && data?.transaction?.state === "confirmed") {
          if (!cancelled) {
            setBanner(
              `Recharge confirmée : ${formatAmount(data.transaction.amount, data.transaction.currency)} créditée.`
            );
            await loadWallet();
          }
          return;
        }
        if (attempts < 15 && !cancelled) {
          setTimeout(() => void poll(), 2000);
        } else if (!cancelled) {
          setBanner("Recharge reçue, validation en cours. Revenez dans quelques instants.");
        }
      } catch {
        if (!cancelled) setBanner("Impossible de vérifier le statut de la recharge.");
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const amount = Number(exchangeAmount);
    if (!Number.isFinite(amount) || amount <= 0 || exchangeFrom === exchangeTo) {
      setExchangeQuote(null);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(
        `/api/wallet/exchange/quote?from=${exchangeFrom}&to=${exchangeTo}&amount=${amount}`,
        { signal: controller.signal }
      )
        .then((res) => res.json())
        .then((data) => setExchangeQuote(data?.quote || null))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [exchangeAmount, exchangeFrom, exchangeTo]);

  const handleDeposit = async () => {
    setDepositError("");
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositError("Montant invalide.");
      return;
    }

    setDepositing(true);
    try {
      if (depositMethod === "mobilemoney") {
        const res = await fetch("/api/wallet/deposit/mobilemoney", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            currency: depositCurrency,
            phone: depositPhone,
            network: depositNetwork,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Erreur recharge");
        setBanner(
          data?.status === "confirmed"
            ? `Recharge confirmée : ${formatAmount(amount, depositCurrency)} créditée.`
            : data?.message || "Demande envoyée. Validation du dépôt en cours."
        );
        setDepositAmount("");
        if (data?.status === "confirmed") {
          await loadWallet();
        }
        return;
      }

      const successUrl = `${window.location.origin}/dashboard/client`;
      const cancelUrl = `${window.location.origin}/dashboard/client`;

      if (depositMethod === "card") {
        const res = await fetch("/api/wallet/deposit/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, currency: depositCurrency, successUrl, cancelUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Erreur recharge carte");
        window.location.href = data.checkoutUrl;
        return;
      }

      if (depositMethod === "paypal") {
        const res = await fetch("/api/wallet/deposit/paypal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, currency: depositCurrency, returnUrl: successUrl, cancelUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Erreur recharge PayPal");
        window.location.href = data.approveUrl;
      }
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDepositing(false);
    }
  };

  const handleExchange = async () => {
    setExchangeError("");
    const amount = Number(exchangeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExchangeError("Montant invalide.");
      return;
    }

    setExchanging(true);
    try {
      const res = await fetch("/api/wallet/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: exchangeFrom, to: exchangeTo, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur de change");
      setBanner(
        `Change effectué : ${formatAmount(amount, exchangeFrom)} → ${formatAmount(data.transaction.toAmount, exchangeTo)}.`
      );
      setExchangeAmount("");
      await loadWallet();
    } catch (err) {
      setExchangeError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setExchanging(false);
    }
  };

  const swapExchangeCurrencies = () => {
    setExchangeFrom(exchangeTo);
    setExchangeTo(exchangeFrom);
  };

  return (
    <div id="porte-monnaie" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mon porte-monnaie</h2>
      <p className="mt-1 text-sm text-slate-500">
        Gardez de l&apos;argent en réserve pour vos prochains achats, rechargez-le via vos moyens de
        paiement habituels et convertissez entre USD et CDF au taux BCC.
      </p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Solde USD</p>
          <p className="mt-1 text-2xl font-bold">
            {loading ? "…" : formatAmount(wallet?.balances.USD || 0, "USD")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Solde CDF</p>
          <p className="mt-1 text-2xl font-bold">
            {loading ? "…" : formatAmount(wallet?.balances.CDF || 0, "CDF")}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Recharger le porte-monnaie</h3>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["mobilemoney", "card", "paypal"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setDepositMethod(method)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    depositMethod === method
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white border-slate-300"
                  }`}
                >
                  {METHOD_LABELS[method]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Montant</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="deposit-currency" className="text-xs font-semibold text-slate-700">
                  Devise
                </label>
                <select
                  id="deposit-currency"
                  value={depositCurrency}
                  onChange={(e) => setDepositCurrency(e.target.value as WalletCurrency)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </div>
            </div>

            {depositMethod === "mobilemoney" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Numéro de téléphone</label>
                  <input
                    value={depositPhone}
                    onChange={(e) => setDepositPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="+243..."
                  />
                </div>
                <div>
                  <label htmlFor="deposit-network" className="text-xs font-semibold text-slate-700">
                    Réseau
                  </label>
                  <select
                    id="deposit-network"
                    value={depositNetwork}
                    onChange={(e) => setDepositNetwork(e.target.value as MobileNetwork)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="vodacom">Vodacom</option>
                    <option value="airtel">Airtel</option>
                    <option value="orange">Orange</option>
                    <option value="mpesa">M-Pesa</option>
                  </select>
                </div>
              </div>
            )}

            {depositError && <p className="text-sm text-red-600">{depositError}</p>}

            <button
              type="button"
              onClick={handleDeposit}
              disabled={depositing}
              className="w-full rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold px-4 py-2 text-sm"
            >
              {depositing ? "Traitement…" : "Recharger"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Changer de devise</h3>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2">
              <div>
                <label htmlFor="exchange-from" className="text-xs font-semibold text-slate-700">
                  De
                </label>
                <select
                  id="exchange-from"
                  value={exchangeFrom}
                  onChange={(e) => setExchangeFrom(e.target.value as WalletCurrency)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </div>
              <button
                type="button"
                onClick={swapExchangeCurrencies}
                className="mb-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                title="Inverser"
              >
                ⇄
              </button>
              <div>
                <label htmlFor="exchange-to" className="text-xs font-semibold text-slate-700">
                  Vers
                </label>
                <select
                  id="exchange-to"
                  value={exchangeTo}
                  onChange={(e) => setExchangeTo(e.target.value as WalletCurrency)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Montant à convertir</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {exchangeQuote && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <p>Taux BCC : {exchangeQuote.bccRate.toLocaleString("fr-FR")}</p>
                <p>
                  Taux appliqué (marge {exchangeQuote.marginPercent}%) :{" "}
                  {exchangeQuote.appliedRate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  Vous recevrez : {formatAmount(exchangeQuote.convertedAmount, exchangeTo)}
                </p>
              </div>
            )}

            {exchangeError && <p className="text-sm text-red-600">{exchangeError}</p>}

            <button
              type="button"
              onClick={handleExchange}
              disabled={exchanging || !exchangeQuote}
              className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold px-4 py-2 text-sm"
            >
              {exchanging ? "Traitement…" : "Convertir"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700">Historique du porte-monnaie</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Opération</th>
                <th className="py-2 pr-4 font-medium">Détail</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {!wallet || wallet.transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-500">
                    Aucune opération pour le moment.
                  </td>
                </tr>
              ) : (
                wallet.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4">{formatDate(tx.createdAt)}</td>
                    <td className="py-3 pr-4">
                      {tx.type === "deposit" ? `Recharge ${METHOD_LABELS[tx.method]}` : "Change"}
                    </td>
                    <td className="py-3 pr-4">
                      {tx.type === "deposit"
                        ? formatAmount(tx.amount, tx.currency)
                        : `${formatAmount(tx.fromAmount, tx.fromCurrency)} → ${formatAmount(tx.toAmount, tx.toCurrency)}`}
                    </td>
                    <td className="py-3 pr-4">
                      {tx.type === "deposit" ? (
                        <span
                          className={
                            tx.state === "confirmed"
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                              : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                          }
                        >
                          {tx.state === "confirmed" ? "Confirmée" : "En attente"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Effectué
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
