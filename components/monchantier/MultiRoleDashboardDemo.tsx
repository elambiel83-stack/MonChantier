"use client";

import { useMemo, useState, type ReactNode } from "react";

type DemoRole = "client" | "supplier" | "carrier" | "driver" | "admin";
type DemoStage = 0 | 1 | 2 | 3 | 4;
type Currency = "USD" | "CDF";

type Product = {
  id: "blocks" | "sand" | "pavers";
  name: string;
  unit: string;
  price: number;
  stock: string;
  tone: string;
};

const RATE_CDF = 2850;
const VAT_RATE = 0.16;

const ROLES: Array<{ id: DemoRole; label: string; short: string; description: string }> = [
  { id: "client", label: "Client", short: "CL", description: "Acheter et suivre" },
  { id: "supplier", label: "Fournisseur", short: "FO", description: "Préparer les produits" },
  { id: "carrier", label: "Partenaire / Transporteur", short: "TR", description: "Planifier la livraison" },
  { id: "driver", label: "Chauffeur", short: "CH", description: "Exécuter la mission" },
  { id: "admin", label: "Administrateur", short: "AD", description: "Superviser l’activité" },
];

const STAGES = ["Commande", "Paiement", "Préparation", "En route", "Livrée"] as const;

const STAGE_LABELS = [
  "Panier à confirmer",
  "Paiement confirmé",
  "En préparation",
  "Livraison en cours",
  "Commande livrée",
] as const;

const STAGE_HINTS = [
  "Confirmez la commande côté Client, puis passez au rôle Fournisseur.",
  "Le fournisseur peut maintenant accepter et préparer les produits.",
  "Le transporteur peut affecter Patrick à cette livraison.",
  "Le chauffeur peut démarrer puis terminer la mission.",
  "Le parcours est terminé. Réinitialisez la démo pour le rejouer.",
] as const;

const PRODUCTS: Product[] = [
  { id: "blocks", name: "Blocs ciment 15", unit: "pièce", price: 1.25, stock: "2 400 pièces", tone: "#b84c2a" },
  { id: "sand", name: "Sable concassé", unit: "m³", price: 42, stock: "64 m³", tone: "#d7ad67" },
  { id: "pavers", name: "Pavés autobloquants", unit: "m²", price: 18, stock: "180 m²", tone: "#8b969a" },
];

const INITIAL_QUANTITIES: Record<Product["id"], number> = {
  blocks: 150,
  sand: 3,
  pavers: 0,
};

