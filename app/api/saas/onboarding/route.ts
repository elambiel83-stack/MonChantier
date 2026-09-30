import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { createSaasTenant, findSaasMembership } from '@/lib/saas/membership';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message:'Connexion requise' }, { status:401 });
  if (await findSaasMembership(actor.identity)) {
    return NextResponse.json({ message:'Ce compte appartient déjà à une organisation SaaS' }, { status:409 });
  }
  const body = await request.json();
  const slug = String(body?.slug || '').trim().toLowerCase();
  const name = String(body?.name || '').trim();
  if (!name || slug.length < 3 || slug.length > 40 || !SLUG_RE.test(slug)) {
    return NextResponse.json({ message:'Nom et identifiant valides requis' }, { status:400 });
  }
  try {
    const membership = await createSaasTenant({
      identity: actor.identity, slug, name,
      settings: { locale:'fr-CD', timezone:'Africa/Lubumbashi', currency:['USD','CDF'] },
    });
    return NextResponse.json({ success:true, ...membership }, { status:201 });
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ message:'Identifiant déjà utilisé' }, { status:409 });
    console.error('Création tenant SaaS:', error);
    return NextResponse.json({ message:'Création impossible' }, { status:500 });
  }
}
