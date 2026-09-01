"use client";

import { useEffect, useState } from "react";

type ProjectStatus = "planning" | "in_progress" | "completed";
type ClientProject = { id: string; name: string; address?: string; notes?: string; status: ProjectStatus };

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planification",
  in_progress: "En cours",
  completed: "Terminé",
};

export default function ProjectsPanel() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ name: "", address: "" });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/client/projects", { cache: "no-store" });
      const data = await res.json();
      setProjects(res.ok ? data.projects || [] : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createProject = async () => {
    if (!newProject.name.trim()) return;
    try {
      setSaving(true);
      const res = await fetch("/api/client/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      setNewProject({ name: "", address: "" });
      setProjects(data.projects || []);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (project: ClientProject, status: ProjectStatus) => {
    try {
      setBusy(project.id);
      const res = await fetch(`/api/client/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) setProjects(data.projects || []);
    } finally {
      setBusy(null);
    }
  };

  const removeProject = async (id: string) => {
    try {
      setBusy(id);
      const res = await fetch(`/api/client/projects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) setProjects(data.projects || []);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div id="projets" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mes projets</h2>
      <p className="mt-1 text-sm text-slate-500">
        Regroupez vos commandes et devis par projet de construction (ex: &quot;Maison Kinshasa&quot;).
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          value={newProject.name}
          onChange={(e) => setNewProject((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nom du projet"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={newProject.address}
          onChange={(e) => setNewProject((prev) => ({ ...prev, address: e.target.value }))}
          placeholder="Adresse (optionnel)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={createProject}
          disabled={saving}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "+ Créer le projet"}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-slate-500">Chargement…</li>
        ) : projects.length === 0 ? (
          <li className="text-sm text-slate-500">Aucun projet pour le moment.</li>
        ) : (
          projects.map((project) => (
            <li key={project.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {project.name}
                  {project.address && <span className="text-xs text-slate-500"> — {project.address}</span>}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {STATUS_LABELS[project.status]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(STATUS_LABELS) as ProjectStatus[])
                  .filter((status) => status !== project.status)
                  .map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => changeStatus(project, status)}
                      disabled={busy === project.id}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => removeProject(project.id)}
                  disabled={busy === project.id}
                  className="rounded-lg border border-red-300 bg-white text-red-600 px-2 py-1 text-xs font-medium disabled:opacity-60"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
