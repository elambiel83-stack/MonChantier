"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AppRole, ROLE_LABELS, ROLE_MENUS, isAppRole, roleDashboardPath } from "@/lib/roles";

export default function DashboardSidebar({ sessionRole }: { sessionRole: AppRole }) {
  const pathname = usePathname();
  // /dashboard/<role>/... — la page consultée peut différer du rôle de la
  // session quand un admin prévisualise un autre rôle. La barre latérale
  // suit alors la page affichée plutôt que la session.
  const segment = pathname?.split("/")[2];
  const displayRole: AppRole = isAppRole(segment) ? segment : sessionRole;
  const menu = ROLE_MENUS[displayRole];

  return (
    <aside className="border-b border-slate-200 bg-white p-5 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
      <Link href="/" className="text-sm font-semibold text-orange-600">
        MonChantier
      </Link>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
        {ROLE_LABELS[displayRole].fr}
      </p>
      <nav className="mt-5 space-y-1">
        <Link
          href={roleDashboardPath(displayRole)}
          className="block rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Tableau de bord
        </Link>
        {menu.map((item) => (
          <span
            key={item.fr}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400"
            title="Bientôt disponible"
          >
            {item.fr}
            <span className="text-[10px] uppercase text-slate-300">bientôt</span>
          </span>
        ))}
      </nav>
    </aside>
  );
}
