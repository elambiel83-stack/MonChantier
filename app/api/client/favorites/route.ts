import { NextResponse } from 'next/server';
import { addFavorite, listFavorites, removeFavorite } from '@/lib/favoriteStore';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const favorites = await listFavorites(actor.identity);
  return NextResponse.json({ favorites });
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const body = await request.json();
  const itemType = body?.itemType === 'product' || body?.itemType === 'service' ? body.itemType : null;
  const itemId = Number(body?.itemId);
  if (!itemType || !Number.isFinite(itemId)) {
    return NextResponse.json({ message: 'itemType et itemId sont requis' }, { status: 400 });
  }

  const favorites = await addFavorite(actor.identity, itemType, itemId);
  return NextResponse.json({ success: true, favorites });
}

export async function DELETE(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const body = await request.json();
  const itemType = body?.itemType === 'product' || body?.itemType === 'service' ? body.itemType : null;
  const itemId = Number(body?.itemId);
  if (!itemType || !Number.isFinite(itemId)) {
    return NextResponse.json({ message: 'itemType et itemId sont requis' }, { status: 400 });
  }

  const favorites = await removeFavorite(actor.identity, itemType, itemId);
  return NextResponse.json({ success: true, favorites });
}
