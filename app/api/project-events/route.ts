import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { projectEvents, projects } from "../../../db/schema";

function isDsUser(email: string) {
  return email.toLowerCase().endsWith("@ds-miami.com");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isDsUser(user.email)) return Response.json({ error: "DS_EMAIL_REQUIRED" }, { status: 403 });

  const payload = (await request.json()) as {
    projectId?: string;
    documentType?: string;
    title?: string;
    revision?: string;
    status?: string;
    notes?: string;
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
      createdBy: user.userId,
      createdByEmail: user.email,
    })
    .returning();

  await db.update(projects).set({ updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(projects.id, projectId));
  return Response.json({ event }, { status: 201 });
}
