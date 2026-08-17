import { desc } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { projectEvents, projects } from "../../../db/schema";

function isDsUser(email: string) {
  return email.toLowerCase().endsWith("@ds-miami.com");
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isDsUser(user.email)) return Response.json({ error: "DS_EMAIL_REQUIRED" }, { status: 403 });

  try {
    const db = getDb();
    const [projectRows, eventRows] = await Promise.all([
      db.select().from(projects).orderBy(desc(projects.updatedAt)),
      db.select().from(projectEvents).orderBy(desc(projectEvents.createdAt)),
    ]);

    return Response.json({
      user: { displayName: user.displayName, email: user.email },
      projects: projectRows.map((project) => ({
        ...project,
        events: eventRows.filter((event) => event.projectId === project.id),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar os projetos.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isDsUser(user.email)) return Response.json({ error: "DS_EMAIL_REQUIRED" }, { status: 403 });

  const payload = (await request.json()) as { name?: string; code?: string; projectType?: string };
  const name = payload.name?.trim() ?? "";
  if (!name) return Response.json({ error: "O nome do projeto é obrigatório." }, { status: 400 });

  const projectId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const db = getDb();
  const [project] = await db
    .insert(projects)
    .values({
      id: projectId,
      name,
      code: payload.code?.trim() ?? "",
      projectType: payload.projectType?.trim() || "Residential",
      createdBy: user.userId,
      createdByEmail: user.email,
    })
    .returning();

  const [event] = await db
    .insert(projectEvents)
    .values({
      id: eventId,
      projectId,
      documentType: "Projeto",
      title: "Projeto criado",
      status: "Ativo",
      notes: "Timeline iniciada no DS Project QC.",
      createdBy: user.userId,
      createdByEmail: user.email,
    })
    .returning();

  return Response.json({ project: { ...project, events: [event] } }, { status: 201 });
}
