"use client";

import { useEffect, useMemo, useState } from "react";

type SiteStatus = "planning" | "active" | "paused" | "completed";
type IncidentSeverity = "low" | "medium" | "high";

type SiteTeamMember = { identity: string; name: string; role: string };
type SiteTask = { id: string; label: string; done: boolean; dueDate?: string; createdAt?: string };
type SiteIncident = { id: string; label: string; severity: IncidentSeverity; resolved: boolean; createdAt?: string };
type SiteMaterial = { id: string; name: string; unit: string; quantity: number; note?: string; updatedAt?: string };
type SiteDocument = { id: string; name: string; url: string; category: string; createdAt?: string };
type SitePhoto = { id: string; name: string; url: string; createdAt?: string };

type Site = {
  id: string;
  name: string;
  address: string;
  status: SiteStatus;
  budget?: number;
  currency?: "USD" | "CDF";
  createdAt?: string;
  updatedAt?: string;
  team: SiteTeamMember[];
  tasks: SiteTask[];
  incidents: SiteIncident[];
  materials: SiteMaterial[];
  documents: SiteDocument[];
  photos: SitePhoto[];
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

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function SiteManagerPanel() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const [newTask, setNewTask] = useState("");
  const [newIncident, setNewIncident] = useState({ label: "", severity: "medium" as IncidentSeverity });
  const [newTeamMember, setNewTeamMember] = useState({ identity: "", name: "", role: "" });
  const [newMaterial, setNewMaterial] = useState({ name: "", unit: "unité", quantity: "", note: "" });
  const [newDocument, setNewDocument] = useState({ name: "", url: "", category: "plan" });
  const [newPhoto, setNewPhoto] = useState({ name: "", url: "" });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sites", { cache: "no-store" });
      const data = await res.json();
      const list: Site[] = res.ok ? data.sites || [] : [];
      setSites(list);
      setSelectedSiteId((current) => (current && list.some((s) => s.id === current) ? current : list[0]?.id || null));
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
      setBanner({ type: "success", message: "Chantier créé." });
      await load();
      setSelectedSiteId(data.site?.id || null);
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
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
      setBanner({ type: "success", message: "Statut du chantier mis à jour." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
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
      setBanner({ type: "success", message: "Membre ajouté à l'équipe." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
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
      setBanner({ type: "success", message: "Tâche ajoutée." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
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
      setBanner({ type: "success", message: task.done ? "Tâche rouverte." : "Tâche clôturée." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
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
      setBanner({ type: "success", message: "Incident signalé." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
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
      setBanner({ type: "success", message: "Incident résolu." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  const addMaterial = async () => {
    if (!selectedSite || !newMaterial.name.trim()) return;
    const quantity = Number(newMaterial.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setBanner({ type: "error", message: "Quantité invalide." });
      return;
    }
    try {
      setBusy(true);
      const materials = [
        ...(selectedSite.materials || []),
        {
          id: `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: newMaterial.name.trim(),
          unit: newMaterial.unit.trim() || "unité",
          quantity,
          note: newMaterial.note.trim() || undefined,
          updatedAt: new Date().toISOString(),
        },
      ];
      const res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materials }),
      });
      if (!res.ok) throw new Error("Erreur ajout matériau");
      setNewMaterial({ name: "", unit: "unité", quantity: "", note: "" });
      setBanner({ type: "success", message: "Matériau ajouté." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  const addDocument = async () => {
    if (!selectedSite || !newDocument.name.trim() || !newDocument.url.trim()) return;
    try {
      setBusy(true);
      const documents = [
        ...(selectedSite.documents || []),
        {
          id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: newDocument.name.trim(),
          url: newDocument.url.trim(),
          category: newDocument.category.trim() || "document",
          createdAt: new Date().toISOString(),
        },
      ];
      const res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      });
      if (!res.ok) throw new Error("Erreur ajout document");
      setNewDocument({ name: "", url: "", category: "plan" });
      setBanner({ type: "success", message: "Document ajouté." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = async () => {
    if (!selectedSite || !newPhoto.name.trim() || !newPhoto.url.trim()) return;
    try {
      setBusy(true);
      const photos = [
        ...(selectedSite.photos || []),
        {
          id: `PHT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: newPhoto.name.trim(),
          url: newPhoto.url.trim(),
          createdAt: new Date().toISOString(),
        },
      ];
      const res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      });
      if (!res.ok) throw new Error("Erreur ajout photo");
      setNewPhoto({ name: "", url: "" });
      setBanner({ type: "success", message: "Photo ajoutée." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    const activeSites = sites.filter((site) => site.status === "active").length;
    const taskCount = sites.reduce((sum, site) => sum + site.tasks.length, 0);
    const doneTasks = sites.reduce((sum, site) => sum + site.tasks.filter((task) => task.done).length, 0);
    const openIncidents = sites.reduce(
      (sum, site) => sum + site.incidents.filter((incident) => !incident.resolved).length,
      0
    );
    const budgetSites = sites.filter((site) => typeof site.budget === "number");
    return {
      siteCount: sites.length,
      activeSites,
      taskCount,
      doneTasks,
      openIncidents,
      trackedBudget: budgetSites.length,
    };
  }, [sites]);

  const bannerClassName =
    banner?.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className="space-y-6">
      <div id="chantiers">
        <h1 className="text-2xl font-bold tracking-tight">Chef de chantier</h1>
        <p className="mt-1 text-slate-600">Piloter l&apos;exécution du chantier.</p>

        {banner && <div className={`mt-3 rounded-lg border p-3 text-sm ${bannerClassName}`}>{banner.message}</div>}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Chantiers", stats.siteCount],
            ["Actifs", stats.activeSites],
            ["Tâches", stats.taskCount],
            ["Terminées", stats.doneTasks],
            ["Incidents ouverts", stats.openIncidents],
            ["Budgets suivis", stats.trackedBudget],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Créer un chantier</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input value={newSite.name} onChange={(e) => setNewSite((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nom du chantier" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newSite.address} onChange={(e) => setNewSite((prev) => ({ ...prev, address: e.target.value }))} placeholder="Adresse" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" onClick={createSite} disabled={busy} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60">
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
                <button key={site.id} type="button" onClick={() => setSelectedSiteId(site.id)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${selectedSiteId === site.id ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white"}`}>
                  <span>
                    <span className="font-medium">{site.name}</span>{" "}
                    <span className="text-xs text-slate-500">— {site.address}</span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{STATUS_LABELS[site.status]}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedSite && (
        <>
          <div id="planning" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Planning — {selectedSite.name}</h2>
            <p className="mt-2 text-sm text-slate-600">Créé le {formatDate(selectedSite.createdAt)} · Mis à jour le {formatDate(selectedSite.updatedAt)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as SiteStatus[]).map((status) => (
                <button key={status} type="button" onClick={() => changeStatus(status)} disabled={busy || selectedSite.status === status} className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${selectedSite.status === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          <div id="depenses" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Dépenses & budget</h2>
            {typeof selectedSite.budget === "number" ? (
              <p className="mt-3 text-sm text-slate-700">{selectedSite.budget.toLocaleString("fr-FR")} {selectedSite.currency || "USD"}</p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Aucun budget saisi pour ce chantier.</p>
            )}
          </div>

          <div id="taches" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Tâches — {selectedSite.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Nouvelle tâche" className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={addTask} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
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
                    <button type="button" onClick={() => toggleTask(task)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60">
                      {task.done ? "Marquer à faire" : "Marquer fait"}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div id="equipe" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Équipe — {selectedSite.name}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <input value={newTeamMember.identity} onChange={(e) => setNewTeamMember((prev) => ({ ...prev, identity: e.target.value }))} placeholder="Email ou téléphone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={newTeamMember.name} onChange={(e) => setNewTeamMember((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nom" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={newTeamMember.role} onChange={(e) => setNewTeamMember((prev) => ({ ...prev, role: e.target.value }))} placeholder="Rôle sur le chantier" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={addTeamMember} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
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
                    <span className="text-xs text-slate-500">{member.role ? `— ${member.role}` : ""} · {member.identity}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div id="incidents" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Incidents — {selectedSite.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <input value={newIncident.label} onChange={(e) => setNewIncident((prev) => ({ ...prev, label: e.target.value }))} placeholder="Décrire l'incident" className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={newIncident.severity} onChange={(e) => setNewIncident((prev) => ({ ...prev, severity: e.target.value as IncidentSeverity }))} aria-label="Gravité" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Élevée</option>
              </select>
              <button type="button" onClick={addIncident} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
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
                    <li key={incident.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                      <span className="flex items-center gap-2 text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severity.className}`}>{severity.label}</span>
                        <span className={incident.resolved ? "text-slate-400 line-through" : ""}>{incident.label}</span>
                      </span>
                      {!incident.resolved && (
                        <button type="button" onClick={() => resolveIncident(incident)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60">
                          Résoudre
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div id="materiaux" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Matériaux</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input value={newMaterial.name} onChange={(e) => setNewMaterial((prev) => ({ ...prev, name: e.target.value }))} placeholder="Matériau" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={newMaterial.unit} onChange={(e) => setNewMaterial((prev) => ({ ...prev, unit: e.target.value }))} placeholder="Unité" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="number" value={newMaterial.quantity} onChange={(e) => setNewMaterial((prev) => ({ ...prev, quantity: e.target.value }))} placeholder="Quantité" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={addMaterial} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                Ajouter
              </button>
            </div>
            <input value={newMaterial.note} onChange={(e) => setNewMaterial((prev) => ({ ...prev, note: e.target.value }))} placeholder="Note optionnelle" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="mt-4 space-y-3">
              {selectedSite.materials.length ? selectedSite.materials.map((material) => (
                <div key={material.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-medium text-slate-900">{material.name}</p>
                  <p className="mt-1 text-slate-600">{material.quantity} {material.unit}</p>
                  {material.note && <p className="mt-1 text-xs text-slate-400">{material.note}</p>}
                </div>
              )) : <p className="mt-3 text-sm text-slate-500">Aucun matériau enregistré.</p>}
            </div>
          </div>

          <div id="commandes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Commandes</h2>
            <p className="mt-3 text-sm text-slate-500">Les commandes fournisseurs ne sont pas encore rattachées directement aux chantiers.</p>
          </div>

          <div id="livraisons" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Livraisons</h2>
            <p className="mt-3 text-sm text-slate-500">Le store de livraison actuel n&apos;associe pas encore les tournées à un chantier précis.</p>
          </div>

          <div id="rapports" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Rapports</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <p className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">{selectedSite.tasks.filter((task) => task.done).length}/{selectedSite.tasks.length} tâche(s) terminée(s).</p>
              <p className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">{selectedSite.team.length} membre(s) affecté(s).</p>
              <p className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">{selectedSite.incidents.filter((incident) => !incident.resolved).length} incident(s) ouvert(s).</p>
            </div>
          </div>

          <div id="documents" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Documents</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input value={newDocument.name} onChange={(e) => setNewDocument((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nom du document" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={newDocument.url} onChange={(e) => setNewDocument((prev) => ({ ...prev, url: e.target.value }))} placeholder="URL / chemin" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={newDocument.category} onChange={(e) => setNewDocument((prev) => ({ ...prev, category: e.target.value }))} placeholder="Catégorie" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={addDocument} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                Ajouter
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {selectedSite.documents.length ? selectedSite.documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-medium text-slate-900">{document.name}</p>
                  <p className="mt-1 text-slate-600">{document.category}</p>
                  <p className="mt-1 text-xs text-slate-400">{document.url}</p>
                </div>
              )) : <p className="mt-3 text-sm text-slate-500">Aucun document enregistré.</p>}
            </div>
          </div>

          <div id="photos" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Photos</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input value={newPhoto.name} onChange={(e) => setNewPhoto((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nom de la photo" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={newPhoto.url} onChange={(e) => setNewPhoto((prev) => ({ ...prev, url: e.target.value }))} placeholder="URL / chemin" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={addPhoto} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                Ajouter
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {selectedSite.photos.length ? selectedSite.photos.map((photo) => (
                <div key={photo.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-medium text-slate-900">{photo.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{photo.url}</p>
                </div>
              )) : <p className="mt-3 text-sm text-slate-500">Aucune photo enregistrée.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
