// Vérifie un jeton Cloudflare Turnstile côté serveur: comme pour les
// fournisseurs OAuth, seule la réponse de Cloudflare fait foi, jamais ce que
// le client affirme avoir résolu.
// Non configuré (pas de TURNSTILE_SECRET_KEY), la vérification est un no-op
// qui laisse passer — le CAPTCHA est une protection en plus, pas une
// dépendance dure comme l'authentification (même choix que le dépôt Chantier).
export async function verifyTurnstileToken(token: string | undefined | null, remoteip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, ...(remoteip ? { remoteip } : {}) }),
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => null);
  return Boolean(data?.success);
}
