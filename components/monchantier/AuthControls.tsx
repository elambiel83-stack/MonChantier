"use client";

import { FormEvent, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

interface AuthControlsProps {
  t: (fr: string, en: string) => string;
}

export function AuthControls({ t }: AuthControlsProps) {
  const { data: session, status } = useSession();
  const [panelOpen, setPanelOpen] = useState(false);
  const [phone, setPhone] = useState("+243");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/phone/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Request failed");
      setMsg(data?.message || t("Code envoyé", "Code sent"));
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : t("Erreur", "Error");
      setMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    const result = await signIn("phone", {
      phone,
      code,
      redirect: false,
    });

    if (result?.ok) {
      setMsg(t("Connexion réussie", "Login successful"));
      setCode("");
    } else {
      setMsg(t("Code invalide ou expiré", "Invalid or expired code"));
    }

    setLoading(false);
  };

  if (status === "loading") {
    return <span className="text-xs text-slate-500">…</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2 ml-2">
        <span className="hidden sm:inline text-xs text-slate-600 max-w-[120px] truncate" title={session.user.name || ""}>
          {session.user.name || t("Connecté", "Signed in")}
        </span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold"
        >
          {t("Déconnexion", "Sign out")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative ml-2">
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold"
      >
        {t("Connexion", "Sign in")}
      </button>

      {panelOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-50">
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold hover:bg-slate-50" onClick={() => signIn("google")}>
              Google
            </button>
            <button className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold hover:bg-slate-50" onClick={() => signIn("facebook")}>
              Facebook
            </button>
            <button className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold hover:bg-slate-50 col-span-2" onClick={() => signIn("tiktok")}>
              TikTok
            </button>
          </div>

          <form className="mt-3 space-y-2" onSubmit={handlePhoneSignIn}>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("Numéro (+243...)", "Phone (+243...)")}
            />
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("Code OTP", "OTP code")}
              />
              <button
                type="button"
                onClick={handleRequestCode}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                {t("Code", "Code")}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {t("Se connecter", "Sign in")}
            </button>
          </form>

          {msg ? <p className="mt-2 text-[11px] text-slate-600">{msg}</p> : null}
        </div>
      )}
    </div>
  );
}
