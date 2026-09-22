export interface Region {
  id: string;
  sourceId: string;
  pageId: string;
  parentId?: string;
  sourceParentId?: string;
  level: "block" | "line";
  label: string;
  text: string;
  box: [number, number, number, number];
  polygon: number[];
  confidence?: number;
  baseline?: string;
}
export interface Page {
  id: string;
  file: string;
  order: number;
  width: number;
  height: number;
  service: string;
  regions: Region[];
}
export interface Dataset {
  title: string;
  schemaVersion: number;
  pages: Page[];
}
export function cropUrl(page: Page, region: Region) {
  const [x, y, w, h] = region.box;
  const left = Math.max(0, Math.floor(x)),
    top = Math.max(0, Math.floor(y));
  const width = Math.min(page.width, Math.ceil(x + w)) - left;
  const height = Math.min(page.height, Math.ceil(y + h)) - top;
  return `${page.service}/${left},${top},${width},${height}/max/0/default.jpg`;
}
export function normalize(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ی/g, "ي")
    .replace(/ک/g, "ك");
}
export function lexicalSearch(
  pages: Page[],
  query: string,
  level: Region["level"],
) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return pages
    .flatMap((p) => p.regions)
    .filter(
      (r) =>
        r.level === level && terms.every((t) => normalize(r.text).includes(t)),
    );
}
