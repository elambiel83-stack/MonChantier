import Link from "next/link";
import { CONTACT_INFO } from "@/components/monchantier/constants";

export const metadata = {
  title: "Politique de confidentialité — MonChantier",
};

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="text-sm font-semibold text-orange-600 hover:text-orange-700">
          ← Retour à l&apos;accueil
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : 31 août 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Données collectées</h2>
            <p className="mt-2">
              Lors de l&apos;utilisation du site, MonChantier peut collecter : votre nom, numéro de
              téléphone, adresse email, adresse de livraison, position géographique (avec votre
              autorisation, pour la zone de livraison et le suivi), historique de commandes et de
              devis, ainsi que des informations liées à votre compte (rôle, portefeuille, dossiers de
              crédit le cas échéant).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Finalités du traitement</h2>
            <p className="mt-2">
              Ces données sont utilisées pour : traiter vos commandes et devis, assurer la livraison
              et son suivi, gérer votre compte et votre authentification (téléphone/OTP,
              Google/Facebook), émettre vos factures, et vous contacter au sujet de votre commande.
              Elles ne sont jamais revendues à des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Base légale et conservation</h2>
            <p className="mt-2">
              Le traitement repose sur l&apos;exécution du contrat de vente ou de service et, le cas
              échéant, sur votre consentement (géolocalisation). Les données sont conservées pendant
              la durée nécessaire à la gestion de la relation commerciale et aux obligations légales
              et comptables applicables en République Démocratique du Congo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Partage des données</h2>
            <p className="mt-2">
              Vos données de paiement sont transmises directement aux prestataires de paiement
              (Mobile Money, Stripe pour les cartes, PayPal) dans le seul but de traiter la
              transaction. Vos coordonnées de livraison peuvent être partagées avec nos partenaires
              transporteurs pour l&apos;acheminement de votre commande.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Cookies et stockage local</h2>
            <p className="mt-2">
              Le site utilise le stockage local de votre navigateur (localStorage) afin de conserver
              le contenu de votre panier entre deux visites, ainsi que des cookies de session
              nécessaires à votre authentification. Ces données restent sur votre appareil et ne
              sont pas transmises à des fins publicitaires.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Vos droits</h2>
            <p className="mt-2">
              Vous pouvez demander l&apos;accès, la rectification ou la suppression de vos données
              personnelles en nous contactant à {CONTACT_INFO.email}. Nous répondons à toute demande
              dans un délai raisonnable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Sécurité</h2>
            <p className="mt-2">
              MonChantier met en œuvre des mesures techniques raisonnables (chiffrement des mots de
              passe, limitation des tentatives de connexion, connexions sécurisées) afin de protéger
              vos données contre tout accès non autorisé.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Contact</h2>
            <p className="mt-2">
              Pour toute question relative à cette politique, contactez-nous à {CONTACT_INFO.email}
              {" "}ou via WhatsApp au {CONTACT_INFO.whatsapp}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
