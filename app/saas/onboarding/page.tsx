"use client";
import { useState } from 'react';

export default function SaasOnboardingPage() {
  const [name,setName]=useState(''); const [slug,setSlug]=useState('');
  const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    const response=await fetch('/api/saas/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,slug})});
    const data=await response.json(); setBusy(false);
    if (!response.ok) return setMessage(data.message || 'Erreur');
    window.location.assign('/api/auth/session?update=1');
    setTimeout(()=>window.location.assign('/saas'),500);
  }
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border bg-white p-7 shadow-sm">
      <p className="text-sm font-bold text-orange-600">MonChantier SaaS V2</p>
      <h1 className="mt-2 text-2xl font-black">Créer votre organisation</h1>
      <input className="mt-6 w-full rounded-lg border p-3" required value={name} onChange={e=>setName(e.target.value)} placeholder="Nom de l’entreprise" />
      <input className="mt-3 w-full rounded-lg border p-3" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={40} value={slug} onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="identifiant-entreprise" />
      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-lg bg-orange-600 p-3 font-bold text-white disabled:opacity-50">{busy?'Création…':'Créer mon espace SaaS'}</button>
    </form>
  </main>;
}
