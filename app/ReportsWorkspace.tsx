"use client";

import { useEffect, useMemo, useState } from "react";

type ReportEntry = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  documentType: string;
  title: string;
  revision: string;
  status: string;
  notes: string;
  actorEmail: string;
  createdAt: string;
  isCorrection: boolean;
  isUpload: boolean;
};

type ReportData = {
  admin: { email: string; displayName: string };
  summary: { projects: number; uploads: number; corrections: number; contributors: number };
  projects: { id: string; name: string }[];
  entries: ReportEntry[];
};

type Access = "loading" | "ready" | "error";

function csvCell(value: string | number | boolean) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function ReportsWorkspace() {
  const [data, setData] = useState<ReportData | null>(null);
  const [access, setAccess] = useState<Access>("loading");
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "uploads" | "corrections">("all");
  const [personFilter, setPersonFilter] = useState("all");

  async function loadReport() {
    setAccess("loading");
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      if (!response.ok) throw new Error("report failed");
      setData(await response.json() as ReportData);
      setAccess("ready");
    } catch {
      setAccess("error");
    }
  }

  useEffect(() => { void loadReport(); }, []);

  const people = useMemo(() => Array.from(new Set(data?.entries.map((entry) => entry.actorEmail) ?? [])).sort(), [data]);
  const filtered = useMemo(() => (data?.entries ?? []).filter((entry) => {
    if (projectFilter !== "all" && entry.projectId !== projectFilter) return false;
    if (personFilter !== "all" && entry.actorEmail !== personFilter) return false;
    if (typeFilter === "uploads" && !entry.isUpload) return false;
    if (typeFilter === "corrections" && !entry.isCorrection) return false;
    return true;
  }), [data, personFilter, projectFilter, typeFilter]);

  function exportCsv() {
    const header = ["Projeto", "Código", "Tipo", "Descrição", "Revisão", "Status", "Registrado por", "Data", "Correção solicitada", "Observações"];
    const rows = filtered.map((entry) => [entry.projectName, entry.projectCode, entry.documentType, entry.title, entry.revision, entry.status, entry.actorEmail, entry.createdAt, entry.isCorrection ? "Sim" : "Não", entry.notes]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `DS-Project-QC-Report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (access === "loading") return <div className="projects-state"><div className="loading-ring"/><strong>Gerando report administrativo…</strong></div>;
  if (access === "error" || !data) return <div className="projects-state protected-state"><div className="state-icon">↻</div><h1>Não foi possível gerar o report</h1><button className="button primary" onClick={loadReport}>Tentar novamente</button></div>;

  return (
    <>
      <div className="reports-header">
        <div><div className="eyebrow">REPORT ADMINISTRATIVO</div><h1>Atividade da equipe</h1><p>Quem carregou o quê, em qual projeto, e quais correções foram solicitadas.</p></div>
        <div className="reports-owner"><span>REGISTRADO COMO</span><strong>{data.admin.displayName}</strong></div>
        <button className="button primary" onClick={exportCsv}>⇩ Exportar Excel / CSV</button>
      </div>

      <div className="report-summary">
        <div><span className="report-stat-icon">▣</span><b>{data.summary.projects}</b><small>Projetos</small></div>
        <div><span className="report-stat-icon upload">↑</span><b>{data.summary.uploads}</b><small>Documentos carregados</small></div>
        <div><span className="report-stat-icon correction">!</span><b>{data.summary.corrections}</b><small>Correções solicitadas</small></div>
        <div><span className="report-stat-icon people">●</span><b>{data.summary.contributors}</b><small>Pessoas ativas</small></div>
      </div>

      <section className="report-panel">
        <div className="report-tools">
          <div><span>FILTRAR PROJETO</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">Todos os projetos</option>{data.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></div>
          <div><span>TIPO DE ATIVIDADE</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}><option value="all">Todas as atividades</option><option value="uploads">Documentos carregados</option><option value="corrections">Correções solicitadas</option></select></div>
          <div><span>PESSOA</span><select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="all">Toda a equipe</option>{people.map((email) => <option value={email} key={email}>{email}</option>)}</select></div>
          <button onClick={() => { setProjectFilter("all"); setTypeFilter("all"); setPersonFilter("all"); }}>Limpar filtros</button>
        </div>

        <div className="report-count"><strong>{filtered.length}</strong> registros encontrados</div>
        <div className="report-table-wrap">
          <table className="report-table">
            <thead><tr><th>DATA</th><th>PROJETO</th><th>ATIVIDADE</th><th>REVISÃO</th><th>STATUS</th><th>QUEM REGISTROU</th></tr></thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className={entry.isCorrection ? "correction-row" : ""}>
                  <td><time>{new Date(entry.createdAt.replace(" ", "T") + "Z").toLocaleDateString("pt-BR")}</time></td>
                  <td><strong>{entry.projectName}</strong><small>{entry.projectCode}</small></td>
                  <td><span className={`activity-badge ${entry.isCorrection ? "correction" : entry.isUpload ? "upload" : ""}`}>{entry.isCorrection ? "Correção" : entry.documentType}</span><strong>{entry.title}</strong>{entry.notes && <small>{entry.notes}</small>}</td>
                  <td><b className="revision-badge">{entry.revision || "—"}</b></td>
                  <td><span className="report-status">{entry.status}</span></td>
                  <td><strong>{entry.actorEmail.split("@")[0]}</strong><small>{entry.actorEmail}</small></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="no-report-data">Nenhum registro corresponde aos filtros selecionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="report-note"><b>Rastreabilidade:</b> todo novo registro de timeline guarda automaticamente o e-mail da pessoa, projeto, revisão, status e horário. Correções são destacadas e entram no report administrativo.</div>
    </>
  );
}
