import { AppRole, ROLE_LABELS, ROLE_MENUS, ROLE_OBJECTIVES } from "@/lib/roles";

export default function RoleComingSoon({ role, note }: { role: AppRole; note?: string }) {
  return (
    <div className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b46b17]">MonChantier</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1b3027]">{ROLE_LABELS[role].fr}</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{ROLE_OBJECTIVES[role].fr}</p>

      <div className="mt-8 border border-[#d9e2da] border-l-4 border-l-[#e6a748] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-[#1b3027]">
          Ce tableau de bord est en cours de construction.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Modules prévus : {ROLE_MENUS[role].map((item) => item.fr).join(", ")}.
        </p>
        {note && <p className="mt-3 text-sm text-slate-500">{note}</p>}
      </div>
    </div>
  );
}
