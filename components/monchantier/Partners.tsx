import React, { useState } from "react";
import { INPUT_CLASS } from "./constants";
import { Language, PartnerForm, PartnerType, Status } from "./types";

interface PartnersProps {
  lang: Language;
  t: (fr: string, en: string) => string;
}

export function Partners({ lang, t }: PartnersProps) {
  const [partnerType, setPartnerType] = useState<PartnerType>("transporter");
  const [partnerForm, setPartnerForm] = useState<PartnerForm>({
    company: "",
    fullname: "",
    phone: "+243",
    email: "",
    city: "Kolwezi",
    address: "",
    vehicleTypes: "",
    capacity: "",
    zones: "",
    products: "",
    minOrder: "",
    deliveryAvailable: true,
    specialty: "",
    experience: "",
    certifications: "",
    notes: "",
  });
  const [partnerStatus, setPartnerStatus] = useState<Status>("idle");
  const [partnerMsg, setPartnerMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPartnerStatus("loading");
      setPartnerMsg("");
      const payload = { type: partnerType, ...partnerForm, lang };

      const res = await fetch("/api/partners/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (!res) {
        setPartnerStatus("success");
        setPartnerMsg(
          t(
            "Inscription enregistrée (mode démo). On vous contactera sous 24h.",
            "Registration saved (demo mode). We will contact you within 24h."
          )
        );
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Registration failed");

      setPartnerStatus("success");
      setPartnerMsg(t("Inscription envoyée. Merci !", "Registration sent. Thank you!"));
      setPartnerForm({
        company: "",
        fullname: "",
        phone: "+243",
        email: "",
        city: "Kolwezi",
        address: "",
        vehicleTypes: "",
        capacity: "",
        zones: "",
        products: "",
        minOrder: "",
        deliveryAvailable: true,
        specialty: "",
        experience: "",
        certifications: "",
        notes: "",
      });
    } catch (err: unknown) {
      setPartnerStatus("error");
      const message = err instanceof Error ? err.message : undefined;
      setPartnerMsg(message || t("Erreur", "Error"));
    }
  };

  return (
    <section id="partenaires" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">{t("Espace Partenaires", "Partner Registration")}</h2>
          <p className="mt-2 text-slate-600">
            {t(
              "Inscrivez-vous comme transporteur, fournisseur ou artisan pour travailler avec MonChantier.",
              "Register as a transporter, supplier or artisan to work with MonChantier."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPartnerType("transporter")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${partnerType === "transporter" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50 border-slate-300"}`}
          >
            {t("Transporteur", "Transporter")}
          </button>
          <button
            type="button"
            onClick={() => setPartnerType("supplier")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${partnerType === "supplier" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50 border-slate-300"}`}
          >
            {t("Fournisseur", "Supplier")}
          </button>
          <button
            type="button"
            onClick={() => setPartnerType("artisan")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${partnerType === "artisan" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50 border-slate-300"}`}
          >
            {t("Artisan", "Artisan")}
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 ring-1 ring-slate-200 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">{t("Entreprise", "Company")}</label>
                <input
                  className={`mt-1 ${INPUT_CLASS}`}
                  value={partnerForm.company}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, company: e.target.value }))}
                  placeholder={t("Nom de l'entreprise", "Company name")}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{t("Nom complet", "Full name")}</label>
                <input
                  className={`mt-1 ${INPUT_CLASS}`}
                  value={partnerForm.fullname}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, fullname: e.target.value }))}
                  placeholder={t("Contact principal", "Primary contact")}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{t("Téléphone", "Phone")}</label>
                <input
                  className={`mt-1 ${INPUT_CLASS}`}
                  value={partnerForm.phone}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder={t("Ex: +243…", "e.g., +243…")}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Email</label>
                <input
                  className={`mt-1 ${INPUT_CLASS}`}
                  value={partnerForm.email}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, email: e.target.value }))}
                  type="email"
                  placeholder="email@exemple.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{t("Ville", "City")}</label>
                <input
                  className={`mt-1 ${INPUT_CLASS}`}
                  value={partnerForm.city}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder={t("Ex: Kolwezi", "e.g., Kolwezi")}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{t("Adresse", "Address")}</label>
                <input
                  className={`mt-1 ${INPUT_CLASS}`}
                  value={partnerForm.address}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder={t("Quartier, avenue…", "Area, street…")}
                />
              </div>
            </div>

            {partnerType === "transporter" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">{t("Types de véhicules", "Vehicle types")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.vehicleTypes}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, vehicleTypes: e.target.value }))}
                    placeholder={t("Benne, camion, pickup…", "Dump truck, truck, pickup…")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">{t("Capacité", "Capacity")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.capacity}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, capacity: e.target.value }))}
                    placeholder={t("Ex: 10T, 20m³…", "e.g., 10T, 20m³…")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">{t("Zones desservies", "Service zones")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.zones}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, zones: e.target.value }))}
                    placeholder={t("Kolwezi, Fungurume, Lubumbashi…", "Kolwezi, Fungurume, Lubumbashi…")}
                  />
                </div>
              </div>
            ) : partnerType === "supplier" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">{t("Produits fournis", "Supplied products")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.products}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, products: e.target.value }))}
                    placeholder={t("Briques, sable, moellons, carreaux…", "Bricks, sand, stones, tiles…")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">{t("Commande minimum", "Minimum order")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.minOrder}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, minOrder: e.target.value }))}
                    placeholder={t("Ex: 5m³, 500 unités…", "e.g., 5m³, 500 units…")}
                  />
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <input
                    id="deliveryAvailable"
                    type="checkbox"
                    checked={partnerForm.deliveryAvailable}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, deliveryAvailable: e.target.checked }))}
                  />
                  <label htmlFor="deliveryAvailable" className="text-sm text-slate-700">
                    {t("Livraison disponible", "Delivery available")}
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">{t("Spécialité", "Specialty")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.specialty}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, specialty: e.target.value }))}
                    placeholder={t("Maçon, Charpentier, Carreleur, Plombier, Électricien, Jardinier…", "Mason, Carpenter, Tiler, Plumber, Electrician, Gardener…")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">{t("Années d'expérience", "Years of experience")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.experience}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, experience: e.target.value }))}
                    placeholder={t("Ex: 5 ans", "e.g., 5 years")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">{t("Certifications", "Certifications")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.certifications}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, certifications: e.target.value }))}
                    placeholder={t("Diplômes, formations…", "Diplomas, training…")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">{t("Zones d'intervention", "Service areas")}</label>
                  <input
                    className={`mt-1 ${INPUT_CLASS}`}
                    value={partnerForm.zones}
                    onChange={(e) => setPartnerForm((p) => ({ ...p, zones: e.target.value }))}
                    placeholder={t("Kolwezi, Dilala, Manika…", "Kolwezi, Dilala, Manika…")}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700">{t("Notes", "Notes")}</label>
              <textarea
                className={`mt-1 ${INPUT_CLASS} min-h-[110px]`}
                value={partnerForm.notes}
                onChange={(e) => setPartnerForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t("Ajoute des détails (horaires, prix, docs…) ", "Add details (schedule, pricing, docs…) ")}
              />
            </div>

            <button
              type="submit"
              disabled={partnerStatus === "loading"}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl"
            >
              {partnerStatus === "loading" ? t("Envoi…", "Submitting…") : t("S'inscrire comme partenaire", "Register as partner")}
            </button>

            {partnerMsg && (
              <p className={`text-sm ${partnerStatus === "error" ? "text-red-600" : "text-emerald-700"}`}>{partnerMsg}</p>
            )}

            <p className="text-xs text-slate-500">
              {t(
                "Astuce: En production, on stocke ces demandes dans une base de données et on notifie l'équipe par email/WhatsApp.",
                "Tip: In production, we store requests in a database and notify the team by email/WhatsApp."
              )}
            </p>
          </form>
        </div>

        <div className="bg-slate-50 rounded-2xl p-6 ring-1 ring-slate-200">
          <h3 className="font-semibold text-lg">{t("Pourquoi devenir partenaire ?", "Why partner with us?")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>• {t("Accès à des commandes régulières", "Access recurring orders")}</li>
            <li>• {t("Paiements sécurisés (Mobile Money, Carte, PayPal)", "Secure payments (Mobile Money, Card, PayPal)")}</li>
            <li>• {t("Relation long terme et visibilité", "Long-term relationship & visibility")}</li>
            <li>• {t("Procédure simple et rapide", "Simple and fast process")}</li>
          </ul>
          <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="text-xs font-semibold text-slate-700">{t("Support", "Support")}</div>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                "Besoin d'aide pour t'inscrire ? Écris-nous sur WhatsApp.",
                "Need help registering? Message us on WhatsApp."
              )}
            </p>
            <a
              href="https://wa.me/243999972466"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2 rounded-xl"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
