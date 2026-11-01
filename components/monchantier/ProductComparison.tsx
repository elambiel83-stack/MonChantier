"use client";
import { useEffect, useState } from "react";

type Item = {
  id: number; fr: string; en: string; category: string;
  priceUSD: number | null; priceCDF: number | null; stock: number | null;
  technicalSpecs: Record<string, string | number | null>;
};
const FIELDS = [
  ["dimensions", "Dimensions"], ["weightKg", "Poids (kg)"],
  ["strengthMpa", "Résistance (MPa)"], ["deliveryDays", "Délai de livraison (jours)"],
] as const;

export function ProductComparison({ ids, lang }: { ids: number[]; lang: "fr" | "en" }) {
  const [products, setProducts] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const key = ids.join(",");
  useEffect(() => {
    if (ids.length < 2) { setProducts([]); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setProducts([]);
    fetch(`/api/catalog/compare?ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error("Comparaison indisponible"); return r.json(); })
      .then((data) => { if (!controller.signal.aborted) setProducts(data.products); })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [key, ids.length]);

  if (ids.length < 2) return null;
  return <section aria-label="Comparaison des produits" className="mt-8">
    <h3 className="text-xl font-bold mb-3">Comparaison technique</h3>
    {loading && <p role="status">Chargement…</p>}
    {error && <p role="alert">{error}</p>}
    {products.length > 0 && <div className="overflow-x-auto">
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead><tr><th scope="col" className="border p-3 text-left">Critère</th>
          {products.map(p => <th scope="col" key={p.id} className="border p-3 text-left">{lang === "fr" ? p.fr : p.en}</th>)}
        </tr></thead>
        <tbody>
          <tr><th scope="row" className="border p-3 text-left">Prix USD</th>{products.map(p => <td className="border p-3" key={p.id}>{p.priceUSD === null ? "Sur devis" : `${p.priceUSD} USD`}</td>)}</tr>
          <tr><th scope="row" className="border p-3 text-left">Prix CDF</th>{products.map(p => <td className="border p-3" key={p.id}>{p.priceCDF === null ? "Sur devis" : `${p.priceCDF} CDF`}</td>)}</tr>
          <tr><th scope="row" className="border p-3 text-left">Stock</th>{products.map(p => <td className="border p-3" key={p.id}>{p.stock === null ? "Non renseigné" : p.stock}</td>)}</tr>
          {FIELDS.map(([field, label]) => <tr key={field}><th scope="row" className="border p-3 text-left">{label}</th>
            {products.map(p => <td className="border p-3" key={p.id}>{p.technicalSpecs?.[field] ?? "Non renseigné"}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>}
  </section>;
}
