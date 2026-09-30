// MonChantier brand constants
import { constructionProducts, constructionServices } from './constructionCatalog';

export const LOGO_URL = "/images/brand/monchantier-logo.svg";
export const BANNER_URL = "/images/banners/hero.svg";
export const PRODUCTS_BANNER_URL = "/images/banners/produits.svg";
export const SERVICES_BANNER_URL = "/images/banners/services.svg";

// Catalogue exhaustif de référence. Les prix null restent « sur devis » jusqu'à
// validation par un administrateur ou un fournisseur partenaire.
export const products = constructionProducts;
export const services = constructionServices;

// Contact info
export const CONTACT_INFO = {
  address: "2452 Av. De l'eglise, Kolwezi",
  whatsapp: "+243999972466",
  email: "contact@monchantier.net",
};

// Input styles for forms
export const INPUT_CLASS = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent";
