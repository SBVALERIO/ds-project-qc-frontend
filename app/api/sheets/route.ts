import { ensureSheetsTable, sheetsDb } from "../../sheets-db";

// Sheet images (one row per PDF page) live in D1 as base64 JPEG. Each page is
// rendered in the browser when a PDF is attached to a timeline event, so the
// "Pranchas" tab can show the drawing with the QC findings pinned on top —
// the same way DS reviewers mark up sheets in Trazo. A rendered sheet at
// ~2000px JPEG is well under D1's 2 MB row limit.

type SheetRow = { id: string; event_id: string; project_id: string; page_number: number; label: string; width: number; height: number };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    if (!projectId) return Response.json({ error: "projectId é obrigatório." }, { status: 400 });
    const db = sheetsDb();
    await ensureSheetsTable(db);
    const { results } = await db
      .prepare("SELECT id, event_id, project_id, page_number, label, width, height FROM sheet_images WHERE project_id = ? ORDER BY event_id, page_number")
      .bind(projectId)
      .all<SheetRow>();
    return Response.json({
      sheets: results.map((row) => ({
        id: row.id,
        eventId: row.event_id,
        pageNumber: row.page_number,
        label: row.label,
        width: row.width,
        height: row.height,
      })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao carregar pranchas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    eventId?: string;
    projectId?: string;
    pageNumber?: number;
    label?: string;
    width?: number;
    height?: number;
    data?: string;
  };
  const eventId = payload.eventId?.trim() ?? "";
  const projectId = payload.projectId?.trim() ?? "";
  const data = payload.data ?? "";
  if (!eventId || !projectId || typeof payload.pageNumber !== "number" || !data) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (data.length > 1_900_000) return Response.json({ error: "Imagem muito grande." }, { status: 413 });

  const db = sheetsDb();
  await ensureSheetsTable(db);
  // Re-uploading the same PDF to an event replaces its pages instead of duplicating them.
  await db.prepare("DELETE FROM sheet_images WHERE event_id = ? AND page_number = ?").bind(eventId, payload.pageNumber).run();
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO sheet_images (id, event_id, project_id, page_number, label, width, height, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, eventId, projectId, payload.pageNumber, payload.label?.trim() ?? "", payload.width ?? 0, payload.height ?? 0, data)
    .run();
  return Response.json({ id }, { status: 201 });
}
