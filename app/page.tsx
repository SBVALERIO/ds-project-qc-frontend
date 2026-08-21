"use client";

import { useMemo, useRef, useState } from "react";
import { ProjectsWorkspace } from "./ProjectsWorkspace";
import { ReportsWorkspace } from "./ReportsWorkspace";
import { TasksWorkspace } from "./TasksWorkspace";

type FindingStatus = "Pendente" | "Corrigido" | "Non Applicable";

type Finding = {
  id: number;
  title: string;
  sheet: string;
  confidence: "Alta" | "Média" | "Menor";
  evidence: "Schedule" | "Visual" | "Cross-check";
  status: FindingStatus;
  summary: string;
  expected: string;
  locations?: string[];
  codeReference?: string;
  codeUrl?: string;
};

type DocumentOrigin = "revit" | "autocad" | "shop_drawings";

// Points at the Python engine's FastAPI server (uvicorn qc_engine.api:app),
// deployed at https://github.com/SBVALERIO/ds-project-qc-engine (Render).
// VITE_ENGINE_API_URL overrides this for local development against a
// different instance.
const ENGINE_API_URL = `${import.meta.env.VITE_ENGINE_API_URL ?? "https://ds-project-qc-engine.onrender.com"}/analyze`;

const initialFindings: Finding[] = [
  {
    id: 1,
    title: "Index não lista todas as pranchas emitidas",
    sheet: "p. 1 · I-000 ↔ conjunto completo",
    confidence: "Alta",
    evidence: "Cross-check",
    status: "Pendente",
    summary: "O PDF contém 30 páginas, mas aproximadamente 15 pranchas .1/.2 presentes no conjunto não aparecem no Index.",
    expected: "O Index deve listar individualmente toda prancha emitida, com número e título corretos.",
  },
  {
    id: 2,
    title: "Código I-112.1 duplicado em duas pranchas",
    sheet: "p. 24 ↔ p. 26 · Wall Treatment / Curtains",
    confidence: "Alta",
    evidence: "Cross-check",
    status: "Pendente",
    summary: "Curtains Plan – Second Floor reutiliza I-112.1, já usado por Wall Treatment – Second Floor.",
    expected: "Cada prancha deve ter código único; pela sequência, confirmar I-113.1 para Curtains.",
  },
  {
    id: 3,
    title: "Demolition Plan ausente apesar do demolition scope",
    sheet: "p. 1, 6–7 · I-102 / Construction Plans",
    confidence: "Alta",
    evidence: "Cross-check",
    status: "Pendente",
    summary: "I-102 não foi emitida, mas as Construction Plans mandam remover janela, preencher parede e remover curtain pocket.",
    expected: "Toda demolição deve ser organizada e representada no Demolition Plan correspondente.",
  },
  {
    id: 4,
    title: "Nota de J-boxes 0–10V ausente",
    sheet: "p. 10–14 · RCP / Lighting · dois pavimentos",
    confidence: "Alta",
    evidence: "Cross-check",
    status: "Pendente",
    summary: "As legendas possuem J-boxes, mas não registram quantas devem ser 0–10V.",
    expected: "Adicionar nas legendas de RCP e Lighting: considerar metade das J-boxes do projeto 0–10V.",
  },
  { id: 5, title: "Escala conflitante no RCP do segundo pavimento", sheet: "p. 11 · I-106.1", confidence: "Alta", evidence: "Visual", status: "Pendente", summary: "O título do desenho indica 1/4\" = 1'-0\"; o titleblock indica 3/16\" = 1'-0\".", expected: "A escala do desenho e a escala do titleblock devem coincidir." },
  { id: 6, title: "Escala conflitante na prancha de detalhes", sheet: "p. 12 · I-106.2", confidence: "Alta", evidence: "Visual", status: "Pendente", summary: "Os quatro detalhes indicam 3\" = 1'-0\"; o titleblock indica 3/16\" = 1'-0\".", expected: "Usar a escala correta ou registrar “As indicated” no titleblock." },
  { id: 7, title: "Placeholder XX SQFT permanece no Ceiling Legend", sheet: "p. 10 e 15 · I-106 / I-108", confidence: "Alta", evidence: "Schedule", status: "Pendente", summary: "A linha de curtain pockets termina em XX SQFT.", expected: "Substituir todo placeholder pela quantidade calculada e verificada." },
  { id: 8, title: "Revision clouds sem revisão vinculada", sheet: "p. 12 · I-106.2", confidence: "Alta", evidence: "Cross-check", status: "Pendente", summary: "Existem duas clouds vermelhas, mas o Revision Schedule contém somente R00 e não há delta de identificação.", expected: "Toda cloud deve apontar para uma revisão registrada no titleblock." },
  { id: 9, title: "Revision Schedule pula de R00 para R03", sheet: "p. 10 · I-106", confidence: "Alta", evidence: "Schedule", status: "Pendente", summary: "R01 e R02 não aparecem entre R00 e R03.", expected: "Manter sequência e histórico de revisões rastreável ou justificar formalmente a omissão." },
  { id: 10, title: "Datas de R01 anteriores ao desenho original", sheet: "p. 21, 24 e 28", confidence: "Alta", evidence: "Schedule", status: "Pendente", summary: "R00 é 02/27/2026, mas R01 aparece como 01/06/2026. Provável inversão para 06/01/2026.", expected: "Uma revisão não pode ter data anterior à emissão original." },
  { id: 11, title: "Nota fixa quatro outlets extras", sheet: "p. 19 · I-110", confidence: "Alta", evidence: "Visual", status: "Pendente", summary: "A nota determina “CONSIDER 04 EXTRA OUTLETS TOTAL”.", expected: "A quantidade de extras deve depender da quantidade e necessidade efetiva do projeto." },
  { id: 12, title: "Floor tags não seguem o padrão FL", sheet: "p. 8–9 · I-105 / I-105.1", confidence: "Alta", evidence: "Cross-check", status: "Pendente", summary: "Os acabamentos de piso são identificados apenas por 01, 02, 03 etc.", expected: "Todo piso alterado deve receber tag iniciada por FL." },
  { id: 13, title: "Confirmar blackout exatamente na dimensão da janela", sheet: "p. 25–26 · Curtain Plans", confidence: "Média", evidence: "Visual", status: "Pendente", summary: "A geometria parece alinhada, mas a leitura não permite confirmar todas as seis ocorrências individualmente.", expected: "Blackout deve ter a dimensão exata da janela." },
  { id: 14, title: "Confirmar sheer na dimensão integral do curtain pocket", sheet: "p. 25–26 · Curtain Plans", confidence: "Média", evidence: "Visual", status: "Pendente", summary: "Existem dimensões, porém nem todos os limites podem ser correlacionados com segurança pela resolução.", expected: "Sheer deve ocupar a dimensão integral do curtain pocket." },
  { id: 15, title: "Verificar door maneuvering clearances", sheet: "p. 21–22 · Door Schedules", confidence: "Média", evidence: "Visual", status: "Pendente", summary: "Larguras, tipos e swings estão representados, mas não há cotas suficientes para aprovar todos os clearances.", expected: "Confirmar clear opening e maneuvering clearance conforme código aplicável e condições do local." },
  {
    id: 16,
    title: "Garagem: receptáculo por vaga não demonstrado",
    sheet: "p. 19 · I-110 · Garage (3 vehicle bays)",
    confidence: "Alta",
    evidence: "Cross-check",
    status: "Pendente",
    summary: "A garagem possui três vagas, mas a planta mostra somente um receptáculo de uso geral junto ao storage/lavatório. Não há um receptáculo claramente localizado para atender cada vehicle bay; tomadas dedicadas a equipamentos não substituem esse mínimo.",
    expected: "Adicionar ou realocar no mínimo um receptáculo de uso geral para cada uma das três vagas, todos a no máximo 5'-6\" AFF. Identificar proteção GFCI e alimentar os receptáculos obrigatórios por circuito de garagem 120 V, 20 A. Coordenar posição final com portas, storage e equipamentos e submeter ao electrical engineer/AHJ.",
    codeReference: "2023 Florida Building Code – Residential, Part VIII (2020 NEC): 210.52(G)(1), 210.11(C)(4) e 210.8(A)(2).",
    codeUrl: "https://www.floridabuilding.org/fbc/commission/FBC_0824/Commission_Education_POC/1279/1279-0-PRESMAT.pdf",
  },
  { id: 17, title: "Texto “EXTERIOR – EXTERIOR” duplicado", sheet: "p. 23 · I-112", confidence: "Menor", evidence: "Schedule", status: "Pendente", summary: "A descrição possui a palavra EXTERIOR repetida.", expected: "Remover a duplicação e manter a legenda limpa." },
  {
    id: 18,
    title: "Grafias divergentes para Stucco Sabbiato 878",
    sheet: "I-105 / I-106 / I-112 · PDF p. 8, 10 e 23",
    confidence: "Menor",
    evidence: "Cross-check",
    status: "Pendente",
    summary: "A mesma especificação de acabamento exterior aparece corretamente em duas legendas, mas com grafia divergente na legenda de Wall Treatment.",
    expected: "Confirmar a nomenclatura da especificação aprovada e, sendo STUCCO SABBIATO 878, corrigir na Wall Finish Legend da folha I-112: STRUCCO SABIATTO 878 → STUCCO SABBIATO 878.",
    locations: [
      "Floor Finish Legend — folha I-105, PDF p. 8: “EXTERIOR – STUCCO SABBIATO 878”.",
      "Drop Ceiling Legend – First Floor — folha I-106, PDF p. 10: “EXTERIOR AREA ... STUCCO SABBIATO”.",
      "Wall Finish Legend (Wall Treatment) — folha I-112, PDF p. 23: “EXTERIOR – STRUCCO SABIATTO 878”.",
    ],
  },
  { id: 19, title: "Layers de plumbing/bath aparecem em pranchas não relacionadas", sheet: "p. 22–26 · múltiplas disciplinas", confidence: "Menor", evidence: "Visual", status: "Pendente", summary: "Labels de fixtures e bath accessories permanecem em Door, Wall Treatment e Curtain Plans.", expected: "Revisar layers do AutoCAD e exibir somente informações relevantes para cada prancha." },
];

