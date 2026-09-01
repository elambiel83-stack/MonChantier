"use client";

import Image from "next/image";
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
    <aside className="border-b border-[#284137] bg-[#142a22] px-4 py-5 text-white lg:min-h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-lg border border-white/15 bg-white px-3 py-2.5 shadow-sm transition hover:border-[#e6a748]"
        aria-label="Retour à l'accueil MonChantier"
      >
        <Image
          src="/images/brand/monchantier-logo.svg"
          alt="MonChantier"
          width={148}
          height={52}
          className="h-9 w-full object-contain object-left"
          priority
        />
      </Link>
      <div className="mt-7 border-b border-white/10 pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#eab65f]">Espace de travail</p>
        <p className="mt-1 text-lg font-semibold text-white">
          {ROLE_LABELS[displayRole].fr}
        </p>
      </div>
      <nav className="mt-5 space-y-1.5" aria-label="Navigation du tableau de bord">
        <Link
          href={roleDashboardPath(displayRole)}
          className="liquid-control block rounded-md bg-[#e6a748] px-3 py-2.5 text-sm font-semibold text-[#17261f] shadow-sm transition hover:bg-[#f0bd63]"
        >
          Tableau de bord
        </Link>
        {menu.map((item) =>
          item.anchor ? (
            <Link
              key={item.fr}
              href={`${roleDashboardPath(displayRole)}#${item.anchor}`}
              className="block rounded-md px-3 py-2.5 text-sm text-[#e8f0eb] transition hover:bg-white/10"
            >
              {item.fr}
            </Link>
          ) : (
            <span
              key={item.fr}
              className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-[#bdd0c5]"
              title="Bientôt disponible"
            >
              {item.fr}
              <span className="text-[10px] font-medium uppercase tracking-wide text-[#789187]">bientôt</span>
            </span>
          )
        )}
      </nav>
      <p className="mt-8 hidden border-t border-white/10 pt-4 text-xs leading-5 text-[#8fa69c] lg:block">
        Gérez vos activités et suivez vos opérations depuis un seul espace.
      </p>
    </aside>
  );
}
