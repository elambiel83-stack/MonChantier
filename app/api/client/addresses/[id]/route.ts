import { NextResponse } from 'next/server';
import { deleteAddress, setDefaultAddress } from '@/lib/addressStore';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const body = await request.json();
  if (body?.isDefault !== true) {
    return NextResponse.json({ message: 'Rien à mettre à jour' }, { status: 400 });
  }

  const addresses = await setDefaultAddress(actor.identity, params.id);
  return NextResponse.json({ success: true, addresses });
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const addresses = await deleteAddress(actor.identity, params.id);
  return NextResponse.json({ success: true, addresses });
}