const navItems = ["Visão geral", "Projetos", "Pranchas", "Comparações", "Tasks", "Schedules", "Revisões", "Reports — Admin", "Casos conhecidos"];

const verifiedMatches = [
  "Door Schedule: tags e quantidades fecham nos dois pavimentos",
  "Door codes não estão duplicados nem misturados entre pavimentos",
  "Wall Treatment ↔ Baseboard compatíveis, inclusive acabamentos to the floor",
  "Millwork corretamente tratado sem baseboard",
  "Curtain pockets cotados em 8\" ou mais e detalhe construtivo com mínimo de 8\"",
  "Nota da cozinha manda seguir fabricator para localização e quantidade de outlets",
  "RCP, Ceiling, Lighting e Circuits mantêm posições e legendas coordenadas",
  "Original e Proposed Mechanical têm diferenciação gráfica clara",
];

const coverageGroups = [
  { pages: "01", name: "Index", result: "1 erro", ids: [1] },
  { pages: "02–07", name: "Original / Proposed / Construction", result: "1 erro", ids: [3] },
  { pages: "08–09", name: "Flooring / Baseboard", result: "1 erro", ids: [12] },
  { pages: "10–18", name: "RCP / Lighting / Ceiling / Circuits", result: "5 erros", ids: [4, 5, 6, 7, 8, 9] },
  { pages: "19–20", name: "Outlets", result: "2 erros confirmados", ids: [11, 16] },
  { pages: "21–22", name: "Doors / Hardware", result: "Bate + check", ids: [15] },
  { pages: "23–24", name: "Wall Treatment", result: "Bate + 2 menores", ids: [17, 18, 19] },
  { pages: "25–26", name: "Curtains", result: "1 erro + 2 checks", ids: [2, 13, 14, 19] },
  { pages: "27–30", name: "Mechanical", result: "Bate + revisão", ids: [10] },
];

