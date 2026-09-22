import type { Dataset, Page, Region } from "./data";
export const canvasId = (base: string, p: Page) =>
  `${base}/api/manifest/canvas/${p.id}`;
export const annotationId = (base: string, r: Region) =>
  `${base}/api/annotations/${r.pageId}#${r.id}`;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function annotations(base: string, page: Page, level: "block" | "line") {
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `${base}/api/annotations/${page.id}?level=${level}`,
    type: "AnnotationPage",
    items: page.regions
      .filter((r) => r.level === level)
      .map((r) => ({
        id: annotationId(base, r),
        type: "Annotation",
        motivation: "commenting",
        body: {
          type: "TextualBody",
          value: `<strong>${escape(r.label)}</strong><p dir="rtl">${escape(r.text || "No transcription")}</p>`,
          format: "text/html",
        },
        target: {
          type: "SpecificResource",
          source: canvasId(base, page),
          selector: r.polygon.length
            ? {
                type: "SvgSelector",
                value: `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="${r.polygon
                  .reduce<string[]>((a, v, i) => {
                    if (i % 2 === 0) a.push(`${v},${r.polygon[i + 1]}`);
                    return a;
                  }, [])
                  .join(" ")}" /></svg>`,
              }
            : {
                type: "FragmentSelector",
                conformsTo: "http://www.w3.org/TR/media-frags/",
                value: `xywh=${r.box.join(",")}`,
              },
        },
      })),
  };
}
export function manifest(base: string, data: Dataset, level: "block" | "line") {
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `${base}/api/manifest?level=${level}`,
    type: "Manifest",
    label: { en: [data.title] },
    viewingDirection: "right-to-left",
    items: data.pages.map((p) => ({
      id: canvasId(base, p),
      type: "Canvas",
      label: { en: [`Page ${p.order}`] },
      width: p.width,
      height: p.height,
      thumbnail: [
        {
          id: `${p.service}/full/!180,240/0/default.jpg`,
          type: "Image",
          format: "image/jpeg",
        },
      ],
      items: [
        {
          id: `${base}/painting/${p.id}`,
          type: "AnnotationPage",
          items: [
            {
              id: `${base}/painting/${p.id}/image`,
              type: "Annotation",
              motivation: "painting",
              target: canvasId(base, p),
              body: {
                id: `${p.service}/full/max/0/default.jpg`,
                type: "Image",
                format: "image/jpeg",
                width: p.width,
                height: p.height,
                service: [
                  { id: p.service, type: "ImageService3", profile: "level2" },
                ],
              },
            },
          ],
        },
      ],
      annotations: [
        {
          id: `${base}/api/annotations/${p.id}?level=${level}`,
          type: "AnnotationPage",
        },
      ],
    })),
  };
}
