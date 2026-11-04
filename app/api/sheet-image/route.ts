import { ensureSheetsTable, sheetsDb } from "../../sheets-db";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return new Response("id é obrigatório", { status: 400 });
  const db = sheetsDb();
  await ensureSheetsTable(db);
  const row = await db.prepare("SELECT data FROM sheet_images WHERE id = ?").bind(id).first<{ data: string }>();
  if (!row) return new Response("Prancha não encontrada", { status: 404 });
  const bytes = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" },
  });
}