export default function Home() {
  const [findings, setFindings] = useState(initialFindings);
  const [activeFinding, setActiveFinding] = useState(4);
  const [activeNav, setActiveNav] = useState("Comparações");
  const [filter, setFilter] = useState<"Todos" | FindingStatus>("Todos");
  const [groupFilter, setGroupFilter] = useState<{ name: string; ids: number[] } | null>(null);
  const [showNa, setShowNa] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [naReason, setNaReason] = useState("");
  const [naScope, setNaScope] = useState<"item" | "regra">("item");
  const [manualText, setManualText] = useState("");
  const [toast, setToast] = useState("");
  const [uploadedProject, setUploadedProject] = useState("");
  const [isRealData, setIsRealData] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [origin, setOrigin] = useState<DocumentOrigin>("autocad");
  const projectInputRef = useRef<HTMLInputElement>(null);
  const findingsPanelRef = useRef<HTMLElement>(null);

  const visibleFindings = useMemo(
    () => findings.filter((item) => (!groupFilter || groupFilter.ids.includes(item.id)) && (filter === "Todos" || item.status === filter)),
    [findings, filter, groupFilter],
  );

  const counts = useMemo(
    () => ({
      pending: findings.filter((item) => item.status === "Pendente").length,
      corrected: findings.filter((item) => item.status === "Corrigido").length,
      na: findings.filter((item) => item.status === "Non Applicable").length,
    }),
    [findings],
  );

  function updateStatus(id: number, status: FindingStatus) {
    setFindings((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
    setToast(status === "Corrigido" ? "Task marcada como corrigida." : "Exceção registrada para revisão.");
    window.setTimeout(() => setToast(""), 2600);
  }

  function openVerificationGroup(name: string, ids: number[]) {
    setGroupFilter({ name, ids });
    setFilter("Todos");
    setActiveFinding(ids[0]);
    window.setTimeout(() => findingsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function openStatus(status: "Todos" | FindingStatus) {
    setGroupFilter(null);
    setFilter(status);
    window.setTimeout(() => findingsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function saveNa() {
    if (!naReason.trim()) return;
    updateStatus(activeFinding, "Non Applicable");
    setShowNa(false);
    setNaReason("");
  }

  function addManualFinding() {
    if (!manualText.trim()) return;
    const nextId = Math.max(...findings.map((item) => item.id)) + 1;
    setFindings((items) => [
      ...items,
      {
        id: nextId,
        title: manualText,
        sheet: "Correção manual · aguardando localização",
        confidence: "Alta",
        evidence: "Visual",
        status: "Pendente",
        summary: "Achado adicionado pela equipe DS e registrado como algo que o sistema não identificou.",
        expected: "Será avaliado como candidato a nova regra objetiva.",
      },
    ]);
    setActiveFinding(nextId);
    setManualText("");
    setShowManual(false);
    setToast("Correção manual adicionada e sinalizada para aprendizado.");
    window.setTimeout(() => setToast(""), 2800);
  }

  async function handleProjectUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedProject(file.name);
    setAnalyzeError("");
    setIsAnalyzing(true);

    const body = new FormData();
    body.append("file", file);
    body.append("origin", origin);

    try {
      const response = await fetch(ENGINE_API_URL, { method: "POST", body });
      if (!response.ok) throw new Error(`motor retornou ${response.status}`);
      const data = (await response.json()) as { findings: Finding[] };
      setFindings(data.findings);
      setIsRealData(true);
      setGroupFilter(null);
      setActiveFinding(data.findings[0]?.id ?? 0);
      setToast(`Projeto “${file.name}” analisado: ${data.findings.length} achado(s).`);
    } catch (error) {
      setAnalyzeError(
        error instanceof Error
          ? `Não foi possível analisar o PDF (${error.message}). O motor está acessível em ${ENGINE_API_URL}?`
          : "Não foi possível analisar o PDF.",
      );
    } finally {
      setIsAnalyzing(false);
      window.setTimeout(() => setToast(""), 3200);
    }
  }

  const selected = findings.find((item) => item.id === activeFinding) ?? findings[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">DS</div>
        <div className="brand-copy">
          <strong>PROJECT QC</strong>
          <span>Design Solution · controle técnico</span>
        </div>
        <div className="workflow" aria-label="Etapas do fluxo">
          {[
            ["1", "Analisar"],
            ["2", "Corrigir"],
            ["3", "Revalidar"],
            ["4", "Material List"],
          ].map(([number, label], index) => (
            <div className={`workflow-step ${index === 1 ? "is-active" : ""}`} key={label}>
              <span>{number}</span>{label}
            </div>
          ))}
        </div>
        <button className="profile" aria-label="Perfil de Stefany">SV</button>
      </header>

      <aside className="sidebar">
        <div className="project-switcher">
          <span>PROJETO ATIVO</span>
          <strong>CASA@63</strong>
          <small>Project Package AutoCAD · R02</small>
        </div>
        <nav aria-label="Navegação principal">
          {navItems.map((item, index) => (
            <button className={activeNav === item ? "active" : ""} key={item} onClick={() => setActiveNav(item)}>
              <span className="nav-icon">{["⌂", "▣", "▤", "⇄", "✓", "▦", "↻", "≡", "◫"][index]}</span>{item}
              {item === "Tasks" && <em>{counts.pending}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>STANDARD ATIVO</span>
          <strong>DS CAD Standards</strong>
          <small>23 regras objetivas · v1.4</small>
        </div>
      </aside>

      <section className="workspace">
        {activeNav === "Projetos" ? <ProjectsWorkspace /> : activeNav === "Reports — Admin" ? <ReportsWorkspace /> : activeNav === "Tasks" ? <TasksWorkspace /> : <>
        <div className="project-head">
          <div>
            <div className="eyebrow">PROJECT PACKAGE CHECK</div>
            <h1>{isRealData ? `${uploadedProject} · revisão técnica` : "CASA@63 · revisão técnica completa (demo)"}</h1>
            <p>
              {isRealData
                ? `${findings.length} achado(s) · origem informada: ${origin === "revit" ? "Revit" : origin === "autocad" ? "AutoCAD" : "Shop Drawings"}.`
                : "30 páginas analisadas · Project Package feito no AutoCAD · 07/15/2026 · dados de demonstração."}
            </p>
          </div>
          <div className="head-actions">
            <select
              value={origin}
              onChange={(event) => setOrigin(event.target.value as DocumentOrigin)}
              aria-label="Origem do Project Package"
            >
              <option value="revit">Project Package — Revit</option>
              <option value="autocad">Project Package — AutoCAD</option>
              <option value="shop_drawings">Shop Drawings</option>
            </select>
            <input
              ref={projectInputRef}
              className="visually-hidden"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleProjectUpload}
              aria-label="Selecionar projeto em PDF para correção"
            />
            <button className="button primary upload-project" onClick={() => projectInputRef.current?.click()} disabled={isAnalyzing}>
              {isAnalyzing ? "Analisando…" : "↑ Carregar projeto para correção"}
            </button>
          </div>
        </div>

        {analyzeError && (
          <div className="uploaded-project" role="alert" style={{ borderColor: "var(--red)", background: "var(--red-soft)" }}>
            <span style={{ background: "var(--red)" }}>!</span>
            <div><strong>Erro na análise</strong><small>{analyzeError}</small></div>
          </div>
        )}

        {uploadedProject && (
          <div className="uploaded-project" role="status">
            <span>✓</span>
            <div><strong>Projeto carregado</strong><small>{uploadedProject}</small></div>
            <button onClick={() => projectInputRef.current?.click()}>Trocar arquivo</button>
          </div>
        )}

        {!isRealData && (
          <div className="check-group">
            <div>
              <span className="group-label">GRUPO DE CHECAGEM</span>
              <strong>Package completo · 30 páginas</strong>
            </div>
            <div className="sheet-chips">
              {[
                ["13 alta confiança", false],
                ["3 média confiança", false],
                ["3 registrados", true],
                ["8 grupos batem", true],
              ].map(([label, ok]) => <span className={ok ? "chip-ok" : "chip-warn"} key={String(label)}>{ok ? "✓" : "!"} {label}</span>)}
            </div>
            <div className="group-progress"><b>30/30</b><span>páginas revisadas</span></div>
          </div>
        )}

        <div className="content-grid">
          <section className="viewer-panel">
            <div className="viewer-toolbar">
              <div className="sheet-tabs"><button className="selected">QC geral</button><button>Index</button><button>Teto</button><button>Schedules</button><button>Revisões</button></div>
              <div className="review-source"><span>FONTE</span><strong>{isRealData ? uploadedProject : "CASA@63 · R02.pdf"}</strong></div>
            </div>

            <div className="qc-dashboard">
              {isRealData ? (
                <div className="coverage-head"><span>ANÁLISE REAL</span><strong>{findings.length} achado(s) do motor · agrupamento por prancha ainda não implementado</strong></div>
              ) : (
                <>
                  <div className="coverage-head"><span>COBERTURA PÁGINA POR PÁGINA</span><strong>Todos os grupos do package foram cruzados</strong></div>
                  <div className="coverage-grid">
                    {coverageGroups.map((group) => (
                      <button
                        className={`coverage-item ${groupFilter?.name === group.name ? "active" : ""}`}
                        key={group.pages}
                        onClick={() => openVerificationGroup(group.name, group.ids)}
                        aria-label={`Abrir verificações de ${group.name}`}
                      >
                        <b>{group.pages}</b><span>{group.name}</span><em>{group.result}</em><i>Ver verificações →</i>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {selected && <div className="selected-evidence">
                <div className="evidence-number">{selected.id}</div>
                <div>
                  <span>ITEM SELECIONADO · {selected.confidence.toUpperCase()} CONFIANÇA</span>
                  <h2>{selected.title}</h2>
                  <p>{selected.sheet}</p>
                </div>
                <div className={`evidence-text ${selected.codeReference ? "has-code" : ""}`}>
                  <p><b>Encontrado</b>{selected.summary}</p>
                  <p><b>{selected.codeReference ? "Como corrigir" : "Esperado"}</b>{selected.expected}</p>
                  {selected.locations && <div className="evidence-locations"><b>Onde está escrito</b><ul>{selected.locations.map((location) => <li key={location}>{location}</li>)}</ul></div>}
                  {selected.codeReference && <p className="code-reference"><b>Base normativa verificada</b>{selected.codeReference} {selected.codeUrl && <a href={selected.codeUrl} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>}</p>}
                </div>
              </div>}
            </div>

            {!isRealData && (
              <div className="verified-card">
                <div className="verified-title"><span>✓</span><div><small>O QUE BATE</small><strong>{verifiedMatches.length} validações confirmadas</strong></div></div>
                <div className="verified-grid">{verifiedMatches.map((item) => <div key={item}><span>✓</span>{item}</div>)}</div>
              </div>
            )}
          </section>

          <aside className="findings-panel" ref={findingsPanelRef}>
            <div className="findings-summary">
              <button onClick={() => openStatus("Pendente")}><b>{counts.pending}</b><span>Pendentes</span></button>
              <button onClick={() => openStatus("Corrigido")}><b>{counts.corrected}</b><span>Corrigidos</span></button>
              <button onClick={() => openStatus("Non Applicable")}><b>{counts.na}</b><span>Non Applicable</span></button>
            </div>
            <div className="findings-head">
              <div><span>{groupFilter ? `RESULTADOS · ${groupFilter.name}` : "RESULTADOS"}</span><strong>{visibleFindings.length} verificações</strong></div>
              {groupFilter && <button className="clear-group" onClick={() => setGroupFilter(null)}>Mostrar todas</button>}
              <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filtrar resultados">
                <option>Todos</option><option>Pendente</option><option>Corrigido</option><option>Non Applicable</option>
              </select>
            </div>
            <div className="findings-list">
              {visibleFindings.map((item) => (
                <article className={`finding-card ${activeFinding === item.id ? "selected" : ""}`} key={item.id} onClick={() => setActiveFinding(item.id)}>
                  <div className="finding-number">{item.id}</div>
                  <div className="finding-content">
                    <div className="badges"><span className={item.confidence === "Alta" ? "high" : item.confidence === "Média" ? "medium" : "minor"}>{item.confidence} confiança</span><span>{item.evidence}</span>{item.codeReference && <span className="code-badge">Norma verificada</span>}</div>
                    <h3>{item.title}</h3>
                    <p>{item.sheet}</p>
                    {activeFinding === item.id && (
                      <div className="finding-detail">
                        <p><b>Encontrado:</b> {item.summary}</p>
                        <p><b>{item.codeReference ? "Como corrigir:" : "Esperado:"}</b> {item.expected}</p>
                        {item.locations && <div className="finding-locations"><b>Onde está escrito:</b><ul>{item.locations.map((location) => <li key={location}>{location}</li>)}</ul></div>}
                        {item.codeReference && <div className="card-code-reference"><b>Base normativa:</b> {item.codeReference} {item.codeUrl && <a href={item.codeUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Fonte oficial ↗</a>}</div>}
                        <div className="card-actions">
                          <button className="correct" onClick={(event) => { event.stopPropagation(); updateStatus(item.id, "Corrigido"); }}>✓ Corrigido</button>
                          <button className="na" onClick={(event) => { event.stopPropagation(); setShowNa(true); }}>Non Applicable</button>
                        </div>
                      </div>
                    )}
                    {item.status !== "Pendente" && <span className={`status ${item.status === "Corrigido" ? "done" : "na-status"}`}>{item.status}</span>}
                  </div>
                </article>
              ))}
            </div>
            <button className="manual-button" onClick={() => setShowManual(true)}>＋ Adicionar correção que o sistema não identificou</button>
          </aside>
        </div>

        <div className="bottom-gate">
          <div className="gate-icon">↻</div>
          <div><strong>Pronto para um novo check?</strong><span>Depois das correções, carregue a nova revisão. Os itens persistentes serão reabertos automaticamente.</span></div>
          <div className="gate-status"><b>{counts.pending}</b><span>tasks ainda pendentes</span></div>
          <button className="button primary">Carregar nova revisão</button>
        </div>
        </>}
      </section>

      {showNa && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowNa(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="na-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close" onClick={() => setShowNa(false)}>×</button>
            <span className="modal-kicker">ITEM #{selected.id}</span>
            <h2 id="na-title">Por que não se aplica?</h2>
            <p>A justificativa fica salva no histórico e ajuda a evitar falsos positivos nas próximas revisões.</p>
            <textarea value={naReason} onChange={(event) => setNaReason(event.target.value)} placeholder="Explique a exceção com o máximo de clareza..." autoFocus />
            <fieldset>
              <legend>Esta justificativa vale para:</legend>
              <label><input type="radio" checked={naScope === "item"} onChange={() => setNaScope("item")} /> Somente este item</label>
              <label><input type="radio" checked={naScope === "regra"} onChange={() => setNaScope("regra")} /> Casos parecidos — propor como exceção geral</label>
            </fieldset>
            {naScope === "regra" && <div className="rule-notice">A proposta entrará na fila “Regras candidatas” e só será incorporada após validação da equipe DS.</div>}
            <button className="button primary full" disabled={!naReason.trim()} onClick={saveNa}>Salvar justificativa</button>
          </section>
        </div>
      )}

      {showManual && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={() => setShowManual(false)}>
          <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="manual-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close" onClick={() => setShowManual(false)}>×</button>
            <span className="modal-kicker">APRENDIZADO SUPERVISIONADO</span>
            <h2 id="manual-title">Adicionar correção manual</h2>
            <p>Registre algo que você viu e o sistema não sinalizou. Isso será guardado como caso conhecido e candidato a regra.</p>
            <label className="field-label">O que foi identificado?</label>
            <textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="Ex.: O curtain pocket está cotado com 6”, abaixo do mínimo de 8”..." autoFocus />
            <label className="field-label">Evidência visual</label>
            <button className="dropzone"><span>▧</span><strong>Anexar print ou recorte da prancha</strong><small>PNG, JPG ou recorte direto do viewer</small></button>
            <div className="drawer-note"><b>Como o sistema aprende:</b> a correção será revisada antes de virar regra permanente.</div>
            <button className="button primary full" disabled={!manualText.trim()} onClick={addManualFinding}>Adicionar à lista de tasks</button>
          </section>
        </div>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
