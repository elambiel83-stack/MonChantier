import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { DEFAULT_ROLE, ROLE_LABELS, ROLE_MENUS, roleDashboardPath } from "@/lib/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const role = session!.user!.role || DEFAULT_ROLE;
  const menu = ROLE_MENUS[role];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 lg:flex">
      <aside className="border-b border-slate-200 bg-white p-5 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <Link href="/" className="text-sm font-semibold text-orange-600">
          MonChantier
        </Link>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
          {ROLE_LABELS[role].fr}
        </p>
        <nav className="mt-5 space-y-1">
          <Link
            href={roleDashboardPath(role)}
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
      <main className="flex-1 p-6 lg:p-10">{children}</main>
    </div>
  );
}
