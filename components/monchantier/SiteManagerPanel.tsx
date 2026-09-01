"use client";

import { useEffect, useState } from "react";

type SiteStatus = "planning" | "active" | "paused" | "completed";
type IncidentSeverity = "low" | "medium" | "high";

type SiteTeamMember = { identity: string; name: string; role: string };
type SiteTask = { id: string; label: string; done: boolean; dueDate?: string };
type SiteIncident = { id: string; label: string; severity: IncidentSeverity; resolved: boolean };

type Site = {
  id: string;
  name: string;
  address: string;
  status: SiteStatus;
  budget?: number;
  currency?: "USD" | "CDF";
  team: SiteTeamMember[];
  tasks: SiteTask[];
  incidents: SiteIncident[];
};

const STATUS_LABELS: Record<SiteStatus, string> = {
  planning: "Planification",
  active: "Actif",
  paused: "En pause",
  completed: "Terminé",
};

const SEVERITY_LABELS: Record<IncidentSeverity, { label: string; className: string }> = {
  low: { label: "Faible", className: "bg-slate-100 text-slate-700" },
  medium: { label: "Moyenne", className: "bg-amber-100 text-amber-700" },
  high: { label: "Élevée", className: "bg-red-100 text-red-700" },
};

export default function SiteManagerPanel() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);

  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const [newTask, setNewTask] = useState("");
  const [newIncident, setNewIncident] = useState({ label: "", severity: "medium" as IncidentSeverity });
  const [newTeamMember, setNewTeamMember] = useState({ identity: "", name: "", role: "" });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sites", { cache: "no-store" });
      const data = await res.json();
      const list: Site[] = res.ok ? data.sites || [] : [];
      setSites(list);
      setSelectedSiteId((current) => current && list.some((s) => s.id === current) ? current : list[0]?.id || null);
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) || null;

  const createSite = async () => {
    if (!newSite.name.trim() || !newSite.address.trim()) return;
    try {
      setBusy(true);
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSite),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur création chantier");
      setNewSite({ name: "", address: "" });
      setBanner("Chantier créé.");
      await load();
      setSelectedSiteId(data.site?.id || null);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: SiteStatus) => {
    if (!selectedSite) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erreur mise à jour statut");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const addTeamMember = async () => {
    if (!selectedSite || !newTeamMember.identity.trim()) return;
    try {
      setBusy(true);
      const team = [...selectedSite.team, newTeamMember];
      const res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team }),
      });
      if (!res.ok) throw new Error("Erreur ajout membre");
      setNewTeamMember({ identity: "", name: "", role: "" });
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const addTask = async () => {
    if (!selectedSite || !newTask.trim()) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/sites/${selectedSite.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newTask }),
      });
      if (!res.ok) throw new Error("Erreur ajout tâche");
      setNewTask("");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const toggleTask = async (task: SiteTask) => {
    if (!selectedSite) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/sites/${selectedSite.id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) throw new Error("Erreur mise à jour tâche");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const addIncident = async () => {
    if (!selectedSite || !newIncident.label.trim()) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/sites/${selectedSite.id}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIncident),
      });
      if (!res.ok) throw new Error("Erreur ajout incident");
      setNewIncident({ label: "", severity: "medium" });
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const resolveIncident = async (incident: SiteIncident) => {
    if (!selectedSite) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/sites/${selectedSite.id}/incidents/${incident.id}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Erreur résolution incident");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Chef de chantier</h1>
      <p className="mt-1 text-slate-600">Piloter l&apos;exécution du chantier.</p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div id="chantiers" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes chantiers</h2>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={newSite.name}
            onChange={(e) => setNewSite((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nom du chantier"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newSite.address}
            onChange={(e) => setNewSite((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Adresse"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createSite}
            disabled={busy}
            className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            + Créer le chantier
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun chantier pour le moment.</p>
          ) : (
            sites.map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => setSelectedSiteId(site.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedSiteId === site.id ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white"
                }`}
              >
                <span>
                  <span className="font-medium">{site.name}</span>{" "}
                  <span className="text-xs text-slate-500">— {site.address}</span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {STATUS_LABELS[site.status]}
                </span>
              </button>
            ))
          )}
        </div>

        {selectedSite && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Statut</span>
            {(Object.keys(STATUS_LABELS) as SiteStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => changeStatus(status)}
                disabled={busy || selectedSite.status === status}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                  selectedSite.status === status
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSite && (
        <>
          <div id="taches" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Tâches — {selectedSite.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Nouvelle tâche"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addTask}
                disabled={busy}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Ajouter
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {selectedSite.tasks.length === 0 ? (
                <li className="text-sm text-slate-500">Aucune tâche.</li>
              ) : (
                selectedSite.tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <span className={`text-sm ${task.done ? "text-slate-400 line-through" : ""}`}>{task.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      {task.done ? "Marquer à faire" : "Marquer fait"}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div id="equipe" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Équipe — {selectedSite.name}</h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                value={newTeamMember.identity}
                onChange={(e) => setNewTeamMember((prev) => ({ ...prev, identity: e.target.value }))}
                placeholder="Email ou téléphone"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={newTeamMember.name}
                onChange={(e) => setNewTeamMember((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nom"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={newTeamMember.role}
                onChange={(e) => setNewTeamMember((prev) => ({ ...prev, role: e.target.value }))}
                placeholder="Rôle sur le chantier"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addTeamMember}
                disabled={busy}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Ajouter
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {selectedSite.team.length === 0 ? (
                <li className="text-sm text-slate-500">Aucun membre d&apos;équipe.</li>
              ) : (
                selectedSite.team.map((member) => (
                  <li key={member.identity} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <span className="font-medium">{member.name || member.identity}</span>{" "}
                    <span className="text-xs text-slate-500">
                      {member.role ? `— ${member.role}` : ""} · {member.identity}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div id="incidents" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Incidents — {selectedSite.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={newIncident.label}
                onChange={(e) => setNewIncident((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Décrire l'incident"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={newIncident.severity}
                onChange={(e) => setNewIncident((prev) => ({ ...prev, severity: e.target.value as IncidentSeverity }))}
                aria-label="Gravité"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Élevée</option>
              </select>
              <button
                type="button"
                onClick={addIncident}
                disabled={busy}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Signaler
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {selectedSite.incidents.length === 0 ? (
                <li className="text-sm text-slate-500">Aucun incident signalé.</li>
              ) : (
                selectedSite.incidents.map((incident) => {
                  const severity = SEVERITY_LABELS[incident.severity];
                  return (
                    <li
                      key={incident.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severity.className}`}>
                          {severity.label}
                        </span>
                        <span className={incident.resolved ? "text-slate-400 line-through" : ""}>{incident.label}</span>
                      </span>
                      {!incident.resolved && (
                        <button
                          type="button"
                          onClick={() => resolveIncident(incident)}
                          disabled={busy}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                        >
                          Résoudre
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
