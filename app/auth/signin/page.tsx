"use client";

import { FormEvent, useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";

function getCallbackUrl(value: string | null) {
  // The middleware supplies a relative path. Keep redirects on this site and
  // never send an authenticated user back to the sign-in screen.
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth/")) {
    return "/";
  }

  return value;
}

export default function SignInPage() {
  const [phone, setPhone] = useState("+243");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [enabledProviders, setEnabledProviders] = useState<Record<string, unknown>>({});
  const [callbackUrl, setCallbackUrl] = useState("/");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminTotp, setAdminTotp] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);

  useEffect(() => {
    const loadProviders = async () => {
      const providers = await getProviders();
      setEnabledProviders(providers || {});
    };

    loadProviders();

    setCallbackUrl(getCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl")));
  }, []);

  const oauthProviders = [
    { id: "google", label: "Continuer avec Google" },
    { id: "facebook", label: "Continuer avec Facebook" },
    { id: "tiktok", label: "Continuer avec TikTok" },
    { id: "apple", label: "Continuer avec Apple" },
  ].filter((provider) => Boolean(enabledProviders[provider.id]));

  const requestCode = async () => {
    setMessage("");
    const res = await fetch("/api/auth/phone/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data?.message || "Erreur OTP");
      return;
    }
    setMessage(data?.message || "Code envoyé");
  };

  const handlePhoneLogin = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneSubmitting(true);
    setMessage("");

    try {
      const result = await signIn("phone", {
        phone,
        code,
        callbackUrl,
        redirect: false,
      });

      if (!result?.ok) {
        setMessage("Échec de connexion : vérifiez votre code et réessayez.");
        return;
      }

      window.location.assign(result.url || callbackUrl);
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAdminSubmitting(true);
    setMessage("");
    try {
      const result = await signIn("admin-login", {
        email: adminEmail,
        password: adminPassword,
        totp: adminTotp,
        callbackUrl,
        redirect: false,
      });

      if (!result?.ok) {
        setMessage("Échec de connexion : email ou mot de passe incorrect.");
        return;
      }

      window.location.href = result.url || callbackUrl;
    } finally {
      setAdminSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900">Connexion</h1>
        <p className="mt-1 text-sm text-slate-600">Choisissez une méthode d’authentification.</p>

        {oauthProviders.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-2">
            {oauthProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => signIn(provider.id, { callbackUrl })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                {provider.label}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handlePhoneLogin} className="mt-5 space-y-2">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Numéro de téléphone"
          />
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code OTP"
            />
            <button
              type="button"
              onClick={requestCode}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Envoyer
            </button>
          </div>
          <button
            type="submit"
            disabled={phoneSubmitting}
            className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phoneSubmitting ? "Connexion…" : "Se connecter avec numéro"}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Administrateur</p>
          <form onSubmit={handleAdminLogin} className="mt-2 space-y-2">
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="Email administrateur"
              autoComplete="username"
            />
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
            />
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={adminTotp}
              onChange={(e) => setAdminTotp(e.target.value.replace(/\D/g, ""))}
              placeholder="Code MFA à 6 chiffres"
              autoComplete="one-time-code"
            />
            <button
              type="submit"
              disabled={adminSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {adminSubmitting ? "Connexion…" : "Se connecter comme administrateur"}
            </button>
          </form>
        </div>

        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </div>
    </main>
  );
}
