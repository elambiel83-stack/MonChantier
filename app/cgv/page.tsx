import Link from "next/link";
import { CONTACT_INFO } from "@/components/monchantier/constants";

export const metadata = {
  title: "Conditions générales de vente — MonChantier",
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
          ← Retour à l&apos;accueil
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Conditions générales de vente</h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : 31 août 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Objet</h2>
            <p className="mt-2">
              Les présentes conditions générales de vente (CGV) régissent les ventes de matériaux de
              construction et de prestations de services proposées par MonChantier via son site
              internet, à destination de clients particuliers et professionnels en République
              Démocratique du Congo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Prix</h2>
            <p className="mt-2">
              Les prix des produits et services sont indiqués en dollars américains (USD) et/ou en
              francs congolais (CDF), toutes taxes comprises (TVA incluse le cas échéant), hors
              frais de livraison qui sont précisés avant la validation de la commande. MonChantier
              se réserve le droit de modifier ses prix à tout moment, les commandes déjà confirmées
              n&apos;étant pas affectées par ces modifications.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Commande</h2>
            <p className="mt-2">
              La commande est passée en ligne via le panier du site ou par demande de devis
              (WhatsApp/formulaire). Elle est considérée comme définitive après confirmation du
              paiement ou acceptation du devis par les deux parties. MonChantier se réserve le
              droit de refuser ou d&apos;annuler toute commande en cas d&apos;indisponibilité du
              produit/service ou de doute raisonnable sur sa validité.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Paiement</h2>
            <p className="mt-2">
              Le paiement peut être effectué par Mobile Money, carte bancaire ou PayPal, via les
              prestataires de paiement intégrés au site. La commande est traitée dès confirmation du
              paiement par le prestataire concerné. Une facture est transmise au client par email
              lorsque celui-ci est renseigné.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Livraison</h2>
            <p className="mt-2">
              Les délais et zones de livraison sont indiqués sur le site et peuvent varier selon la
              localisation du chantier. Le client peut suivre l&apos;état de sa livraison depuis son
              espace client. MonChantier ne peut être tenu responsable des retards dus à des causes
              extérieures (conditions d&apos;accès au chantier, force majeure, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Annulation et réclamations</h2>
            <p className="mt-2">
              Toute demande d&apos;annulation ou de réclamation relative à une commande doit être
              adressée à {CONTACT_INFO.email} ou via WhatsApp au {CONTACT_INFO.whatsapp}, avec la
              référence de commande. MonChantier étudie chaque demande au cas par cas, notamment
              lorsque les matériaux n&apos;ont pas encore été livrés ou que le service n&apos;a pas
              débuté.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Garanties</h2>
            <p className="mt-2">
              Les produits vendus bénéficient des garanties légales applicables en République
              Démocratique du Congo contre les défauts de conformité et vices cachés. Toute
              réclamation à ce titre doit être signalée dans les meilleurs délais après réception.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Droit applicable et litiges</h2>
            <p className="mt-2">
              Les présentes CGV sont régies par le droit congolais. En cas de litige, une solution
              amiable sera recherchée en priorité ; à défaut, les tribunaux compétents de la
              République Démocratique du Congo seront seuls compétents.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
