import { AppRole, ROLE_LABELS, ROLE_MENUS, ROLE_OBJECTIVES } from "@/lib/roles";

export default function RoleComingSoon({ role, note }: { role: AppRole; note?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{ROLE_LABELS[role].fr}</h1>
      <p className="mt-1 text-slate-600">{ROLE_OBJECTIVES[role].fr}</p>

      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6">
        <p className="text-sm font-medium text-slate-700">
          Ce tableau de bord est en cours de construction.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Modules prévus : {ROLE_MENUS[role].map((item) => item.fr).join(", ")}.
        </p>
        {note && <p className="mt-3 text-sm text-slate-500">{note}</p>}
      </div>
    </div>
  );
}
