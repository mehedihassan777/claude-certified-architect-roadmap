import { handle, json, readJsonBody } from "@/lib/api/http";
import { PatchBodySchema } from "@/lib/progress/schema";
import { serverDeps } from "@/lib/progress/server";
import { updateProgress } from "@/lib/progress/service";

export function GET(request: Request): Promise<Response> {
  return handle(request, async () => {
    const { store } = serverDeps();
    const { data, version } = await store.read();
    return json({ progress: data, version });
  });
}

export function PATCH(request: Request): Promise<Response> {
  return handle(
    request,
    async () => {
      const { ops } = await readJsonBody(request, PatchBodySchema);
      const saved = await updateProgress(ops, serverDeps());
      return json({ progress: saved.data, version: saved.version });
    },
    { mutating: true },
  );
}
