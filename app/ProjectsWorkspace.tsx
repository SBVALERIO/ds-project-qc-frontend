"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ProjectEvent = {
  id: string;
  documentType: string;
  title: string;
  revision: string;
  status: string;
  notes: string;
  createdByEmail: string;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  code: string;
  projectType: string;
  status: string;
  updatedAt: string;
  events: ProjectEvent[];
};

type AccessState = "loading" | "ready" | "signin" | "forbidden" | "error";

export function ProjectsWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState("");
  const [access, setAccess] = useState<AccessState>("loading");
  const [userEmail, setUserEmail] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [comparisonGenerated, setComparisonGenerated] = useState(false);
  const [compareFrom, setCompareFrom] = useState("R03");
  const [compareTo, setCompareTo] = useState("R04");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [projectForm, setProjectForm] = useState({ name: "", code: "", projectType: "Residential" });
  const [eventForm, setEventForm] = useState({ documentType: "Project Package", title: "", revision: "R00", status: "Carregado", notes: "" });

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeId) ?? projects[0],
    [projects, activeId],
  );
  const revisions = useMemo(() => Array.from(new Set(activeProject?.events.map((item) => item.revision).filter(Boolean) ?? [])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [activeProject]);

  function openComparison() {
    const previous = revisions.at(-2);
    const current = revisions.at(-1);
    if (previous && current) {
      setCompareFrom(previous);
      setCompareTo(current);
    }
    setComparisonGenerated(false);
    setShowCompare(true);
  }

  async function loadProjects() {
    setAccess("loading");
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (response.status === 401) return setAccess("signin");
      if (response.status === 403) return setAccess("forbidden");
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as { projects: Project[]; user: { email: string } };
      setProjects(data.projects);
      setUserEmail(data.user.email);
      setActiveId((current) => current || data.projects[0]?.id || "");
      setAccess("ready");
    } catch {
      setAccess("error");
    }
  }

  useEffect(() => { void loadProjects(); }, []);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!projectForm.name.trim()) return;
    setBusy(true);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(projectForm),
    });
    setBusy(false);
    if (!response.ok) return setMessage("Não foi possível criar o projeto.");
    const data = (await response.json()) as { project: Project };
    setProjects((items) => [data.project, ...items]);
    setActiveId(data.project.id);
    setProjectForm({ name: "", code: "", projectType: "Residential" });
    setShowCreate(false);
    setMessage(`Projeto ${data.project.name} criado com timeline própria.`);
  }

  async function addEvent(event: FormEvent) {
    event.preventDefault();
    if (!activeProject || !eventForm.title.trim()) return;
    setBusy(true);
    const response = await fetch("/api/project-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...eventForm, projectId: activeProject.id }),
    });
    setBusy(false);
    if (!response.ok) return setMessage("Não foi possível registrar esta etapa.");
    const data = (await response.json()) as { event: ProjectEvent };
    setProjects((items) => items.map((project) => project.id === activeProject.id
      ? { ...project, events: [data.event, ...project.events], updatedAt: data.event.createdAt }
      : project));
    setEventForm({ documentType: "Project Package", title: "", revision: "R00", status: "Carregado", notes: "" });
    setShowEvent(false);
    setMessage("Etapa adicionada à timeline do projeto.");
  }

  if (access === "loading") {
    return <div className="projects-state"><div className="loading-ring"/><strong>Carregando projetos…</strong></div>;
  }

  if (access === "signin") {
    return (
      <div className="projects-state protected-state">
        <div className="state-icon">◉</div>
        <span>ÁREA PROTEGIDA DA EQUIPE DS</span>
        <h1>Entre para acessar os projetos</h1>
        <p>A página pública de demonstração continua aberta. Projetos e timelines exigem identificação para proteger as informações da empresa.</p>
        <a className="button primary signin-button" href="/signin-with-chatgpt?return_to=%2F">Entrar com ChatGPT</a>
      </div>
    );
  }

  if (access === "forbidden") {
    return <div className="projects-state protected-state"><div className="state-icon">!</div><h1>Acesso restrito à equipe DS</h1><p>Use uma conta ChatGPT associada ao e-mail corporativo @ds-miami.com.</p></div>;
  }

  if (access === "error") {
    return <div className="projects-state protected-state"><div className="state-icon">↻</div><h1>Não foi possível carregar os projetos</h1><button className="button primary" onClick={loadProjects}>Tentar novamente</button></div>;
  }

  return (
    <>
      <div className="projects-header">
        <div><div className="eyebrow">PORTFÓLIO DE PROJETOS</div><h1>Projetos e timelines</h1><p>Um histórico contínuo de documentos, revisões, correções e aprovações.</p></div>
        <div className="projects-user"><span>Conectada como</span><strong>{userEmail}</strong></div>
        <button className="button primary" onClick={() => setShowCreate(true)}>＋ Criar projeto</button>
      </div>

      {message && <div className="project-message" role="status">✓ {message}<button onClick={() => setMessage("")}>×</button></div>}

      {projects.length === 0 ? (
        <div className="empty-projects">
          <div className="empty-folder">＋</div>
          <h2>Crie o primeiro projeto</h2>
          <p>Por exemplo: <b>Hibiscus</b>. A partir daí, todo PP, shop drawing, revisão e correção ficará registrado na mesma timeline.</p>
          <button className="button primary" onClick={() => setShowCreate(true)}>Criar projeto</button>
        </div>
      ) : (
        <div className="projects-layout">
          <aside className="project-list-panel">
            <div className="panel-label">{projects.length} PROJETO{projects.length === 1 ? "" : "S"}</div>
            <div className="project-search">⌕ <input placeholder="Buscar projeto…" aria-label="Buscar projeto" /></div>
            <div className="project-card-list">
              {projects.map((project) => (
                <button className={`project-card ${activeProject?.id === project.id ? "active" : ""}`} key={project.id} onClick={() => setActiveId(project.id)}>
                  <span className="project-avatar">{project.name.slice(0, 2).toUpperCase()}</span>
                  <span><strong>{project.name}</strong><small>{project.code || "Sem código"} · {project.projectType}</small></span>
                  <em>{project.events.length}</em>
                </button>
              ))}
            </div>
          </aside>

          {activeProject && (
            <section className="timeline-panel">
              <div className="timeline-head">
                <div><span>PROJETO ATIVO</span><h2>{activeProject.name}</h2><p>{activeProject.code || "Sem código"} · {activeProject.projectType} · {activeProject.status}</p></div>
                <div className="timeline-actions">
                  <button className="button compare-button" onClick={openComparison}>⇄ Comparar revisões</button>
                  <button className="button secondary" onClick={() => setShowEvent(true)}>＋ Adicionar à timeline</button>
                </div>
              </div>
              <div className="timeline-stats">
                <div><b>{activeProject.events.length}</b><span>registros</span></div>
                <div><b>{new Set(activeProject.events.map((item) => item.revision).filter(Boolean)).size}</b><span>revisões</span></div>
                <div><b>{activeProject.events.filter((item) => item.documentType === "Project Package").length}</b><span>project packages</span></div>
                <div><b>{activeProject.events.filter((item) => item.status === "Aprovado").length}</b><span>aprovados</span></div>
              </div>
              <div className="timeline">
                {activeProject.events.map((item) => (
                  <article className="timeline-item" key={item.id}>
                    <div className={`timeline-dot ${item.status === "Aprovado" ? "approved" : ""}`}>{item.documentType === "Project Package" ? "PP" : item.documentType.slice(0, 2).toUpperCase()}</div>
                    <div className="timeline-content">
                      <div className="timeline-meta"><span>{item.documentType}</span>{item.revision && <b>{item.revision}</b>}<em>{item.status}</em><time>{new Date(item.createdAt.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</time></div>
                      <h3>{item.title}</h3>
                      {item.notes && <p>{item.notes}</p>}
                      <small>Registrado por {item.createdByEmail}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <form className="modal project-form" onSubmit={createProject} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={() => setShowCreate(false)}>×</button>
            <span className="modal-kicker">NOVO PROJETO DS</span><h2>Criar projeto</h2><p>O projeto receberá uma timeline própria para acompanhar todo o ciclo de documentação e correções.</p>
            <label className="field-label">Nome do projeto *</label><input required value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} placeholder="Ex.: Hibiscus" autoFocus />
            <div className="form-grid"><label><span>Código</span><input value={projectForm.code} onChange={(event) => setProjectForm({ ...projectForm, code: event.target.value })} placeholder="Ex.: HIB RES" /></label><label><span>Tipo</span><select value={projectForm.projectType} onChange={(event) => setProjectForm({ ...projectForm, projectType: event.target.value })}><option>Residential</option><option>Commercial</option><option>Hospitality</option><option>Other</option></select></label></div>
            <button className="button primary full" disabled={busy || !projectForm.name.trim()}>{busy ? "Criando…" : "Criar projeto e iniciar timeline"}</button>
          </form>
        </div>
      )}

      {showEvent && activeProject && (
        <div className="modal-backdrop" onMouseDown={() => setShowEvent(false)}>
          <form className="modal project-form" onSubmit={addEvent} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={() => setShowEvent(false)}>×</button>
            <span className="modal-kicker">{activeProject.name.toUpperCase()}</span><h2>Adicionar à timeline</h2><p>Registre um documento, revisão, rodada de correções ou decisão importante do projeto.</p>
            <div className="form-grid"><label><span>Tipo de registro</span><select value={eventForm.documentType} onChange={(event) => setEventForm({ ...eventForm, documentType: event.target.value })}><option>Project Package</option><option>Shop Drawings</option><option>Material List</option><option>Budget / RFQ</option><option>Correção</option><option>Reunião / Decisão</option><option>Outro</option></select></label><label><span>Revisão</span><input value={eventForm.revision} onChange={(event) => setEventForm({ ...eventForm, revision: event.target.value })} placeholder="R00" /></label></div>
            <label className="field-label">Descrição *</label><input required value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} placeholder="Ex.: Project Package revisado carregado" />
            <label className="field-label">Status</label><select value={eventForm.status} onChange={(event) => setEventForm({ ...eventForm, status: event.target.value })}><option>Carregado</option><option>Em análise</option><option>Correções pendentes</option><option>Revisado</option><option>Aprovado</option><option>Arquivado</option></select>
            <label className="field-label">Observações</label><textarea value={eventForm.notes} onChange={(event) => setEventForm({ ...eventForm, notes: event.target.value })} placeholder="O que mudou ou precisa ser lembrado nesta etapa?" />
            <button className="button primary full" disabled={busy || !eventForm.title.trim()}>{busy ? "Salvando…" : "Adicionar à timeline"}</button>
          </form>
        </div>
      )}

      {showCompare && activeProject && (
        <div className="modal-backdrop" onMouseDown={() => setShowCompare(false)}>
          <section className="modal compare-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={() => setShowCompare(false)}>×</button>
            <span className="modal-kicker">DESIGN CHANGE REPORT · {activeProject.name.toUpperCase()}</span>
            <h2>Comparar revisões</h2>
            <p>Este report registra mudanças de design entre duas revisões. Ele é separado do relatório de erros técnicos de QC.</p>

            <div className="revision-picker">
              <label><span>REVISÃO ANTERIOR</span><select value={compareFrom} onChange={(event) => { setCompareFrom(event.target.value); setComparisonGenerated(false); }}>
                {[...new Set(["R03", ...revisions])].map((revision) => <option key={revision}>{revision}</option>)}
              </select></label>
              <div className="revision-arrow">→</div>
              <label><span>REVISÃO ATUAL</span><select value={compareTo} onChange={(event) => { setCompareTo(event.target.value); setComparisonGenerated(false); }}>
                {[...new Set(["R04", ...revisions])].map((revision) => <option key={revision}>{revision}</option>)}
              </select></label>
              <button className="button primary" disabled={compareFrom === compareTo} onClick={() => setComparisonGenerated(true)}>Gerar report de mudanças</button>
            </div>

            {revisions.length < 2 && <div className="compare-prerequisite"><b>Para a comparação automática real:</b> carregue e registre pelo menos duas revisões do Project Package na timeline deste projeto.</div>}

            {comparisonGenerated && (
              <div className="design-report-preview">
                <div className="design-report-head">
                  <div><span>MODELO DO REPORT FUTURO</span><strong>{compareFrom} → {compareTo}</strong></div>
                  <div className="design-change-count"><b>1</b><span>mudança de design demonstrada</span></div>
                </div>
                <div className="design-vs-qc"><b>Mudança de design ≠ erro.</b> O item abaixo mostra o formato que será produzido quando a leitura automática dos PDFs estiver conectada.</div>
                <div className="design-change-table">
                  <div className="design-change-row header"><span>CATEGORIA</span><span>AMBIENTE</span><span>{compareFrom}</span><span>{compareTo}</span><span>QUANTIDADE</span></div>
                  <div className="design-change-row"><strong>Wall Treatment</strong><span>Gym</span><span className="before-value">Wallpaper</span><span className="after-value">Limewash</span><b>245 SQFT</b></div>
                </div>
                <div className="future-report-fields">
                  <span>✓ Localização/prancha</span><span>✓ Antes e depois</span><span>✓ Área ou quantidade</span><span>✓ Confiança da leitura</span><span>✓ Impacto na Material List</span>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
