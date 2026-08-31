"use client";

import { useEffect, useState } from "react";
import { haversineDistanceKm } from "@/lib/drcCities";

type DeliveryStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "delivered" | "cancelled";

type Coordinates = { lat: number; lng: number };
type PositionPing = { lat: number; lng: number; at: string };
type StatusEntry = { id: string; at: string; status: DeliveryStatus; note?: string };

type Delivery = {
  id: string;
  reference: string;
  status: DeliveryStatus;
  deliveryAddress: string;
  destination: Coordinates | null;
  origin: Coordinates;
  currentPosition?: PositionPing;
  createdAt: string;
  statusHistory: StatusEntry[];
};

const STATUS_STEPS: { status: DeliveryStatus; label: string }[] = [
  { status: "pending", label: "Commande reçue" },
  { status: "assigned", label: "Livreur assigné" },
  { status: "picked_up", label: "Colis récupéré" },
  { status: "in_transit", label: "En transit" },
  { status: "delivered", label: "Livrée" },
];

const STATUS_PERCENT: Record<DeliveryStatus, number> = {
  pending: 5,
  assigned: 15,
  picked_up: 25,
  in_transit: 60,
  delivered: 100,
  cancelled: 0,
};

function computeProgress(delivery: Delivery): number {
  if (delivery.status === "delivered") return 100;
  if (delivery.status === "cancelled") return 0;
  if (delivery.status === "in_transit" && delivery.destination && delivery.currentPosition) {
    const total = haversineDistanceKm(
      delivery.origin.lat,
      delivery.origin.lng,
      delivery.destination.lat,
      delivery.destination.lng
    );
    const remaining = haversineDistanceKm(
      delivery.currentPosition.lat,
      delivery.currentPosition.lng,
      delivery.destination.lat,
      delivery.destination.lng
    );
    if (total > 0) {
      const covered = Math.max(0, Math.min(1, 1 - remaining / total));
      return Math.round(25 + covered * 70);
    }
  }
  return STATUS_PERCENT[delivery.status];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

export default function DeliveryTrackingPanel() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/deliveries", { cache: "no-store" });
      const data = await res.json();
      setDeliveries(res.ok ? data.deliveries || [] : []);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mes livraisons</h2>
      <p className="mt-1 text-sm text-slate-500">
        Suivi de la progression de vos commandes, du dépôt jusqu&apos;à votre adresse.
      </p>

      <div className="mt-4 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune livraison pour le moment.</p>
        ) : (
          deliveries.map((delivery) => {
            const progress = computeProgress(delivery);
            const remainingKm =
              delivery.destination && delivery.currentPosition
                ? Math.round(
                    haversineDistanceKm(
                      delivery.currentPosition.lat,
                      delivery.currentPosition.lng,
                      delivery.destination.lat,
                      delivery.destination.lng
                    )
                  )
                : null;

            return (
              <div key={delivery.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{delivery.deliveryAddress}</p>
                  <span className="font-mono text-xs text-slate-400">{delivery.reference}</span>
                </div>

                {delivery.status === "cancelled" ? (
                  <p className="mt-2 text-sm text-red-600">Livraison annulée.</p>
                ) : (
                  <>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-orange-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
                      {STATUS_STEPS.map((step) => {
                        const reached =
                          STATUS_STEPS.findIndex((s) => s.status === delivery.status) >=
                          STATUS_STEPS.findIndex((s) => s.status === step.status);
                        return (
                          <span
                            key={step.status}
                            className={reached ? "font-semibold text-orange-700" : ""}
                          >
                            {step.label}
                          </span>
                        );
                      })}
                    </div>
                    {delivery.status === "in_transit" && remainingKm !== null && (
                      <p className="mt-2 text-xs text-slate-500">
                        Livreur à environ {remainingKm} km de votre adresse (position mise à jour{" "}
                        {delivery.currentPosition && formatDateTime(delivery.currentPosition.at)}).
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
