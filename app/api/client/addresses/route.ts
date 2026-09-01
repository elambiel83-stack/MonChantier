import { NextResponse } from 'next/server';
import { createAddress, listAddresses } from '@/lib/addressStore';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const addresses = await listAddresses(actor.identity);
  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const body = await request.json();
  const label = String(body?.label || '').trim();
  const address = String(body?.address || '').trim();
  if (!label || !address) {
    return NextResponse.json({ message: 'Libellé et adresse sont requis' }, { status: 400 });
  }

  const addresses = await createAddress(actor.identity, { label, address });
  return NextResponse.json({ success: true, addresses });
}
