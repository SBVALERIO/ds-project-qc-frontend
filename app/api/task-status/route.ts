import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { taskStatuses } from "../../../db/schema";

const VALID_STATUSES = new Set(["Pendente", "Corrigido", "Irrelevante"]);

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    eventId?: string;
    findingId?: number;
    status?: string;
    reason?: string;
  };

  const eventId = payload.eventId?.trim() ?? "";
  const findingId = payload.findingId;
  const status = payload.status?.trim() ?? "";
  const reason = payload.reason?.trim() ?? "";

  if (!eventId || typeof findingId !== "number" || !VALID_STATUSES.has(status)) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (status === "Irrelevante" && !reason) {
    return Response.json({ error: "Motivo é obrigatório pra marcar como irrelevante." }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .insert(taskStatuses)
    .values({ id: crypto.randomUUID(), eventId, findingId, status, reason })
    .onConflictDoUpdate({
      target: [taskStatuses.eventId, taskStatuses.findingId],
      set: { status, reason, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .returning();

  return Response.json({ taskStatus: row });
}
