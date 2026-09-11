export function resolveTrustedRedirectUrl(
  value: unknown,
  baseOrigin: string
): { ok: true; url: string } | { ok: false } {
  if (typeof value !== 'string' || !value.trim()) return { ok: false };

  try {
    const trustedOrigin = new URL(baseOrigin).origin;
    const nextUrl = new URL(value, trustedOrigin);
    if (nextUrl.origin !== trustedOrigin) return { ok: false };
    return { ok: true, url: nextUrl.toString() };
  } catch {
    return { ok: false };
  }
}

export function withSearchParam(url: string, key: string, value: string, baseOrigin: string) {
  const nextUrl = new URL(url, baseOrigin);
  nextUrl.searchParams.set(key, value);
  return nextUrl.toString();
}
