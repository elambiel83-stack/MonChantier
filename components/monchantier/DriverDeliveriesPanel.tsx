"use client";

import { useEffect, useRef, useState } from "react";

type DeliveryStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "delivered" | "cancelled";

type Delivery = {
  id: string;
  reference: string;
  clientName: string;
  status: DeliveryStatus;
  deliveryAddress: string;
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

export default function DriverDeliveriesPanel() {
  const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);
  const [available, setAvailable] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState("");
  const [autoSendId, setAutoSendId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/deliveries", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setMyDeliveries(data.deliveries || []);
        setAvailable(data.available || []);
      }
    } catch {
      setMyDeliveries([]);
      setAvailable([]);
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
      setBanner("Mission acceptée.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
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
      setBanner("Statut mis à jour.");
      if (status === "delivered" && autoSendId === id) setAutoSendId(null);
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  const sendPosition = (id: string, silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) setBanner("Géolocalisation non supportée par ce navigateur.");
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
            setBanner(data?.message || "Erreur envoi position");
          } else if (!silent) {
            setBanner("Position envoyée.");
          }
        } catch {
          if (!silent) setBanner("Erreur envoi position");
        }
      },
      () => {
        if (!silent) setBanner("Impossible d'obtenir votre position.");
      }
    );
  };

  return (
    <div id="mes-missions">
      <h1 className="text-2xl font-bold tracking-tight">Transporteur / Livreur</h1>
      <p className="mt-1 text-slate-600">Accepter et exécuter les missions de livraison.</p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Mes missions</h2>
        <div className="mt-3 space-y-3">
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
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {delivery.clientName} · {delivery.reference}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {next && (
                      <button
                        type="button"
                        onClick={() => advanceStatus(delivery.id, next.status)}
                        disabled={busyId === delivery.id}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5"
                      >
                        {next.label}
                      </button>
                    )}
                    {(delivery.status === "picked_up" || delivery.status === "in_transit") && (
                      <button
                        type="button"
                        onClick={() => setAutoSendId(isTracking ? null : delivery.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          isTracking
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isTracking ? "Partage de position actif ●" : "Partager ma position"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">Missions disponibles</h2>
        <div className="mt-3 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune mission disponible pour le moment.</p>
          ) : (
            available.map((delivery) => (
              <div key={delivery.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{delivery.deliveryAddress}</p>
                  <button
                    type="button"
                    onClick={() => accept(delivery.id)}
                    disabled={busyId === delivery.id}
                    className="rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5"
                  >
                    Accepter
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {delivery.clientName} · {delivery.reference}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
