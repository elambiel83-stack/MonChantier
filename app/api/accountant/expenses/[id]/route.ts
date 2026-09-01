import { NextRequest, NextResponse } from 'next/server';
import { deleteExpense, updateExpense, UpdateExpensePatch } from '@/lib/expenseStore';
import { requireRole } from '@/lib/requireRole';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, ['accountant']);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const patch: UpdateExpensePatch = {};

    if (typeof body?.label === 'string') patch.label = body.label.trim();
    if (typeof body?.category === 'string') patch.category = body.category.trim();
    if (typeof body?.date === 'string') patch.date = body.date.trim();
    if (body?.currency === 'USD' || body?.currency === 'CDF') patch.currency = body.currency;
    if (body?.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ message: 'Montant invalide' }, { status: 400 });
      }
      patch.amount = amount;
    }

    const expense = await updateExpense(id, patch);
    if (!expense) {
      return NextResponse.json({ message: 'Dépense introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error('Erreur mise à jour dépense:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour de la dépense' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, ['accountant']);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
  }

  const deleted = await deleteExpense(id);
  if (!deleted) {
    return NextResponse.json({ message: 'Dépense introuvable' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
