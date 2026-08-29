import React, { useState } from "react";
import { CONTACT_INFO, INPUT_CLASS, services } from "./constants";
import { ContactForm, Language, Status } from "./types";

interface ContactProps {
  lang: Language;
  t: (fr: string, en: string) => string;
}

export function Contact({ lang, t }: ContactProps) {
  const [contactForm, setContactForm] = useState<ContactForm>({
    name: "",
    email: "",
    phone: "",
    services: [],
    message: "",
  });
  const [contactStatus, setContactStatus] = useState<Status>("idle");
  const [contactMsg, setContactMsg] = useState("");
  const [emailDelivered, setEmailDelivered] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setContactStatus("loading");
      setContactMsg("");
      setEmailDelivered(null);

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contactForm, lang }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Erreur d'envoi");
      }

      const delivered = data?.emailDelivered !== false;
      setContactStatus("success");
      setContactMsg(data.message);
      setEmailDelivered(delivered);
      setContactForm({ name: "", email: "", phone: "", services: [], message: "" });
    } catch (err: unknown) {
      setContactStatus("error");
      const message = err instanceof Error ? err.message : undefined;
      setContactMsg(message || t("Erreur lors de l'envoi", "Error sending message"));
      setEmailDelivered(null);
    }
  };

  return (
    <section id="contact" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">{t("Contact & Devis", "Contact & Quotes")}</h2>
            <p className="mt-3 text-slate-300">
              {t(
                `Adresse: ${CONTACT_INFO.address} • WhatsApp: ${CONTACT_INFO.whatsapp} • Email: ${CONTACT_INFO.email}`,
                `Address: ${CONTACT_INFO.address} • WhatsApp: ${CONTACT_INFO.whatsapp} • Email: ${CONTACT_INFO.email}`
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${CONTACT_INFO.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-3 rounded-xl shadow"
              >
                <span>WhatsApp</span>
              </a>
              <a
                href={`mailto:${CONTACT_INFO.email}`}
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-3 rounded-xl shadow"
              >
                <span>{t("Envoyer un email", "Send email")}</span>
              </a>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="bg-white text-slate-800 rounded-2xl p-6 ring-1 ring-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                className={INPUT_CLASS}
                placeholder={t("Nom", "Name")}
                value={contactForm.name}
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                className={INPUT_CLASS}
                placeholder="Email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <input
                className={`${INPUT_CLASS} sm:col-span-2`}
                placeholder={t("Téléphone", "Phone")}
                value={contactForm.phone}
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  {t("Services souhaités pour le devis", "Services requested for the quote")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3 max-h-56 overflow-y-auto">
                  {services.map((service) => {
                    const label = t(service.fr, service.en);
                    const checked = contactForm.services.includes(label);

                    return (
                      <label key={service.fr} className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setContactForm((f) => ({
                              ...f,
                              services: isChecked
                                ? [...f.services, label]
                                : f.services.filter((item) => item !== label),
                            }));
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {t("Sélection facultative: choisis un ou plusieurs services.", "Optional selection: choose one or more services.")}
                </p>
              </div>
              <textarea
                className={`${INPUT_CLASS} sm:col-span-2 min-h-[120px]`}
                placeholder={t("Votre message", "Your message")}
                value={contactForm.message}
                onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                required={contactForm.services.length === 0}
              />
            </div>
            <button
              type="submit"
              disabled={contactStatus === "loading"}
              className="mt-4 w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl"
            >
              {contactStatus === "loading" ? t("Envoi…", "Sending…") : t("Envoyer la demande", "Send request")}
            </button>
            {contactMsg && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p
                  className={`text-sm ${
                    contactStatus === "error"
                      ? "text-red-600"
                      : emailDelivered === false
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}
                >
                  {contactMsg}
                </p>
                {contactStatus === "success" && emailDelivered === false && (
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    {t("Email en attente", "Email pending")}
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              {t("En envoyant, vous acceptez notre politique de confidentialité.", "By sending, you agree to our privacy policy.")}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
