import { handle } from "@/lib/api/http";
import { serverDeps } from "@/lib/progress/server";
import { serializeProgress } from "@/lib/storage/codec";

export function GET(request: Request): Promise<Response> {
  return handle(request, async () => {
    const { data } = await (await serverDeps()).store.read();
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(serializeProgress(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="cca-f-progress-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
