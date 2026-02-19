# MonChantier - Structure réorganisée

## 📁 Architecture

```
components/
├── MonChantierSite.tsx         # Composant principal (52 lignes)
└── monchantier/
    ├── index.ts                # Exports centralisés
    ├── constants.ts            # Constantes et données
    ├── types.ts                # Types TypeScript
    ├── Header.tsx              # En-tête avec navigation
    ├── Hero.tsx                # Section hero
    ├── Products.tsx            # Catalogue produits
    ├── Services.tsx            # Section services
    ├── About.tsx               # À propos
    ├── Partners.tsx            # Formulaire partenaires
    ├── Contact.tsx             # Formulaire contact
    ├── Footer.tsx              # Pied de page
    ├── PaymentModal.tsx        # Modal de paiement
    └── hooks/
        └── useFxRate.ts        # Hook taux de change
```

## ✨ Améliorations

### Avant
- **1 fichier** de 1045 lignes
- Difficile à maintenir
- Logique mélangée
- Pas de réutilisabilité

### Après
- **14 fichiers** modulaires
- Composant principal : **52 lignes**
- Séparation claire des responsabilités
- Facile à tester et maintenir
- Types TypeScript stricts

## 🎯 Avantages

1. **Maintenabilité** : Chaque fichier a une responsabilité unique
2. **Réutilisabilité** : Les composants peuvent être utilisés ailleurs
3. **Testabilité** : Plus facile de tester des petits composants
4. **Collaboration** : Plusieurs développeurs peuvent travailler en parallèle
5. **Performance** : Meilleure optimisation du code splitting

## 📦 Utilisation

```tsx
// Import simple depuis le composant principal
import MonChantierSite from "@/components/MonChantierSite";

// Ou import de composants individuels
import { Header, Products, PaymentModal } from "@/components/monchantier";
```

## 🔧 Composants

### Header
- Navigation principale
- Sélecteur de langue FR/EN
- Logo et branding

### Hero
- Bannière d'accueil
- Texte d'introduction
- Boutons CTA

### Products
- Grille de 6 produits
- Images avec fallback
- Boutons "Devis" et "Payer"

### Services
- 3 services (Livraison, Qualité, Support)
- Icônes et descriptions

### About
- Présentation de l'entreprise
- Points forts

### Partners
- Formulaire transporteurs/fournisseurs
- Validation côté client
- Envoi à l'API

### Contact
- Formulaire de contact
- Validation
- Intégration WhatsApp/Email

### Footer
- Informations légales
- Bouton WhatsApp flottant

### PaymentModal
- 3 méthodes de paiement
- Conversion USD/CDF
- Intégration APIs de paiement

## 🛠️ Hooks personnalisés

### useFxRate
Récupère le taux de change USD/CDF depuis la BCC via l'API `/api/fx/usd-cdf`

```tsx
const { fxRateUSDCDF, fxLoading } = useFxRate();
```

## 📝 Types

Tous les types sont définis dans `types.ts` :
- `Language`, `Currency`, `PaymentMethod`
- `Product`, `Service`, `PartnerForm`, `ContactForm`
- `Status` pour les états de chargement

## 🎨 Constantes

Toutes les constantes sont dans `constants.ts` :
- URLs des images
- Catalogue de produits
- Services
- Informations de contact
- Classes CSS réutilisables
