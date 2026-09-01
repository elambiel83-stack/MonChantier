import { NextResponse } from 'next/server';
import { createProject, listProjects } from '@/lib/projectStore';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const projects = await listProjects(actor.identity);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const body = await request.json();
  const name = String(body?.name || '').trim();
  const address = typeof body?.address === 'string' ? body.address.trim() : undefined;
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : undefined;
  if (!name) {
    return NextResponse.json({ message: 'Nom du projet requis' }, { status: 400 });
  }

  const projects = await createProject(actor.identity, { name, address, notes });
  return NextResponse.json({ success: true, projects });
}
