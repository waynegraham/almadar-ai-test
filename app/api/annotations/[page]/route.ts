import { requestOrigin } from "@/lib/origin";
import data from "@/public/data/manuscript.json";
import { annotations } from "@/lib/iiif";
import type { Dataset } from "@/lib/data";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params,
    url = new URL(request.url);
  const found = (data as Dataset).pages.find((p) => p.id === page);
  return found
    ? Response.json(
        annotations(
          requestOrigin(request),
          found,
          url.searchParams.get("level") === "line" ? "line" : "block",
        ),
      )
    : Response.json({ error: "Page not found" }, { status: 404 });
}
