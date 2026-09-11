import { NextRequest, NextResponse } from 'next/server';
import {
  addTechnicianEquipment,
  addTechnicianPhoto,
  getTechnicianProfile,
} from '@/lib/technicianStore';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'technician') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const profile = await getTechnicianProfile(actor.identity);
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'technician') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body?.kind || '').trim();

    if (kind === 'equipment') {
      const name = String(body?.name || '').trim();
      const quantity = Number(body?.quantity);
      const condition = String(body?.condition || '').trim();
      const note = String(body?.note || '').trim() || undefined;
      if (!name || !condition || !Number.isFinite(quantity) || quantity < 0) {
        return NextResponse.json({ message: 'Équipement invalide' }, { status: 400 });
      }
      const profile = await addTechnicianEquipment(actor.identity, { name, quantity, condition, note });
      return NextResponse.json({ success: true, profile });
    }

    if (kind === 'photo') {
      const name = String(body?.name || '').trim();
      const url = String(body?.url || '').trim();
      const category = String(body?.category || '').trim() || 'intervention';
      if (!name || !url) {
        return NextResponse.json({ message: 'Photo invalide' }, { status: 400 });
      }
      const profile = await addTechnicianPhoto(actor.identity, { name, url, category });
      return NextResponse.json({ success: true, profile });
    }

    return NextResponse.json({ message: 'Type de ressource invalide' }, { status: 400 });
  } catch (error) {
    console.error('Erreur profil technicien:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du profil' }, { status: 500 });
  }
}
