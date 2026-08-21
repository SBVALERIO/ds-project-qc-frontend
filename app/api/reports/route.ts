import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { projectEvents, projects } from "../../../db/schema";
import { TEAM_AUTHOR, TEAM_AUTHOR_EMAIL } from "../../team-author";

export async function GET() {
  try {
    const db = getDb();
    const [projectRows, eventRows] = await Promise.all([
      db.select().from(projects).orderBy(desc(projects.updatedAt)),
      db.select().from(projectEvents).orderBy(desc(projectEvents.createdAt)),
    ]);
    const projectById = new Map(projectRows.map((project) => [project.id, project]));
    const entries = eventRows.map((event) => {
      const project = projectById.get(event.projectId);
      const isCorrection = event.documentType === "Correção" || event.status === "Correções pendentes";
      const isUpload = event.status === "Carregado" || ["Project Package", "Shop Drawings", "Material List", "Budget / RFQ"].includes(event.documentType);
      return {
        id: event.id,
        projectId: event.projectId,
        projectName: project?.name ?? "Projeto removido",
        projectCode: project?.code ?? "",
        documentType: event.documentType,
        title: event.title,
        revision: event.revision,
        status: event.status,
        notes: event.notes,
        actorEmail: event.createdByEmail,
        createdAt: event.createdAt,
        isCorrection,
        isUpload,
      };
    });

    return Response.json({
      admin: { email: TEAM_AUTHOR_EMAIL, displayName: TEAM_AUTHOR },
      summary: {
        projects: projectRows.length,
        uploads: entries.filter((entry) => entry.isUpload).length,
        corrections: entries.filter((entry) => entry.isCorrection).length,
        contributors: new Set(entries.map((entry) => entry.actorEmail)).size,
      },
      projects: projectRows.map((project) => ({ id: project.id, name: project.name })),
      entries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar o relatório.";
    return Response.json({ error: message }, { status: 500 });
  }
}
