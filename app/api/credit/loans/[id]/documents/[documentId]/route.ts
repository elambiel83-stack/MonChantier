import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canAccessLoan } from '@/lib/loanPermissions';
import { getLoanById } from '@/lib/loanStore';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; documentId: string } }
) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

  const loan = await getLoanById(params.id);
  if (!loan) return NextResponse.json({ message: 'Prêt introuvable' }, { status: 404 });

  if (!canAccessLoan(actor, loan)) {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const document = loan.documents.find((item) => item.id === params.documentId);
  if (!document) {
    return NextResponse.json({ message: 'Document introuvable' }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(path.join(process.cwd(), 'data', document.storagePath));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `inline; filename="${document.fileName}"`,
      },
    });
  } catch (error) {
    console.error('Erreur lecture document prêt:', error);
    return NextResponse.json({ message: 'Fichier introuvable sur le serveur' }, { status: 404 });
  }
}
