import { NextRequest, NextResponse } from 'next/server';
import { createExpense, listExpenses } from '@/lib/expenseStore';
import { requireRole } from '@/lib/requireRole';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET(request: NextRequest) {
  const denied = await requireRole(request, ['accountant']);
  if (denied) return denied;

  const expenses = await listExpenses();
  return NextResponse.json({ expenses });
}

export async function POST(request: NextRequest) {
  const denied = await requireRole(request, ['accountant']);
  if (denied) return denied;

  try {
    const body = await request.json();
    const label = String(body?.label || '').trim();
    const category = String(body?.category || '').trim();
    const amount = Number(body?.amount);
    const currency = body?.currency === 'USD' ? 'USD' : body?.currency === 'CDF' ? 'CDF' : null;
    const date = String(body?.date || '').trim();

    if (!label || !category || !Number.isFinite(amount) || amount <= 0 || !currency || !date) {
      return NextResponse.json(
        { message: 'Libellé, catégorie, montant positif, devise et date sont requis' },
        { status: 400 }
      );
    }

    const actor = await getSessionActor();
    const expense = await createExpense({
      label,
      category,
      amount,
      currency,
      date,
      createdBy: actor?.identity || 'accountant',
    });

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error('Erreur création dépense:', error);
    return NextResponse.json({ message: 'Erreur lors de la création de la dépense' }, { status: 500 });
  }
}
