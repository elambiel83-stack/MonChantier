"use client";

import { signOut, useSession } from "next-auth/react";

export function GlobalSignOutButton() {
  const { status } = useSession();

  if (status !== "authenticated") return null;

  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="liquid-control fixed bottom-4 right-4 z-[60] rounded-md border border-[#b85c19] bg-white px-4 py-2.5 text-sm font-semibold text-[#9a4911] shadow-lg hover:bg-[#fff4eb] focus:outline-none focus:ring-2 focus:ring-[#e6a748] focus:ring-offset-2"
    >
      Se déconnecter
    </button>
  );
}