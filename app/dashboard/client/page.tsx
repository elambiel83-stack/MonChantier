import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { listPaymentStatuses, StoredPaymentStatus } from "@/lib/paymentStore";
import { listQuoteRequestsByEmail } from "@/lib/quoteStore";
import WalletPanel from "@/components/monchantier/WalletPanel";
import LoanPanel from "@/components/monchantier/LoanPanel";
import DeliveryTrackingPanel from "@/components/monchantier/DeliveryTrackingPanel";
import FavoritesPanel from "@/components/monchantier/FavoritesPanel";
import AddressesPanel from "@/components/monchantier/AddressesPanel";
import SupportPanel from "@/components/monchantier/SupportPanel";
import ProjectsPanel from "@/components/monchantier/ProjectsPanel";

const METHOD_LABELS: Record<string, string> = {
  mobilemoney: "Mobile Money",
  card: "Carte bancaire",
  paypal: "PayPal",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const ORDER_STATUS_CLASSES: Record<string, string> = {
  processing: "bg-amber-100 text-amber-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

function formatAmount(status: StoredPaymentStatus) {
  const totals = status.invoice?.totals;
  if (!totals) return "—";
  return `${totals.ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${totals.currency}`;
}

export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;
  const hasEmail = Boolean(email);

  const [allPayments, quotes] = hasEmail
    ? await Promise.all([listPaymentStatuses(), listQuoteRequestsByEmail(email as string)])
    : [[], []];

  const normalizedEmail = email?.toLowerCase() || '';
  const orders = hasEmail
    ? allPayments
        .filter((status) => (status.fullInvoice?.customerEmail || status.invoice?.email || "").toLowerCase() === normalizedEmail)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    : [];

  const confirmedOrders = orders.filter((order) => order.state === "confirmed");
  const pendingOrders = orders.filter((order) => order.state === "pending");
  const invoicedOrders = orders.filter((order) => order.fullInvoice);
  const totalsByCurrency = confirmedOrders.reduce<Record<string, number>>((acc, order) => {
    const totals = order.invoice?.totals;
    if (!totals) return acc;
    acc[totals.currency] = (acc[totals.currency] || 0) + totals.ttc;
    return acc;
  }, {});

  const cards = [
    { title: "Commandes", value: orders.length },
    { title: "En attente", value: pendingOrders.length },
    { title: "Confirmées", value: confirmedOrders.length },
    { title: "Devis envoyés", value: quotes.length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Client</h1>
      <p className="mt-1 text-slate-600">Acheter, suivre et gérer ses projets.</p>
      {!hasEmail && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6">
          <p className="text-sm text-slate-700">
            Ce compte peut déjà utiliser le porte-monnaie, le crédit, les favoris, les adresses,
            les projets et le support. En revanche, les commandes, factures et devis restent
            rattachés à un email client.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Connectez-vous avec cet email ou renseignez-le lors du paiement pour retrouver ensuite
            l&apos;historique ici.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.title}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-4">
          <p className="text-sm text-slate-500">Total dépensé (commandes confirmées)</p>
          <p className="mt-1 text-lg font-semibold">
            {Object.keys(totalsByCurrency).length === 0
              ? "—"
              : Object.entries(totalsByCurrency)
                  .map(([currency, amount]) => `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`)
                  .join(" · ")}
          </p>
        </div>
      </div>

      <WalletPanel />
      <LoanPanel />
      <DeliveryTrackingPanel />

      <div id="commandes" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes commandes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Référence</th>
                <th className="py-2 pr-4 font-medium">Méthode</th>
                <th className="py-2 pr-4 font-medium">Montant</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
                <th className="py-2 pr-4 font-medium">Facture</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-slate-500">
                    Aucune commande pour le moment.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.reference} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4">{formatDate(order.updatedAt)}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{order.reference}</td>
                    <td className="py-3 pr-4">{METHOD_LABELS[order.method] || order.method}</td>
                    <td className="py-3 pr-4">{formatAmount(order)}</td>
                    <td className="py-3 pr-4">
                      {order.state === "confirmed" ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            ORDER_STATUS_CLASSES[order.orderStatus || "processing"]
                          }`}
                        >
                          {ORDER_STATUS_LABELS[order.orderStatus || "processing"]}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {order.fullInvoice ? (
                        <Link
                          href={`/api/payments/invoice/${encodeURIComponent(order.reference)}/pdf`}
                          className="text-orange-600 hover:text-orange-700 font-medium"
                        >
                          Télécharger
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="factures" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes factures</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Facture</th>
                <th className="py-2 pr-4 font-medium">Référence</th>
                <th className="py-2 pr-4 font-medium">Montant</th>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Télécharger</th>
              </tr>
            </thead>
            <tbody>
              {invoicedOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">
                    Aucune facture pour le moment.
                  </td>
                </tr>
              ) : (
                invoicedOrders.map((order) => (
                  <tr key={order.reference} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4 font-mono text-xs">{order.fullInvoice?.invoiceNumber}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{order.reference}</td>
                    <td className="py-3 pr-4">{formatAmount(order)}</td>
                    <td className="py-3 pr-4">{formatDate(order.updatedAt)}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/api/payments/invoice/${encodeURIComponent(order.reference)}/pdf`}
                        className="text-orange-600 hover:text-orange-700 font-medium"
                      >
                        Télécharger
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="paiements" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes paiements</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Méthode</th>
                <th className="py-2 pr-4 font-medium">Montant</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-500">
                    Aucun paiement pour le moment.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.reference} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4">{formatDate(order.updatedAt)}</td>
                    <td className="py-3 pr-4">{METHOD_LABELS[order.method] || order.method}</td>
                    <td className="py-3 pr-4">{formatAmount(order)}</td>
                    <td className="py-3 pr-4">
                      {order.state === "confirmed" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Confirmé
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          En attente
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

      <div id="devis" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes devis</h2>
        <ul className="mt-4 space-y-3">
          {quotes.length === 0 ? (
            <li className="text-sm text-slate-500">Aucune demande de devis envoyée.</li>
          ) : (
            quotes.map((quote) => (
              <li key={quote.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium">
                  {quote.services.length > 0 ? quote.services.join(", ") : "Demande générale"}
                </p>
                <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">{quote.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(quote.createdAt)}</p>
              </li>
            ))
          )}
        </ul>
      </div>

      <ProjectsPanel />
      <FavoritesPanel />
      <AddressesPanel />
      <SupportPanel />
    </div>
  );
}
