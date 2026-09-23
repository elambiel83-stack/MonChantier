import { listProducts } from '@/lib/productStore';
import { csvCell, productShareUrl, storefrontOrigin } from '@/lib/socialCommerce';

export const dynamic = 'force-dynamic';

export async function GET() {
  const products = await listProducts({ activeOnly: true });
  const origin = storefrontOrigin();
  const rows = products.flatMap((product) => {
    const currency = product.priceUSD != null ? 'USD' : product.priceCDF != null ? 'CDF' : null;
    const amount = product.priceUSD ?? product.priceCDF;
    if (!currency || amount == null || amount <= 0) return [];
    const image = new URL(product.img, `${origin}/`).toString();
    const availability = product.stock === 0 ? 'out of stock' : 'in stock';
    return [[
      product.id,
      product.fr,
      `Matériau de construction vendu par MonChantier — unité : ${product.unitFr}`,
      availability,
      'new',
      `${amount.toFixed(2)} ${currency}`,
      productShareUrl(product.id, 'facebook', origin),
      image,
      'MonChantier',
    ].map(csvCell).join(',')];
  });
  const header = 'id,title,description,availability,condition,price,link,image_link,brand';
  return new Response([header, ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="monchantier-meta-catalog.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
