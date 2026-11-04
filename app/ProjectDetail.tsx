"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TasksWorkspace } from "./TasksWorkspace";
import { uploadPdfSheets } from "./pdf-sheets";

export const PROJECT_TABS = ["Pranchas", "Comparações", "Tasks", "Schedules", "Revisões"] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

type Finding = {
  id: number;
  title: string;
  sheet: string;
  confidence: "Alta" | "Média" | "Menor";
  evidence: string;
  summary?: string;
  expected?: string;
  locations?: string[];
  codeReference?: string | null;
  page?: number | null;
  bbox?: number[] | null;
};
type TaskStatusRow = { findingId: number; status: "Pendente" | "Corrigido" | "Irrelevante"; reason: string };
type ProjectEvent = {
  id: string;
  documentType: string;
  title: string;
  revision: string;
  status: string;
  notes: string;
  findingsSummary: string;
  findingsJson: string;
  createdAt: string;
  taskStatuses: TaskStatusRow[];
};
type Project = { id: string; name: string; code: string; projectType: string; events: ProjectEvent[] };
type Sheet = { id: string; eventId: string; pageNumber: number; label: string; width: number; height: number };

function parseFindings(json: string): Finding[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function statusOf(event: ProjectEvent, findingId: number): TaskStatusRow {
  return event.taskStatuses?.find((row) => row.findingId === findingId) ?? { findingId, status: "Pendente", reason: "" };
}

function eventDate(value: string) {
  return new Date(value.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function norm(text: string) {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// A finding belongs to a sheet if it carries that page number, or if its
// "sheet" text names the sheet's number (e.g. "I-109.A — Circuits 2nd Floor").
function findingsForSheet(findings: Finding[], sheet: Sheet): Finding[] {
  const label = norm(sheet.label);
  return findings.filter((finding) => {
    if (finding.page) return finding.page === sheet.pageNumber;
    if (!label) return false;
    const names = finding.sheet.split(/·|,|\//).map((part) => norm(part.split("—")[0]));
    return names.some((name) => name === label);
  });
}

const confidenceClass = (c: string) => (c === "Alta" ? "high" : c === "Média" ? "medium" : "low");

export function ProjectDetail({ projectId, tab, onOpenCount }: { projectId: string; tab: ProjectTab; onOpenCount?: (count: number) => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [projectsResponse, sheetsResponse] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch(`/api/sheets?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
      ]);
      if (!projectsResponse.ok) throw new Error("load failed");
      const data = (await projectsResponse.json()) as { projects: Project[] };
      setProject(data.projects.find((item) => item.id === projectId) ?? null);
      if (sheetsResponse.ok) setSheets(((await sheetsResponse.json()) as { sheets: Sheet[] }).sheets);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  const reviewEvents = useMemo(
    () => (project?.events ?? []).filter((event) => parseFindings(event.findingsJson).length > 0 || sheets.some((sheet) => sheet.eventId === event.id)),
    [project, sheets],
  );

  const openCount = useMemo(() => {
    if (!project) return 0;
    return project.events.reduce((total, event) => total + parseFindings(event.findingsJson).filter((f) => statusOf(event, f.id).status === "Pendente").length, 0);
  }, [project]);
  useEffect(() => { onOpenCount?.(openCount); }, [openCount, onOpenCount]);

  async function setTaskStatus(event: ProjectEvent, findingId: number, status: TaskStatusRow["status"], reason: string) {
    const response = await fetch("/api/task-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: event.id, findingId, status, reason }),
    });
    if (!response.ok) return setMessage("Não foi possível salvar.");
    setProject((current) => current && {
      ...current,
      events: current.events.map((item) => item.id !== event.id ? item : {
        ...item,
        taskStatuses: [...(item.taskStatuses ?? []).filter((row) => row.findingId !== findingId), { findingId, status, reason }],
      }),
    });
  }

  if (state === "loading") return <div className="projects-state"><div className="loading-ring" /><strong>Carregando projeto…</strong></div>;
  if (state === "error" || !project) {
    return <div className="projects-state protected-state"><div className="state-icon">↻</div><h1>Não foi possível carregar o projeto</h1><button className="button primary" onClick={() => void load()}>Tentar novamente</button></div>;
  }

  return (
    <div className="project-detail">
      <div className="projects-header">
        <div>
          <div className="eyebrow">{project.code || "PROJETO"} · {tab.toUpperCase()}</div>
          <h1>{project.name}</h1>
          <p>{reviewEvents.length} revisão(ões) com achados · {openCount} task(s) em aberto</p>
        </div>
      </div>
      {message && <div className="project-message" role="status">✓ {message}<button onClick={() => setMessage("")}>×</button></div>}

      {tab === "Pranchas" && <SheetsTab project={project} events={reviewEvents} sheets={sheets} onSheetsChanged={load} onStatus={setTaskStatus} setMessage={setMessage} />}
      {tab === "Comparações" && <CompareTab events={reviewEvents} />}
      {tab === "Tasks" && <TasksWorkspace projectId={project.id} />}
      {tab === "Schedules" && <SchedulesTab events={reviewEvents} />}
      {tab === "Revisões" && <RevisionsTab events={project.events} sheets={sheets} />}
    </div>
  );
}

function SheetsTab({ project, events, sheets, onSheetsChanged, onStatus, setMessage }: {
  project: Project;
  events: ProjectEvent[];
  sheets: Sheet[];
  onSheetsChanged: () => Promise<void>;
  onStatus: (event: ProjectEvent, findingId: number, status: TaskStatusRow["status"], reason: string) => Promise<void>;
  setMessage: (text: string) => void;
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [sheetId, setSheetId] = useState("");
  const [activeFinding, setActiveFinding] = useState<number | null>(null);
  const [progress, setProgress] = useState("");
  const [reason, setReason] = useState("");
  const [zoom, setZoom] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const event = events.find((item) => item.id === eventId) ?? events[0];
  const findings = useMemo(() => (event ? parseFindings(event.findingsJson) : []), [event]);
  const eventSheets = useMemo(() => sheets.filter((sheet) => sheet.eventId === event?.id), [sheets, event]);
  const sheet = eventSheets.find((item) => item.id === sheetId) ?? eventSheets[0];
  const sheetFindings = useMemo(() => (sheet ? findingsForSheet(findings, sheet) : []), [findings, sheet]);
  const pinned = sheetFindings.filter((f) => f.bbox && f.bbox.length === 4);
  const unplacedEverywhere = useMemo(() => findings.filter((f) => !eventSheets.some((s) => findingsForSheet([f], s).length)), [findings, eventSheets]);
  const selected = findings.find((f) => f.id === activeFinding) ?? null;

  useEffect(() => { setSheetId(""); setActiveFinding(null); }, [eventId]);

  async function attachPdf(file: File) {
    if (!event) return;
    setProgress("Lendo o PDF…");
    try {
      const saved = await uploadPdfSheets(file, event.id, project.id, (done, total) => setProgress(`Gerando pranchas… ${done}/${total}`));
      setProgress("");
      setMessage(`${saved} prancha(s) salvas nesta revisão.`);
      await onSheetsChanged();
    } catch (error) {
      setProgress("");
      setMessage(error instanceof Error ? `Não foi possível ler o PDF (${error.message}).` : "Não foi possível ler o PDF.");
    }
  }

  if (!events.length) {
    return <div className="empty-projects"><div className="empty-folder">▤</div><h2>Nenhuma revisão com achados</h2><p>Carregue um Project Package na timeline do projeto (aba <b>Projetos</b>) para ver as pranchas aqui.</p></div>;
  }

  return (
    <div className="sheets-tab">
      <div className="sheets-toolbar">
        <label><span>REVISÃO</span>
          <select value={event?.id} onChange={(e) => setEventId(e.target.value)}>
            {events.map((item) => <option key={item.id} value={item.id}>{item.revision || "—"} · {item.title}</option>)}
          </select>
        </label>
        <input ref={fileRef} className="visually-hidden" type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attachPdf(f); e.target.value = ""; }} />
        <button className="button secondary" disabled={Boolean(progress)} onClick={() => fileRef.current?.click()}>
          {progress || (eventSheets.length ? "↻ Recarregar PDF desta revisão" : "＋ Carregar PDF desta revisão")}
        </button>
        {sheet && <div className="zoom-controls"><button onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>＋</button></div>}
      </div>

      {!eventSheets.length ? (
        <div className="empty-projects">
          <div className="empty-folder">▤</div>
          <h2>As pranchas desta revisão ainda não foram carregadas</h2>
          <p>Clique em <b>Carregar PDF desta revisão</b> e escolha o mesmo PDF que foi revisado. As {findings.length} marcações aparecem em cima de cada prancha.</p>
        </div>
      ) : (
        <div className="sheets-layout">
          <aside className="sheet-thumbs">
            {eventSheets.map((item) => {
              const count = findingsForSheet(findings, item).filter((f) => statusOf(event!, f.id).status === "Pendente").length;
              return (
                <button key={item.id} className={item.id === sheet?.id ? "active" : ""} onClick={() => { setSheetId(item.id); setActiveFinding(null); }}>
                  <img src={`/api/sheet-image?id=${item.id}`} alt={item.label || `Página ${item.pageNumber}`} loading="lazy" />
                  <span>{item.label || `p. ${item.pageNumber}`}</span>
                  {count > 0 && <em>{count}</em>}
                </button>
              );
            })}
          </aside>

          <section className="sheet-viewer">
            {sheet && (
              <div className="sheet-canvas" style={{ width: `${zoom * 100}%` }}>
                <img src={`/api/sheet-image?id=${sheet.id}`} alt={sheet.label} />
                {pinned.map((f) => {
                  const [x0, y0, x1, y1] = f.bbox as number[];
                  const st = statusOf(event!, f.id).status;
                  return (
                    <button
                      key={f.id}
                      className={`sheet-pin ${confidenceClass(f.confidence)} ${st !== "Pendente" ? "done" : ""} ${activeFinding === f.id ? "active" : ""}`}
                      style={{ left: `${((x0 + x1) / 2) * 100}%`, top: `${((y0 + y1) / 2) * 100}%` }}
                      onClick={() => setActiveFinding(f.id)}
                      title={f.title}
                    >{f.id}</button>
                  );
                })}
                {pinned.filter((f) => f.id === activeFinding).map((f) => {
                  const [x0, y0, x1, y1] = f.bbox as number[];
                  return <div key="ring" className="sheet-ring" style={{ left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }} />;
                })}
              </div>
            )}
          </section>

          <aside className="sheet-findings">
            <div className="panel-label">{sheet?.label || `PÁGINA ${sheet?.pageNumber}`} · {sheetFindings.length} ACHADO(S)</div>
            {sheetFindings.length === 0 && <p className="muted">Nenhum achado nesta prancha.</p>}
            {sheetFindings.map((f) => {
              const st = statusOf(event!, f.id);
              return (
                <button key={f.id} className={`sheet-finding ${activeFinding === f.id ? "active" : ""} ${st.status !== "Pendente" ? "done" : ""}`} onClick={() => setActiveFinding(f.id)}>
                  <b className={`pin-badge ${confidenceClass(f.confidence)}`}>{f.id}</b>
                  <span>{f.title}{!f.bbox && <small> · sem posição marcada</small>}</span>
                  {st.status !== "Pendente" && <em>{st.status}</em>}
                </button>
              );
            })}
            {unplacedEverywhere.length > 0 && (
              <details className="unplaced">
                <summary>{unplacedEverywhere.length} achado(s) sem prancha identificada</summary>
                {unplacedEverywhere.map((f) => <button key={f.id} className="sheet-finding" onClick={() => setActiveFinding(f.id)}><b className={`pin-badge ${confidenceClass(f.confidence)}`}>{f.id}</b><span>{f.title}<small> · {f.sheet}</small></span></button>)}
              </details>
            )}
            {selected && event && (
              <div className="finding-detail-card">
                <div className="finding-detail-meta"><span className={`finding-mini-badge ${confidenceClass(selected.confidence)}`}>{selected.confidence}</span><span>{selected.evidence}</span></div>
                <h3>{selected.id}. {selected.title}</h3>
                <p className="muted">{selected.sheet}</p>
                {selected.summary && <><h4>No desenho</h4><p>{selected.summary}</p></>}
                {selected.expected && <><h4>Como deveria estar</h4><p>{selected.expected}</p></>}
                {selected.codeReference && <p className="muted">{selected.codeReference}</p>}
                <div className="finding-actions">
                  <button className="button primary" onClick={() => void onStatus(event, selected.id, statusOf(event, selected.id).status === "Corrigido" ? "Pendente" : "Corrigido", "")}>
                    {statusOf(event, selected.id).status === "Corrigido" ? "↺ Reabrir" : "✓ Corrigido"}
                  </button>
                  <input placeholder="Motivo (para irrelevante)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="button secondary" disabled={!reason.trim()} onClick={() => { void onStatus(event, selected.id, "Irrelevante", reason.trim()); setReason(""); }}>Irrelevante</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function CompareTab({ events }: { events: ProjectEvent[] }) {
  const [fromId, setFromId] = useState(events[1]?.id ?? events[0]?.id ?? "");
  const [toId, setToId] = useState(events[0]?.id ?? "");
  const from = events.find((e) => e.id === fromId);
  const to = events.find((e) => e.id === toId);

  const result = useMemo(() => {
    if (!from || !to || from.id === to.id) return null;
    const key = (f: Finding) => norm(f.title.replace(/\(continua do R\d+\)/i, "")).slice(0, 48);
    const a = parseFindings(from.findingsJson);
    const b = parseFindings(to.findingsJson);
    const bKeys = new Set(b.map(key));
    const aKeys = new Set(a.map(key));
    return {
      resolved: a.filter((f) => !bKeys.has(key(f))),
      persisting: b.filter((f) => aKeys.has(key(f)) || /continua do R/i.test(f.title)),
      fresh: b.filter((f) => !aKeys.has(key(f)) && !/continua do R/i.test(f.title)),
    };
  }, [from, to]);

  if (events.length < 2) return <div className="empty-projects"><div className="empty-folder">⇄</div><h2>Precisa de duas revisões</h2><p>Quando o projeto tiver duas revisões com achados, a comparação mostra o que foi corrigido, o que continua e o que é novo.</p></div>;

  const column = (title: string, items: Finding[], tone: string) => (
    <div className={`compare-col ${tone}`}>
      <h3>{title} <em>{items.length}</em></h3>
      {items.map((f) => <div key={`${title}-${f.id}`} className="compare-item"><span className={`finding-mini-badge ${confidenceClass(f.confidence)}`}>{f.confidence}</span><b>{f.title}</b><small>{f.sheet}</small></div>)}
      {!items.length && <p className="muted">Nada aqui.</p>}
    </div>
  );

  return (
    <div className="compare-tab">
      <div className="revision-picker">
        <label><span>REVISÃO ANTERIOR</span><select value={fromId} onChange={(e) => setFromId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.revision} · {e.title}</option>)}</select></label>
        <div className="revision-arrow">→</div>
        <label><span>REVISÃO ATUAL</span><select value={toId} onChange={(e) => setToId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.revision} · {e.title}</option>)}</select></label>
      </div>
      {result ? (
        <div className="compare-grid">
          {column("Corrigidos", result.resolved, "good")}
          {column("Continuam", result.persisting, "warn")}
          {column("Novos", result.fresh, "bad")}
        </div>
      ) : <p className="muted">Escolha duas revisões diferentes.</p>}
    </div>
  );
}

function SchedulesTab({ events }: { events: ProjectEvent[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const event = events.find((e) => e.id === eventId) ?? events[0];
  const items = useMemo(() => {
    if (!event) return [];
    return parseFindings(event.findingsJson).filter((f) => f.evidence === "Schedule" || /schedule|legenda|legend|quantidade|porta|door|revis/i.test(`${f.title} ${f.sheet}`));
  }, [event]);
  const groups = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of items) {
      const k = /door|porta/i.test(`${f.title} ${f.sheet}`) ? "Door / Glass Schedule" : /revis/i.test(f.title) ? "Quadro de revisão" : /LA\d|L[AD]\d|lumin|fixture|teto|ceiling/i.test(`${f.title} ${f.sheet}`) ? "Lighting / Ceiling Schedule" : /quantidade|qtd|sqft/i.test(`${f.title} ${f.summary ?? ""}`) ? "Quantidades" : "Outros schedules e legendas";
      map.set(k, [...(map.get(k) ?? []), f]);
    }
    return [...map.entries()];
  }, [items]);

  if (!events.length) return <div className="empty-projects"><div className="empty-folder">▦</div><h2>Nenhuma revisão com achados</h2></div>;
  return (
    <div className="schedules-tab">
      <div className="sheets-toolbar"><label><span>REVISÃO</span><select value={event?.id} onChange={(e) => setEventId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.revision} · {e.title}</option>)}</select></label></div>
      {groups.length === 0 && <p className="muted">Nenhum achado de schedule nesta revisão.</p>}
      {groups.map(([name, list]) => (
        <section key={name} className="schedule-group">
          <h3>{name} <em>{list.length}</em></h3>
          {list.map((f) => (
            <div key={f.id} className="schedule-row">
              <span className={`finding-mini-badge ${confidenceClass(f.confidence)}`}>{f.confidence}</span>
              <div><b>{f.title}</b><small>{f.sheet}</small>{f.expected && <p>{f.expected}</p>}</div>
              <em>{statusOf(event!, f.id).status}</em>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function RevisionsTab({ events, sheets }: { events: ProjectEvent[]; sheets: Sheet[] }) {
  return (
    <div className="revisions-tab">
      <div className="revision-table">
        <div className="revision-row header"><span>REVISÃO</span><span>REGISTRO</span><span>DATA</span><span>PRANCHAS</span><span>ACHADOS</span><span>EM ABERTO</span><span>CORRIGIDOS</span></div>
        {events.map((event) => {
          const f = parseFindings(event.findingsJson);
          const open = f.filter((x) => statusOf(event, x.id).status === "Pendente").length;
          const fixed = f.filter((x) => statusOf(event, x.id).status === "Corrigido").length;
          return (
            <div key={event.id} className="revision-row">
              <b>{event.revision || "—"}</b>
              <span>{event.title}<small>{event.documentType} · {event.status}</small></span>
              <span>{eventDate(event.createdAt)}</span>
              <span>{sheets.filter((s) => s.eventId === event.id).length || "—"}</span>
              <span>{f.length ? `${f.length} (${f.filter((x) => x.confidence === "Alta").length} alta)` : "—"}</span>
              <span>{f.length ? open : "—"}</span>
              <span>{f.length ? fixed : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
