"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DeliveryStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "delivered" | "cancelled";

type Delivery = {
  id: string;
  reference: string;
  clientName: string;
  status: DeliveryStatus;
  deliveryAddress: string;
  createdAt?: string;
  currentPosition?: { lat: number; lng: number; at: string };
  positionHistory?: Array<{ lat: number; lng: number; at: string }>;
  statusHistory?: Array<{ id: string; at: string; by: string; status: DeliveryStatus; note?: string }>;
};

type DriverProfile = {
  vehicle: { label: string; plateNumber: string; capacity?: string } | null;
  documents: Array<{ id: string; name: string; url: string; category: string; createdAt: string }>;
  earnings: Array<{ id: string; deliveryId: string; reference: string; amount: number; currency: "USD" | "CDF"; createdAt: string }>;
  defaultEarningAmount: number | null;
  defaultEarningCurrency: "USD" | "CDF";
};

const STATUS_LABELS: Record<DeliveryStatus, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-700" },
  assigned: { label: "Assignée", className: "bg-sky-100 text-sky-700" },
  picked_up: { label: "Récupérée", className: "bg-sky-100 text-sky-700" },
  in_transit: { label: "En transit", className: "bg-emerald-100 text-emerald-700" },
  delivered: { label: "Livrée", className: "bg-slate-200 text-slate-700" },
  cancelled: { label: "Annulée", className: "bg-red-100 text-red-700" },
};

const NEXT_STATUS: Partial<Record<DeliveryStatus, { status: DeliveryStatus; label: string }>> = {
  assigned: { status: "picked_up", label: "Marquer récupérée" },
  picked_up: { status: "in_transit", label: "Démarrer le transit" },
  in_transit: { status: "delivered", label: "Marquer livrée" },
};

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

