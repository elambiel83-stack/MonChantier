import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canDecideLoan, canReviewLoan } from '@/lib/loanPermissions';
import { addLoanDocument, getLoanById, LoanDocumentCategory } from '@/lib/loanStore';

const VALID_CATEGORIES: LoanDocumentCategory[] = [
  'identity',
  'income',
  'project',
  'property',
  'collateral',
  'other',
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

    const loan = await getLoanById(params.id);
    if (!loan) return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });

    const isOwner = loan.identity === actor.identity;
    const isStaff = canReviewLoan(actor.role) || canDecideLoan(actor.role);
    if (!isOwner && !isStaff) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const category = formData.get('category');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Fichier requis' }, { status: 400 });
    }
    if (typeof category !== 'string' || !VALID_CATEGORIES.includes(category as LoanDocumentCategory)) {
      return NextResponse.json({ message: 'Catégorie invalide' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ message: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { message: 'Format non supporté (PDF, JPG, PNG uniquement)' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'data', 'loan-documents', params.id);
    await fs.mkdir(dir, { recursive: true });
    const storedName = `${Date.now()}-${sanitizeFileName(file.name)}`;
    const storagePath = path.join('loan-documents', params.id, storedName);
    await fs.writeFile(path.join(process.cwd(), 'data', storagePath), buffer);

    const result = await addLoanDocument({
      id: params.id,
      category: category as LoanDocumentCategory,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      uploadedBy: actor.identity,
    });

    if (!result.success) {
      return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, document: result.document, loan: result.loan });
  } catch (error) {
    console.error('Erreur upload document prêt:', error);
    return NextResponse.json({ message: "Erreur lors de l'envoi du document" }, { status: 500 });
  }
}
