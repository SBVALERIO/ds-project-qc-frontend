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

type ProjectEvent = {
  id: string;
  documentType: string;
  title: string;
  revision: string;
  findingsSummary: string;
  findingsJson: string;
  createdAt: string;
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

function projectTaskCount(project: Project): number {
  return project.events.reduce((total, event) => total + parseFindings(event.findingsJson).length, 0);
}

export function TasksWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState("");
  const [access, setAccess] = useState<Access>("loading");

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  const activeProject = useMemo(() => projects.find((project) => project.id === activeId), [projects, activeId]);

  const tasksByEvent = useMemo(() => {
    if (!activeProject) return [];
    return activeProject.events
      .map((event) => ({ event, findings: parseFindings(event.findingsJson) }))
      .filter((group) => group.findings.length > 0);
  }, [activeProject]);

  const totalTasks = useMemo(() => tasksByEvent.reduce((total, group) => total + group.findings.length, 0), [tasksByEvent]);

  if (access === "loading") {
    return <div className="projects-state"><div className="loading-ring" /><strong>Carregando tasks…</strong></div>;
  }

  if (access === "error") {
    return <div className="projects-state protected-state"><div className="state-icon">↻</div><h1>Não foi possível carregar as tasks</h1></div>;
  }

  return (
    <>
      <div className="projects-header">
        <div><div className="eyebrow">TASKS POR PROJETO</div><h1>O que falta resolver</h1><p>Escolha um projeto pra ver os achados de QC das correções carregadas na timeline dele.</p></div>
      </div>

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
                const count = projectTaskCount(project);
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
                <div><span>PROJETO ATIVO</span><h2>{activeProject.name}</h2><p>{totalTasks} task{totalTasks === 1 ? "" : "s"} em aberto</p></div>
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
                      <ul className="timeline-findings-list task-list">
                        {findings.map((finding) => (
                          <li key={finding.id}>
                            <span className={`finding-mini-badge ${finding.confidence === "Alta" ? "high" : finding.confidence === "Média" ? "medium" : ""}`}>{finding.confidence}</span>
                            <span className="finding-mini-title">{finding.title}</span>
                            <span className="finding-mini-sheet">{finding.sheet}</span>
                          </li>
                        ))}
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
