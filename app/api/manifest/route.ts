import { requestOrigin } from "@/lib/origin";
import data from "@/public/data/manuscript.json";
import { manifest } from "@/lib/iiif";
export function GET(request: Request) {
  const url = new URL(request.url);
  return Response.json(
    manifest(
      requestOrigin(request),
      data as import("@/lib/data").Dataset,
      url.searchParams.get("level") === "line" ? "line" : "block",
    ),
  );
}
