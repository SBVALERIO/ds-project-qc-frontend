import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { projectEvents, projects } from "../../../db/schema";
import { TEAM_AUTHOR, TEAM_AUTHOR_EMAIL } from "../../team-author";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    projectId?: string;
    documentType?: string;
    title?: string;
    revision?: string;
    status?: string;
    notes?: string;
    findingsSummary?: string;
    findingsJson?: string;
  };

  const projectId = payload.projectId?.trim() ?? "";
  const title = payload.title?.trim() ?? "";
  if (!projectId || !title) {
    return Response.json({ error: "Projeto e descrição são obrigatórios." }, { status: 400 });
  }

  const db = getDb();
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });

  const [event] = await db
    .insert(projectEvents)
    .values({
      id: crypto.randomUUID(),
      projectId,
      documentType: payload.documentType?.trim() || "Correção",
      title,
      revision: payload.revision?.trim() ?? "",
      status: payload.status?.trim() || "Registrado",
      notes: payload.notes?.trim() ?? "",
      findingsSummary: payload.findingsSummary?.trim() ?? "",
      findingsJson: payload.findingsJson?.trim() || "[]",
      createdBy: TEAM_AUTHOR,
      createdByEmail: TEAM_AUTHOR_EMAIL,
    })
    .returning();

  await db.update(projects).set({ updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(projects.id, projectId));
  return Response.json({ event }, { status: 201 });
}