export default function DriverDeliveriesPanel() {
  const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);
  const [available, setAvailable] = useState<Delivery[]>([]);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [autoSendId, setAutoSendId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ label: "", plateNumber: "", capacity: "" });
  const [earningForm, setEarningForm] = useState({ amount: "", currency: "USD" as "USD" | "CDF" });
  const [documentForm, setDocumentForm] = useState({ name: "", url: "", category: "permis" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [deliveriesRes, profileRes] = await Promise.all([
        fetch("/api/deliveries", { cache: "no-store" }),
        fetch("/api/driver/profile", { cache: "no-store" }),
      ]);
      const deliveriesData = await deliveriesRes.json().catch(() => null);
      const profileData = await profileRes.json().catch(() => null);
      if (deliveriesRes.ok) {
        setMyDeliveries(deliveriesData?.deliveries || []);
        setAvailable(deliveriesData?.available || []);
      }
      const nextProfile = profileRes.ok ? profileData?.profile || null : null;
      setProfile(nextProfile);
      setVehicleForm({
        label: nextProfile?.vehicle?.label || "",
        plateNumber: nextProfile?.vehicle?.plateNumber || "",
        capacity: nextProfile?.vehicle?.capacity || "",
      });
      setEarningForm({
        amount: nextProfile?.defaultEarningAmount?.toString() || "",
        currency: nextProfile?.defaultEarningCurrency || "USD",
      });
    } catch {
      setMyDeliveries([]);
      setAvailable([]);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!autoSendId) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const sendOnce = () => sendPosition(autoSendId, true);
    sendOnce();
    intervalRef.current = setInterval(sendOnce, 20000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendId]);

  const accept = async (id: string) => {
    setBusyId(id);
    try {
      const meRes = await fetch("/api/auth/session");
      const me = await meRes.json();
      const res = await fetch(`/api/deliveries/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverIdentity: me?.user?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      setBanner({ type: "success", message: "Mission acceptée." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusyId(null);
    }
  };

  const advanceStatus = async (id: string, status: DeliveryStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/deliveries/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      setBanner({ type: "success", message: "Statut mis à jour." });
      if (status === "delivered" && autoSendId === id) setAutoSendId(null);
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusyId(null);
    }
  };

  const sendPosition = (id: string, silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) setBanner({ type: "error", message: "Géolocalisation non supportée par ce navigateur." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`/api/deliveries/${id}/position`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
          });
          if (!res.ok && !silent) {
            const data = await res.json();
            setBanner({ type: "error", message: data?.message || "Erreur envoi position" });
          } else if (!silent) {
            setBanner({ type: "success", message: "Position envoyée." });
          }
          await load();
        } catch {
          if (!silent) setBanner({ type: "error", message: "Erreur envoi position" });
        }
      },
      () => {
        if (!silent) setBanner({ type: "error", message: "Impossible d'obtenir votre position." });
      }
    );
  };

  const bannerClassName =
    banner?.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const saveVehicle = async () => {
    if (!vehicleForm.label.trim() || !vehicleForm.plateNumber.trim()) return;
    try {
      setSavingProfile(true);
      const res = await fetch("/api/driver/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle: vehicleForm }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur mise à jour véhicule");
      setBanner({ type: "success", message: "Véhicule enregistré." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEarningConfig = async () => {
    try {
      setSavingProfile(true);
      const res = await fetch("/api/driver/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultEarningAmount: earningForm.amount === "" ? null : Number(earningForm.amount),
          defaultEarningCurrency: earningForm.currency,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur mise à jour rémunération");
      setBanner({ type: "success", message: "Barème de rémunération enregistré." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setSavingProfile(false);
    }
  };

  const addDocument = async () => {
    if (!documentForm.name.trim() || !documentForm.url.trim()) return;
    try {
      setSavingProfile(true);
      const res = await fetch("/api/driver/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentForm),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur ajout document");
      setDocumentForm({ name: "", url: "", category: "permis" });
      setBanner({ type: "success", message: "Document ajouté." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setSavingProfile(false);
    }
  };

  const stats = useMemo(() => {
    const active = myDeliveries.filter((delivery) => delivery.status !== "delivered" && delivery.status !== "cancelled");
    const delivered = myDeliveries.filter((delivery) => delivery.status === "delivered");
    const gpsTracked = myDeliveries.filter((delivery) => (delivery.positionHistory?.length || 0) > 0);
    return {
      assigned: myDeliveries.length,
      active: active.length,
      delivered: delivered.length,
      available: available.length,
      gpsTracked: gpsTracked.length,
    };
  }, [available.length, myDeliveries]);

  const activeMission = myDeliveries.find((delivery) => autoSendId === delivery.id) || myDeliveries[0] || null;
  const earningSummary = useMemo(() => {
    const totals = (profile?.earnings || []).reduce<Record<string, number>>((acc, earning) => {
      acc[earning.currency] = (acc[earning.currency] || 0) + earning.amount;
      return acc;
    }, {});
    return Object.entries(totals);
  }, [profile?.earnings]);
  const historyRows = useMemo(
    () =>
      myDeliveries
        .flatMap((delivery) =>
          (delivery.statusHistory || []).map((entry) => ({
            deliveryReference: delivery.reference,
            address: delivery.deliveryAddress,
            ...entry,
          }))
        )
        .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
        .slice(0, 10),
    [myDeliveries]
  );

  return (
    <div className="space-y-6">
      <div id="mes-missions">
        <h1 className="text-2xl font-bold tracking-tight">Transporteur / Livreur</h1>
        <p className="mt-1 text-slate-600">Accepter et exécuter les missions de livraison.</p>

        {banner && <div className={`mt-3 rounded-lg border p-3 text-sm ${bannerClassName}`}>{banner.message}</div>}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Missions", stats.assigned],
            ["Actives", stats.active],
            ["Livrées", stats.delivered],
            ["Disponibles", stats.available],
            ["GPS suivies", stats.gpsTracked],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div id="carte-gps" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">GPS</h2>
        {activeMission ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-medium text-slate-900">{activeMission.deliveryAddress}</p>
            <p className="text-slate-600">{activeMission.reference}</p>
            <p className="text-slate-500">Dernière position: {activeMission.currentPosition ? `${activeMission.currentPosition.lat.toFixed(5)}, ${activeMission.currentPosition.lng.toFixed(5)}` : "aucune position envoyée"}</p>
            <p className="text-slate-400">Horodatage: {formatDate(activeMission.currentPosition?.at)}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Activez le partage de position sur une mission en cours.</p>
        )}
      </div>

      <div id="livraisons" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes livraisons</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : myDeliveries.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune mission assignée pour le moment.</p>
          ) : (
            myDeliveries.map((delivery) => {
              const next = NEXT_STATUS[delivery.status];
              const status = STATUS_LABELS[delivery.status];
              const isTracking = autoSendId === delivery.id;
              return (
                <div key={delivery.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{delivery.deliveryAddress}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{delivery.clientName} · {delivery.reference}</p>
                  <p className="mt-1 text-xs text-slate-400">Créée le {formatDate(delivery.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {next && (
                      <button type="button" onClick={() => advanceStatus(delivery.id, next.status)} disabled={busyId === delivery.id} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                        {next.label}
                      </button>
                    )}
                    {(delivery.status === "picked_up" || delivery.status === "in_transit") && (
                      <button type="button" onClick={() => setAutoSendId(isTracking ? null : delivery.id)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${isTracking ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white"}`}>
                        {isTracking ? "Partage de position actif ●" : "Partager ma position"}
                      </button>
                    )}
                    {(delivery.status === "picked_up" || delivery.status === "in_transit") && (
                      <button type="button" onClick={() => sendPosition(delivery.id)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold">
                        Ping GPS
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div id="historique" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Historique</h2>
        <div className="mt-4 space-y-3">
          {historyRows.length ? historyRows.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{entry.deliveryReference}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABELS[entry.status].className}`}>{STATUS_LABELS[entry.status].label}</span>
              </div>
              <p className="mt-1 text-slate-600">{entry.address}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDate(entry.at)} · {entry.by}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucun historique de statut disponible.</p>}
        </div>
      </div>

      <div id="revenus" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Revenus</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-900">Barème par livraison</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input type="number" value={earningForm.amount} onChange={(e) => setEarningForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Montant" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={earningForm.currency} onChange={(e) => setEarningForm((prev) => ({ ...prev, currency: e.target.value as "USD" | "CDF" }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
              <button type="button" onClick={saveEarningConfig} disabled={savingProfile} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                Enregistrer
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-900">Revenus enregistrés</p>
            <p className="mt-3 text-sm text-slate-600">
              {earningSummary.length
                ? earningSummary.map(([currency, amount]) => `${amount.toLocaleString("fr-FR")} ${currency}`).join(" / ")
                : "Aucun revenu enregistré pour le moment."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Les revenus sont créés automatiquement quand une mission passe à l&apos;état livrée.
            </p>
          </div>
        </div>
      </div>

      <div id="vehicule" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Véhicule</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input value={vehicleForm.label} onChange={(e) => setVehicleForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Type de véhicule" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm((prev) => ({ ...prev, plateNumber: e.target.value }))} placeholder="Plaque" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={vehicleForm.capacity} onChange={(e) => setVehicleForm((prev) => ({ ...prev, capacity: e.target.value }))} placeholder="Capacité" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={saveVehicle} disabled={savingProfile} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Enregistrer
          </button>
        </div>
        {profile?.vehicle && (
          <p className="mt-3 text-sm text-slate-600">
            {profile.vehicle.label} · {profile.vehicle.plateNumber}
            {profile.vehicle.capacity ? ` · ${profile.vehicle.capacity}` : ""}
          </p>
        )}
      </div>

      <div id="documents" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Documents</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input value={documentForm.name} onChange={(e) => setDocumentForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nom du document" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={documentForm.url} onChange={(e) => setDocumentForm((prev) => ({ ...prev, url: e.target.value }))} placeholder="URL / chemin" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={documentForm.category} onChange={(e) => setDocumentForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Catégorie" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={addDocument} disabled={savingProfile} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Ajouter
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {profile?.documents.length ? profile.documents.map((document) => (
            <div key={document.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="font-medium text-slate-900">{document.name}</p>
              <p className="mt-1 text-slate-600">{document.category}</p>
              <p className="mt-1 text-xs text-slate-400">{document.url}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucun document enregistré.</p>}
        </div>
      </div>

      <div id="support" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Support</h2>
        <p className="mt-3 text-sm text-slate-500">En cas de blocage sur une mission, utilisez le suivi de statut et le partage GPS pour donner le plus de contexte possible à l&apos;équipe support.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Missions disponibles</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune mission disponible pour le moment.</p>
          ) : (
            available.map((delivery) => (
              <div key={delivery.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{delivery.deliveryAddress}</p>
                  <button type="button" onClick={() => accept(delivery.id)} disabled={busyId === delivery.id} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                    Accepter
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">{delivery.clientName} · {delivery.reference}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
