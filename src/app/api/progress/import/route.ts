import { handle, json, readJsonBody } from "@/lib/api/http";
import { ProgressSchema } from "@/lib/progress/schema";
import { serverDeps } from "@/lib/progress/server";
import { replaceProgress } from "@/lib/progress/service";

/** Validated full replace. Reset uses it too, with an empty document. */
export function POST(request: Request): Promise<Response> {
  return handle(
    request,
    async () => {
      const data = await readJsonBody(request, ProgressSchema);
      const saved = await replaceProgress(data, serverDeps());
      return json({ progress: saved.data, version: saved.version, orphans: saved.orphans });
    },
    { mutating: true },
  );
}
