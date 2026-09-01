"use client";

import { useEffect, useState } from "react";

type SavedAddress = { id: string; label: string; address: string; isDefault: boolean };

export default function AddressesPanel() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "", address: "" });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/client/addresses", { cache: "no-store" });
      const data = await res.json();
      setAddresses(res.ok ? data.addresses || [] : []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createAddress = async () => {
    if (!newAddress.label.trim() || !newAddress.address.trim()) return;
    try {
      setSaving(true);
      const res = await fetch("/api/client/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddress),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      setNewAddress({ label: "", address: "" });
      setAddresses(data.addresses || []);
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (id: string) => {
    try {
      setBusy(id);
      const res = await fetch(`/api/client/addresses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) setAddresses(data.addresses || []);
    } finally {
      setBusy(null);
    }
  };

  const makeDefault = async (id: string) => {
    try {
      setBusy(id);
      const res = await fetch(`/api/client/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();
      if (res.ok) setAddresses(data.addresses || []);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div id="adresses" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mes adresses</h2>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          value={newAddress.label}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, label: e.target.value }))}
          placeholder="Libellé (ex: Domicile, Chantier)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={newAddress.address}
          onChange={(e) => setNewAddress((prev) => ({ ...prev, address: e.target.value }))}
          placeholder="Adresse complète"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-1"
        />
        <button
          type="button"
          onClick={createAddress}
          disabled={saving}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "+ Ajouter l'adresse"}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-slate-500">Chargement…</li>
        ) : addresses.length === 0 ? (
          <li className="text-sm text-slate-500">Aucune adresse enregistrée.</li>
        ) : (
          addresses.map((addr) => (
            <li key={addr.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
              <span>
                <span className="font-medium">{addr.label}</span>{" "}
                <span className="text-xs text-slate-500">— {addr.address}</span>
                {addr.isDefault && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Par défaut
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => makeDefault(addr.id)}
                    disabled={busy === addr.id}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                  >
                    Définir par défaut
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAddress(addr.id)}
                  disabled={busy === addr.id}
                  className="rounded-lg border border-red-300 bg-white text-red-600 px-2 py-1 text-xs font-medium disabled:opacity-60"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
