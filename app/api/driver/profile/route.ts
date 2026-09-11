import { NextRequest, NextResponse } from 'next/server';
import { addDriverDocument, getDriverProfile, updateDriverProfile } from '@/lib/driverStore';
import { getSessionActor } from '@/lib/sessionIdentity';

function sanitizeVehicle(body: Record<string, unknown>) {
  const label = String(body?.label || '').trim();
  const plateNumber = String(body?.plateNumber || '').trim();
  const capacity = String(body?.capacity || '').trim();
  if (!label || !plateNumber) return null;
  return { label, plateNumber, capacity: capacity || undefined };
}

export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'driver') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const profile = await getDriverProfile(actor.identity);
  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'driver') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Parameters<typeof updateDriverProfile>[1] = {};

    if (body.vehicle === null) {
      patch.vehicle = null;
    } else if (body.vehicle && typeof body.vehicle === 'object') {
      const vehicle = sanitizeVehicle(body.vehicle as Record<string, unknown>);
      if (!vehicle) return NextResponse.json({ message: 'Véhicule invalide' }, { status: 400 });
      patch.vehicle = vehicle;
    }

    if (body.defaultEarningAmount !== undefined) {
      if (body.defaultEarningAmount === null || body.defaultEarningAmount === '') {
        patch.defaultEarningAmount = null;
      } else {
        const amount = Number(body.defaultEarningAmount);
        if (!Number.isFinite(amount) || amount < 0) {
          return NextResponse.json({ message: 'Rémunération invalide' }, { status: 400 });
        }
        patch.defaultEarningAmount = amount;
      }
    }

    if (body.defaultEarningCurrency === 'USD' || body.defaultEarningCurrency === 'CDF') {
      patch.defaultEarningCurrency = body.defaultEarningCurrency;
    }

    const profile = await updateDriverProfile(actor.identity, patch);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Erreur mise à jour profil livreur:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du profil' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'driver') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body?.name || '').trim();
    const url = String(body?.url || '').trim();
    const category = String(body?.category || '').trim();
    if (!name || !url || !category) {
      return NextResponse.json({ message: 'Nom, url et catégorie sont requis' }, { status: 400 });
    }

    const profile = await addDriverDocument(actor.identity, { name, url, category });
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Erreur ajout document livreur:', error);
    return NextResponse.json({ message: "Erreur lors de l'ajout du document" }, { status: 500 });
  }
}
