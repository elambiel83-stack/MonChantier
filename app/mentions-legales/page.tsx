import Link from "next/link";
import { CONTACT_INFO } from "@/components/monchantier/constants";

export const metadata = {
  title: "Mentions légales — MonChantier",
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
          ← Retour à l&apos;accueil
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Mentions légales</h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : 31 août 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Éditeur du site</h2>
            <p className="mt-2">
              Le site MonChantier est édité par MonChantier SARL (forme juridique et numéro RCCM /
              Identifiant National à compléter par l&apos;exploitant), dont le siège social est situé
              à {CONTACT_INFO.address}, République Démocratique du Congo.
            </p>
            <p className="mt-2">
              Contact : {CONTACT_INFO.email} — WhatsApp {CONTACT_INFO.whatsapp}
            </p>
            <p className="mt-2">Directeur de la publication : la direction de MonChantier.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Hébergement</h2>
            <p className="mt-2">
              L&apos;hébergeur du site sera précisé ici par l&apos;exploitant (nom, adresse et contact
              du prestataire d&apos;hébergement utilisé en production).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Propriété intellectuelle</h2>
            <p className="mt-2">
              L&apos;ensemble des contenus présents sur le site (textes, images, logos, structure)
              est protégé au titre de la propriété intellectuelle. Toute reproduction ou
              représentation, totale ou partielle, sans autorisation préalable est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Responsabilité</h2>
            <p className="mt-2">
              MonChantier s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées sur
              le site, sans garantie d&apos;exhaustivité. MonChantier ne saurait être tenu responsable
              des dommages résultant d&apos;une indisponibilité temporaire du service ou d&apos;une
              erreur d&apos;affichage des prix et disponibilités.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Droit applicable</h2>
            <p className="mt-2">
              Les présentes mentions légales sont soumises au droit de la République Démocratique
              du Congo. Tout litige relève de la compétence des juridictions congolaises.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Contact</h2>
            <p className="mt-2">
              Pour toute question relative au site, contactez-nous à {CONTACT_INFO.email}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
