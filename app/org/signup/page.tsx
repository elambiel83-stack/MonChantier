"use client";

import { useState } from "react";

export default function TenantSignupPage() {
  const [form, setForm] = useState({ slug: "", name: "", address: "", city: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tenants/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug,
          name: form.name,
          seller: { companyName: form.name, address: form.address, city: form.city, country: form.country },
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent("/org/signup")}`;
        return;
      }
      if (!res.ok) throw new Error(data?.message || "Erreur lors de la création");
      setDone(true);
      window.location.href = "/org";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Créer votre organisation</h1>
      <p className="mt-1 text-sm text-slate-500">
        Vous devez être connecté. Un compte ne peut créer/rejoindre qu&apos;une seule organisation.
      </p>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {done && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Organisation créée !</div>}

      <div className="mt-4 space-y-3">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nom de l'entreprise"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
          placeholder="Identifiant (ex: acme-btp)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="Adresse"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Ville"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            placeholder="Pays"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Création…" : "Créer l'organisation"}
        </button>
      </div>
    </div>
  );
}
