type TechnicalProduct = { fr: string; en: string; category: string; unitFr: string; unitEn: string };

const checks: Record<string, [string, string]> = {
  aggregats: ['Granulométrie, origine et conditionnement', 'Grading, origin and packaging'],
  blocs_paves: ['Dimensions, résistance et quantité par lot', 'Dimensions, strength and quantity per batch'],
  acier_metaux: ['Section, longueur et nuance du métal', 'Section, length and metal grade'],
  bois_menuiserie: ['Essence, section, longueur et traitement', 'Species, section, length and treatment'],
  toiture_etancheite: ['Épaisseur, dimensions utiles et finition', 'Thickness, effective dimensions and finish'],
  revetements_finitions: ['Format, finition et surface par colis', 'Size, finish and coverage per package'],
  plomberie_sanitaire: ['Diamètre, matériau et raccordement', 'Diameter, material and connection'],
  electricite_energie: ['Puissance, tension et indice de protection', 'Power, voltage and protection rating'],
  securite: ['Taille, matériau et certification fournisseur', 'Size, material and supplier certification'],
  routes_assainissement: ['Dimensions, matériau et charge admissible', 'Dimensions, material and load rating'],
  outillage_engins: ['Puissance, capacité et accessoires inclus', 'Power, capacity and included accessories'],
};

/** Only surface measurements already written in the product designation. */
export function productTechnicalDetails(product: TechnicalProduct, lang: 'fr' | 'en') {
  const name = lang === 'fr' ? product.fr : product.en;
  const measurement = name.match(/\d+(?:[.,]\d+)?\s*(?:[x×/]\s*\d+(?:[.,]\d+)?)+(?:\s*(?:mm|cm|m)\b)?|\b\d+(?:[.,]\d+)?\s*(?:mm²|mm|cm|kg|kW|W|kVA|V|A|L|litres?)\b/i)?.[0];
  return {
    unit: lang === 'fr' ? product.unitFr : product.unitEn,
    measurement: measurement || null,
    toConfirm: (checks[product.category] || ['Caractéristiques et conditionnement fournisseur', 'Supplier specifications and packaging'])[lang === 'fr' ? 0 : 1],
  };
}
