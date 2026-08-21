"use client";

import { useEffect, useMemo, useState } from "react";

type Finding = {
  id: number;
  title: string;
  sheet: string;
  confidence: "Alta" | "Média" | "Menor";
  evidence: "Schedule" | "Visual" | "Cross-check";
  summary?: string;
  expected?: string;
};

type TaskStatusRow = {
  findingId: number;
  status: "Pendente" | "Corrigido" | "Irrelevante";
  reason: string;
};

type ProjectEvent = {
  id: string;
  documentType: string;
  title: string;
  revision: string;
  findingsSummary: string;
  findingsJson: string;
  createdAt: string;
  taskStatuses: TaskStatusRow[];
};

type Project = {
  id: string;
  name: string;
  code: string;
  events: ProjectEvent[];
};

type Access = "loading" | "ready" | "error";

function parseFindings(findingsJson: string): Finding[] {
  try {
    const parsed = JSON.parse(findingsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findStatus(event: ProjectEvent, findingId: number): TaskStatusRow {
  return event.taskStatuses.find((row) => row.findingId === findingId) ?? { findingId, status: "Pendente", reason: "" };
}

function openTaskCount(project: Project): number {
  return project.events.reduce((total, event) => {
    const findings = parseFindings(event.findingsJson);
    return total + findings.filter((finding) => findStatus(event, finding.id).status === "Pendente").length;
  }, 0);
}

export function TasksWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState("");
  const [access, setAccess] = useState<Access>("loading");
  const [reasonDraftKey, setReasonDraftKey] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [message, setMessage] = useState("");

  async function loadProjects() {
    setAccess("loading");
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as { projects: Project[] };
      setProjects(data.projects);
      setActiveId((current) => current || data.projects[0]?.id || "");
      setAccess("ready");
    } catch {
      setAccess("error");
    }
  }

  useEffect(() => { void loadProjects(); }, []);

  const activeProject = useMemo(() => projects.find((project) => project.id === activeId), [projects, activeId]);

  const tasksByEvent = useMemo(() => {
    if (!activeProject) return [];
    return activeProject.events
      .map((event) => ({ event, findings: parseFindings(event.findingsJson) }))
      .filter((group) => group.findings.length > 0);
  }, [activeProject]);

  const totalOpenTasks = useMemo(() => tasksByEvent.reduce((total, group) => {
    return total + group.findings.filter((finding) => findStatus(group.event, finding.id).status === "Pendente").length;
  }, 0), [tasksByEvent]);

  async function setTaskStatus(eventId: string, findingId: number, status: TaskStatusRow["status"], reason: string) {
    const response = await fetch("/api/task-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, findingId, status, reason }),
    });
    if (!response.ok) {
      setMessage("Não foi possível salvar essa flag.");
      return;
    }
    setProjects((items) => items.map((project) => ({
      ...project,
      events: project.events.map((event) => {
        if (event.id !== eventId) return event;
        const rest = event.taskStatuses.filter((row) => row.findingId !== findingId);
        return { ...event, taskStatuses: [...rest, { findingId, status, reason }] };
      }),
    })));
  }

  function toggleCorrigido(eventId: string, finding: Finding, current: TaskStatusRow) {
    void setTaskStatus(eventId, finding.id, current.status === "Corrigido" ? "Pendente" : "Corrigido", "");
  }

  function openIrrelevanteDraft(eventId: string, findingId: number, existingReason: string) {
    setReasonDraftKey(`${eventId}:${findingId}`);
    setReasonDraft(existingReason);
  }

  function cancelIrrelevanteDraft() {
    setReasonDraftKey("");
    setReasonDraft("");
  }

  async function confirmIrrelevante(eventId: string, findingId: number) {
    if (!reasonDraft.trim()) return;
    await setTaskStatus(eventId, findingId, "Irrelevante", reasonDraft.trim());
    cancelIrrelevanteDraft();
  }

  async function copyIrrelevantes() {
    if (!activeProject) return;
    let out = `# Achados marcados como irrelevantes — ${activeProject.name}\n\n`;
    let any = false;
    for (const { event, findings } of tasksByEvent) {
      const irrelevant = findings
        .map((finding) => ({ finding, taskStatus: findStatus(event, finding.id) }))
        .filter(({ taskStatus }) => taskStatus.status === "Irrelevante");
      if (irrelevant.length === 0) continue;
      any = true;
      out += `## ${event.title}${event.revision ? ` (${event.revision})` : ""}\n`;
      for (const { finding, taskStatus } of irrelevant) {
        out += `- ${finding.title} — ${finding.sheet}\n  Motivo: ${taskStatus.reason}\n`;
      }
      out += "\n";
    }
    if (!any) {
      setMessage("Nenhum achado marcado como irrelevante ainda.");
      return;
    }
    try {
      await navigator.clipboard.writeText(out);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = out;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setMessage("Copiado. Cola aqui na conversa pra eu revisar as regras.");
  }

  if (access === "loading") {
    return <div className="projects-state"><div className="loading-ring" /><strong>Carregando tasks…</strong></div>;
  }

  if (access === "error") {
    return <div className="projects-state protected-state"><div className="state-icon">↻</div><h1>Não foi possível carregar as tasks</h1><button className="button primary" onClick={loadProjects}>Tentar novamente</button></div>;
  }

  return (
    <>
      <div className="projects-header">
        <div><div className="eyebrow">TASKS POR PROJETO</div><h1>O que falta resolver</h1><p>Escolha um projeto pra ver os achados de QC das correções carregadas na timeline dele.</p></div>
        {activeProject && <button className="button" onClick={copyIrrelevantes}>⇪ Copiar irrelevantes</button>}
      </div>

      {message && <div className="project-message" role="status">✓ {message}<button onClick={() => setMessage("")}>×</button></div>}

      {projects.length === 0 ? (
        <div className="empty-projects">
          <div className="empty-folder">▤</div>
          <h2>Nenhum projeto ainda</h2>
          <p>Crie um projeto na aba <b>Projetos</b> e carregue um Project Package na timeline pra ver as tasks aqui.</p>
        </div>
      ) : (
        <div className="projects-layout">
          <aside className="project-list-panel">
            <div className="panel-label">{projects.length} PROJETO{projects.length === 1 ? "" : "S"}</div>
            <div className="project-card-list">
              {projects.map((project) => {
                const count = openTaskCount(project);
                return (
                  <button className={`project-card ${activeProject?.id === project.id ? "active" : ""}`} key={project.id} onClick={() => setActiveId(project.id)}>
                    <span className="project-avatar">{project.name.slice(0, 2).toUpperCase()}</span>
                    <span><strong>{project.name}</strong><small>{project.code || "Sem código"}</small></span>
                    <em>{count}</em>
                  </button>
                );
              })}
            </div>
          </aside>

          {activeProject && (
            <section className="timeline-panel">
              <div className="timeline-head">
                <div><span>PROJETO ATIVO</span><h2>{activeProject.name}</h2><p>{totalOpenTasks} task{totalOpenTasks === 1 ? "" : "s"} pendente{totalOpenTasks === 1 ? "" : "s"}</p></div>
              </div>

              {tasksByEvent.length === 0 ? (
                <div className="empty-projects">
                  <div className="empty-folder">✓</div>
                  <h2>Nenhuma task registrada</h2>
                  <p>Nenhum upload na timeline deste projeto gerou achados de QC ainda.</p>
                </div>
              ) : (
                <div className="task-groups">
                  {tasksByEvent.map(({ event, findings }) => (
                    <div className="task-group" key={event.id}>
                      <div className="task-group-head">
                        <strong>{event.title}</strong>
                        {event.revision && <b className="revision-badge">{event.revision}</b>}
                        <time>{new Date(event.createdAt.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</time>
                      </div>
                      <ul className="task-rows">
                        {findings.map((finding) => {
                          const taskStatus = findStatus(event, finding.id);
                          const draftKey = `${event.id}:${finding.id}`;
                          const isDrafting = reasonDraftKey === draftKey;
                          return (
                            <li key={finding.id} className={`task-row status-${taskStatus.status.toLowerCase()}`}>
                              <div className="task-row-main">
                                <span className={`finding-mini-badge ${finding.confidence === "Alta" ? "high" : finding.confidence === "Média" ? "medium" : ""}`}>{finding.confidence}</span>
                                <span className="finding-mini-title">{finding.title}</span>
                                <span className="finding-mini-sheet">{finding.sheet}</span>
                                <div className="task-row-actions">
                                  <button
                                    type="button"
                                    className={`task-flag ${taskStatus.status === "Corrigido" ? "active" : ""}`}
                                    onClick={() => toggleCorrigido(event.id, finding, taskStatus)}
                                  >
                                    ✓ Corrigido
                                  </button>
                                  <button
                                    type="button"
                                    className={`task-flag irrelevant ${taskStatus.status === "Irrelevante" ? "active" : ""}`}
                                    onClick={() => openIrrelevanteDraft(event.id, finding.id, taskStatus.reason)}
                                  >
                                    ⚑ Irrelevante
                                  </button>
                                </div>
                              </div>
                              {taskStatus.status === "Irrelevante" && !isDrafting && (
                                <div className="task-reason">
                                  <b>Motivo:</b> {taskStatus.reason}
                                  <button type="button" onClick={() => openIrrelevanteDraft(event.id, finding.id, taskStatus.reason)}>editar</button>
                                </div>
                              )}
                              {isDrafting && (
                                <div className="task-reason-draft">
                                  <textarea
                                    autoFocus
                                    value={reasonDraft}
                                    onChange={(e) => setReasonDraft(e.target.value)}
                                    placeholder="Por que esse achado é irrelevante aqui? (obrigatório — vira aprendizado pra ajustar a regra)"
                                  />
                                  <div className="task-reason-draft-actions">
                                    <button type="button" onClick={cancelIrrelevanteDraft}>Cancelar</button>
                                    <button type="button" className="button primary" disabled={!reasonDraft.trim()} onClick={() => confirmIrrelevante(event.id, finding.id)}>Salvar</button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