const ROLE_TITLES: Record<DemoRole, string> = {
  client: "Bonjour, Erick",
  supplier: "Espace fournisseur",
  carrier: "Centre de transport",
  driver: "Mission du jour",
  admin: "Vue d’ensemble",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatMoney(value: number, currency: Currency) {
  if (currency === "CDF") {
    return Math.round(value * RATE_CDF).toLocaleString("fr-FR") + " FC";
  }

  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + " $";
}

function Kpi({
  label,
  value,
  note,
  chip = "Temps réel",
}: {
  label: string;
  value: string;
  note: string;
  chip?: string;
}) {
  return (
    <article className="rounded-2xl border border-[#dfe5e7] bg-white p-4 shadow-[0_10px_30px_rgba(8,20,33,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
          {chip}
        </span>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-[#0b1724]">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#dfe5e7] bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-bold text-[#0b1724]">{title}</h2>
          {subtitle ? <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ stage }: { stage: DemoStage }) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
        stage === 4 && "bg-emerald-50 text-emerald-700",
        stage === 3 && "bg-blue-50 text-blue-700",
        stage < 3 && "bg-orange-50 text-orange-700"
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function RouteMap() {
  return (
    <div className="relative min-h-56 overflow-hidden rounded-2xl bg-[#e6ece7]">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(28deg,transparent 0 36px,rgba(255,255,255,.9) 37px 44px),repeating-linear-gradient(112deg,transparent 0 74px,rgba(255,255,255,.7) 75px 81px)",
        }}
      />
      <svg className="absolute inset-5 h-[calc(100%-2.5rem)] w-[calc(100%-2.5rem)]" viewBox="0 0 460 190" aria-hidden="true">
        <path d="M55 145 C115 65 180 160 250 85 S355 78 405 38" fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" />
        <path d="M55 145 C115 65 180 160 250 85 S355 78 405 38" fill="none" stroke="#ff6333" strokeWidth="4" strokeDasharray="8 7" strokeLinecap="round" />
      </svg>
      <span className="absolute bottom-[18%] left-[12%] h-5 w-5 rounded-full border-4 border-white bg-[#ff6333] shadow-lg" />
      <span className="absolute right-[10%] top-[19%] h-5 w-5 rounded-full border-4 border-white bg-[#081421] shadow-lg" />
      <span className="absolute bottom-4 left-4 rounded-lg bg-white px-2 py-1 text-[10px] font-bold shadow">Dépôt Manika</span>
      <span className="absolute right-4 top-4 rounded-lg bg-white px-2 py-1 text-[10px] font-bold shadow">Joli Site</span>
    </div>
  );
}

function Progress({ stage }: { stage: DemoStage }) {
  return (
    <ol className="relative mt-6 grid grid-cols-5 gap-1">
      <span className="absolute left-[9%] right-[9%] top-3.5 h-0.5 bg-[#294056]" aria-hidden="true" />
      {STAGES.map((label, index) => {
        const done = index < stage;
        const active = index === stage;

        return (
          <li key={label} className="relative z-10 grid justify-items-center gap-2 text-center">
            <span
              className={cx(
                "grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-black",
                done && "border-emerald-600 bg-emerald-600 text-white",
                active && "border-[#ff6333] bg-[#ff6333] text-white",
                !done && !active && "border-[#294056] bg-[#081421] text-slate-500"
              )}
            >
              {done ? "✓" : index + 1}
            </span>
            <small className={cx("text-[9px] font-semibold sm:text-[10px]", done || active ? "text-white" : "text-slate-600")}>
              {label}
            </small>
          </li>
        );
      })}
    </ol>
  );
}

export default function MultiRoleDashboardDemo() {
  const [role, setRole] = useState<DemoRole>("client");
  const [stage, setStage] = useState<DemoStage>(0);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [driverAssigned, setDriverAssigned] = useState(false);
  const [locationShared, setLocationShared] = useState(true);
  const [quantities, setQuantities] = useState(INITIAL_QUANTITIES);
  const [notice, setNotice] = useState("Données de démonstration — aucune transaction réelle.");

  const subtotal = useMemo(
    () => PRODUCTS.reduce((sum, product) => sum + quantities[product.id] * product.price, 0),
    [quantities]
  );
  const total = subtotal * (1 + VAT_RATE);

  function notify(message: string) {
    setNotice(message);
  }

  function changeStage(nextStage: DemoStage, message: string) {
    setStage(nextStage);
    notify(message);
  }

  function resetDemo() {
    setRole("client");
    setStage(0);
    setCurrency("USD");
    setDriverAssigned(false);
    setLocationShared(true);
    setQuantities(INITIAL_QUANTITIES);
    notify("La démonstration a été réinitialisée.");
  }

  function addProduct(productId: Product["id"]) {
    if (stage !== 0) return;
    setQuantities((current) => ({ ...current, [productId]: current[productId] + 1 }));
    notify("Produit ajouté au panier de démonstration.");
  }

  function renderClient() {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.65fr_.75fr]">
        <div className="space-y-4">
          <Panel title="Catalogue recommandé" subtitle="Matériaux disponibles à Kolwezi">
            <div className="grid gap-3 md:grid-cols-3">
              {PRODUCTS.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="h-24" style={{ background: product.tone }}>
                    <div
                      className="h-full w-full opacity-40"
                      style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent 0 20px,rgba(8,20,33,.5) 21px 23px),repeating-linear-gradient(90deg,transparent 0 38px,rgba(8,20,33,.5) 39px 41px)" }}
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-[#0b1724]">{product.name}</h3>
                    <p className="mt-1 text-[10px] text-slate-500">Disponible · {product.stock}</p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <span className="text-xs font-black">{formatMoney(product.price, currency)} / {product.unit}</span>
                      <button
                        type="button"
                        onClick={() => addProduct(product.id)}
                        disabled={stage !== 0}
                        className="rounded-lg bg-[#081421] px-3 py-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        + Ajouter
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          {stage >= 1 ? (
            <Panel title="Suivi de la livraison" subtitle="Commande MC-2026-0418">
              <RouteMap />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#081421] text-xs font-black text-white">PM</span>
                <span>
                  <strong className="block text-sm">Patrick Mwamba</strong>
                  <small className="text-slate-500">
                    {driverAssigned ? "Chauffeur affecté · Toyota Dyna 08" : "En attente d’affectation"}
                  </small>
                </span>
                <span className="sm:ml-auto"><StatusBadge stage={stage} /></span>
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Votre commande" subtitle="Prix calculés automatiquement">
            <div className="space-y-3">
              {PRODUCTS.filter((product) => quantities[product.id] > 0).map((product) => (
                <div key={product.id} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-xs">
                  <span>
                    <strong className="block">{product.name}</strong>
                    <small className="text-slate-500">{quantities[product.id]} {product.unit}</small>
                  </span>
                  <strong>{formatMoney(product.price * quantities[product.id], currency)}</strong>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-sm">Total TTC</span>
                <strong className="text-xl">{formatMoney(total, currency)}</strong>
              </div>
              {stage === 0 ? (
                <button type="button" onClick={() => changeStage(1, "Paiement simulé avec succès. Passez au rôle Fournisseur.")} className="w-full rounded-xl bg-[#ff6333] px-4 py-3 text-sm font-bold text-white">
                  Payer et confirmer
                </button>
              ) : (
                <button type="button" onClick={() => notify(stage >= 3 ? "Position du chauffeur actualisée." : "Le suivi sera disponible au départ du chauffeur.")} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">
                  Voir le suivi en direct
                </button>
              )}
              <label className="flex items-center gap-2 text-[11px] text-slate-500">
                <input type="checkbox" checked={locationShared} onChange={(event) => setLocationShared(event.target.checked)} />
                Partager ma position avec le chauffeur
              </label>
            </div>
          </Panel>
          <Panel title="État partagé" subtitle="Visible par tous les rôles">
            <div className="space-y-3">
              {STAGE_LABELS.map((label, index) => (
                <div key={label} className={cx("flex items-center gap-3 text-xs", index <= stage ? "text-[#0b1724]" : "text-slate-400")}>
                  <span className={cx("h-2.5 w-2.5 rounded-full", index < stage ? "bg-emerald-600" : index === stage ? "bg-[#ff6333]" : "bg-slate-200")} />
                  {label}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderSupplier() {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
        <div className="space-y-4">
          <Panel title="Commande à traiter" subtitle="MC-2026-0418 · Erick Lambi" action={<StatusBadge stage={stage} />}>
            <div className="grid gap-3 rounded-xl border border-slate-200 p-4 text-xs sm:grid-cols-4">
              <div><span className="text-slate-500">Produits</span><strong className="mt-1 block">Blocs + sable</strong></div>
              <div><span className="text-slate-500">Chargement</span><strong className="mt-1 block">3,2 tonnes</strong></div>
              <div><span className="text-slate-500">Total</span><strong className="mt-1 block">{formatMoney(total, currency)}</strong></div>
              <div><span className="text-slate-500">Créneau</span><strong className="mt-1 block">14h–16h</strong></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={stage !== 1} onClick={() => changeStage(2, "La commande est prête pour le transporteur.")} className="rounded-xl bg-[#ff6333] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                {stage < 1 ? "Paiement attendu" : stage === 1 ? "Accepter et préparer" : "Commande traitée"}
              </button>
              <button type="button" onClick={() => notify(locationShared ? "Point de livraison : Quartier Joli Site, Kolwezi." : "Le client n’a pas partagé sa position.")} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold">
                Voir le point de livraison
              </button>
            </div>
          </Panel>
          <Panel title="Niveaux de stock" subtitle="Disponibilité synchronisée avec le catalogue">
            {[
              ["Blocs ciment", "88%", "2 400"],
              ["Sable", "46%", "64 m³"],
              ["Pavés", "72%", "180 m²"],
            ].map(([label, width, value], index) => (
              <div key={label} className="grid grid-cols-[90px_1fr_55px] items-center gap-3 border-b border-slate-100 py-3 text-xs last:border-0">
                <span>{label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span className={cx("block h-full rounded-full", index === 1 ? "bg-amber-500" : "bg-emerald-600")} style={{ width }} />
                </span>
                <strong className="text-right text-[10px]">{value}</strong>
              </div>
            ))}
          </Panel>
        </div>
        <Panel title="Consignes" subtitle="Préparation et qualité">
          <p className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            Vérifier la qualité des blocs et protéger le sable pendant le transport. Le client a demandé une livraison sans déchargement mécanique.
          </p>
        </Panel>
      </div>
    );
  }

  function renderCarrier() {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
        <Panel title="Planifier la livraison" subtitle="Mission MC-2026-0418 · 8,4 km">
          <RouteMap />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#081421] text-xs font-black text-white">PM</span>
            <span>
              <strong className="block text-sm">Patrick Mwamba</strong>
              <small className="text-slate-500">Toyota Dyna 08 · capacité 4,5 t</small>
            </span>
            <span className="sm:ml-auto"><StatusBadge stage={stage} /></span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={stage !== 2 || driverAssigned}
              onClick={() => {
                setDriverAssigned(true);
                notify("Patrick a reçu la mission. Passez au rôle Chauffeur.");
              }}
              className="rounded-xl bg-[#ff6333] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {driverAssigned ? "Patrick est affecté" : stage === 2 ? "Affecter Patrick" : "Marchandise non prête"}
            </button>
            <button type="button" onClick={() => notify("Mode démo : conversation avec Patrick préparée.")} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold">
              Contacter
            </button>
          </div>
        </Panel>
        <Panel title="Flotte disponible" subtitle="Capacité et proximité">
          <div className="space-y-3">
            {[
              ["PM", "Patrick Mwamba", "Dyna 08 · 4,5 t", "Disponible", "text-emerald-700 bg-emerald-50"],
              ["JK", "Jean Kabamba", "Canter 12 · 5 t", "En mission", "text-blue-700 bg-blue-50"],
              ["KM", "Kevin Mutombo", "Fuso 04 · 8 t", "Entretien", "text-orange-700 bg-orange-50"],
            ].map(([initials, name, vehicle, status, style]) => (
              <div key={name} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[10px] font-black">{initials}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs">{name}</strong>
                  <small className="text-[10px] text-slate-500">{vehicle}</small>
                </span>
                <span className={cx("rounded-full px-2 py-1 text-[9px] font-bold", style)}>{status}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderDriver() {
    const canStart = stage === 2 && driverAssigned;
    const canFinish = stage === 3;

    return (
      <div className="grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
        <Panel title="Itinéraire de livraison" subtitle="Dépôt Manika → Quartier Joli Site">
          <RouteMap />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canStart && !canFinish}
              onClick={() => canStart ? changeStage(3, "Livraison démarrée. Le client peut suivre Patrick.") : changeStage(4, "Commande livrée avec succès.")}
              className="rounded-xl bg-[#ff6333] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {canStart ? "Démarrer la livraison" : canFinish ? "Marquer comme livrée" : stage === 4 ? "Mission terminée" : "Aucune mission prête"}
            </button>
            <button type="button" onClick={() => notify("Mode démo : appel du client préparé.")} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold">
              Appeler le client
            </button>
          </div>
        </Panel>
        <Panel title="Détails de la mission" subtitle="Commande MC-2026-0418">
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Client</dt><dd className="font-bold">Erick Lambi</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Chargement</dt><dd className="font-bold">150 blocs + 3 m³</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Paiement</dt><dd className="font-bold text-emerald-700">Confirmé</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Position client</dt><dd className="font-bold">{locationShared ? "Partagée" : "Non partagée"}</dd></div>
          </dl>
        </Panel>
      </div>
    );
  }

  function renderAdmin() {
    const demoOrders = [
      ["MC-0418", "Erick Lambi", STAGE_LABELS[stage], formatMoney(total, currency)],
      ["MC-0417", "Grâce K.", "Commande livrée", formatMoney(284, currency)],
      ["MC-0416", "BTP Horizon", "Livraison en cours", formatMoney(1240, currency)],
    ];

    return (
      <div className="grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
        <Panel title="Commandes récentes" subtitle="Supervision de tous les acteurs">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                <tr><th className="pb-3 pr-5">Commande</th><th className="pb-3 pr-5">Client</th><th className="pb-3 pr-5">État</th><th className="pb-3">Montant</th></tr>
              </thead>
              <tbody>
                {demoOrders.map((order) => (
                  <tr key={order[0]} className="border-t border-slate-100">
                    <td className="py-3 pr-5 font-mono font-bold">{order[0]}</td>
                    <td className="py-3 pr-5">{order[1]}</td>
                    <td className="py-3 pr-5">{order[2]}</td>
                    <td className="py-3 font-bold">{order[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Contrôle de démonstration" subtitle="Tester directement chaque état">
          <div className="space-y-2">
            {STAGE_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const nextStage = index as DemoStage;
                  setStage(nextStage);
                  if (nextStage >= 3) setDriverAssigned(true);
                  notify("État administrateur appliqué : " + label + ".");
                }}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-semibold",
                  index === stage ? "border-[#ff6333] bg-orange-50 text-orange-800" : "border-slate-200 bg-white"
                )}
              >
                {label}
                <span className={cx("grid h-6 w-6 place-items-center rounded-full text-[10px]", index === stage ? "bg-[#ff6333] text-white" : "bg-slate-100")}>
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  const roleView: Record<DemoRole, () => ReactNode> = {
    client: renderClient,
    supplier: renderSupplier,
    carrier: renderCarrier,
    driver: renderDriver,
    admin: renderAdmin,
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Commande partagée · MC-2026-0418</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0b1724]">{ROLE_TITLES[role]}</h1>
          <p className="mt-1 text-sm text-slate-500">Prototype multi-rôle intégré à MonChantier</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500">
            Devise
            <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} className="bg-transparent font-black text-[#0b1724] outline-none">
              <option value="USD">USD</option>
              <option value="CDF">CDF</option>
            </select>
          </label>
          <button type="button" onClick={resetDemo} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold" title="Réinitialiser la démonstration">
            ↻ Réinitialiser
          </button>
        </div>
      </header>

      <nav className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Prévisualiser un rôle">
        {ROLES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRole(item.id)}
            className={cx(
              "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
              role === item.id ? "border-[#ff6333] bg-[#081421] text-white shadow-lg" : "border-slate-200 bg-white text-[#0b1724] hover:border-slate-300"
            )}
          >
            <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-black", role === item.id ? "bg-[#ff6333] text-white" : "bg-slate-100 text-slate-600")}>
              {item.short}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs">{item.label}</strong>
              <small className={cx("block truncate text-[10px]", role === item.id ? "text-slate-400" : "text-slate-500")}>{item.description}</small>
            </span>
          </button>
        ))}
      </nav>

      <section className="mt-4 rounded-2xl bg-[#081421] p-5 text-white shadow-[0_18px_45px_rgba(8,20,33,0.12)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff6333]">Scénario interactif</p>
            <h2 className="mt-1 text-xl font-black">Du panier à la livraison</h2>
          </div>
          <StatusBadge stage={stage} />
        </div>
        <Progress stage={stage} />
        <p className="mt-5 text-center text-[11px] text-slate-400">{STAGE_HINTS[stage]}</p>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {role === "client" ? (
          <>
            <Kpi label="Commande active" value="01" note={STAGE_LABELS[stage]} />
            <Kpi label="Valeur du panier" value={formatMoney(total, currency)} note="TVA 16 % incluse" chip="USD / CDF" />
            <Kpi label="Distance estimée" value="8,4 km" note="Dépôt → Joli Site" />
            <Kpi label="Livraison estimée" value={stage >= 3 ? "26 min" : "Aujourd’hui"} note="Créneau 14h–16h" />
          </>
        ) : role === "supplier" ? (
          <>
            <Kpi label="À préparer" value={stage === 1 ? "01" : "00"} note="Commande prioritaire" />
            <Kpi label="Valeur du jour" value={formatMoney(812, currency)} note="+12 % cette semaine" />
            <Kpi label="Stock disponible" value="96 %" note="3 familles suivies" />
            <Kpi label="Délai moyen" value="38 min" note="Objectif < 45 min" />
          </>
        ) : role === "carrier" ? (
          <>
            <Kpi label="Missions actives" value={stage === 3 ? "03" : "02"} note="Kolwezi aujourd’hui" />
            <Kpi label="Chauffeurs libres" value={driverAssigned ? "03" : "04"} note="Sur 7 chauffeurs" />
            <Kpi label="Taux à l’heure" value="92 %" note="+4 points ce mois" />
            <Kpi label="Distance du jour" value="126 km" note="Toutes missions" />
          </>
        ) : role === "driver" ? (
          <>
            <Kpi label="Mission actuelle" value={driverAssigned ? "MC-0418" : "—"} note={STAGE_LABELS[stage]} />
            <Kpi label="Distance" value="8,4 km" note={stage === 3 ? "6,1 km restants" : "Trajet total"} />
            <Kpi label="Temps estimé" value={stage === 3 ? "26 min" : "34 min"} note="Trafic fluide" />
            <Kpi label="Missions du jour" value={stage === 4 ? "04" : "03"} note="Objectif 4" />
          </>
        ) : (
          <>
            <Kpi label="Ventes aujourd’hui" value={formatMoney(4278, currency)} note="+18 % vs hier" />
            <Kpi label="Commandes" value="18" note="3 nécessitent une action" />
            <Kpi label="Livraisons actives" value="07" note="92 % à l’heure" />
            <Kpi label="Paiements validés" value="96 %" note="1 en vérification" />
          </>
        )}
      </div>

      <div className="mt-4">{roleView[role]()}</div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-600" role="status" aria-live="polite">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        {notice}
      </div>
    </div>
  );
}
