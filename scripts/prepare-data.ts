import { XMLParser } from "fast-xml-parser";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
import type { Dataset, Page, Region } from "../lib/data";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseAttributeValue: false,
});
const arr = <T>(x: T | T[] | undefined): T[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];
const mets = parser.parse(readFileSync("images/METS.xml", "utf8")).mets;
const files = new Map<string, string>();
for (const group of arr<any>(mets.fileSec.fileGrp))
  for (const f of arr<any>(group.file)) files.set(f.ID, f.FLocat.href);
const pages: Page[] = [];
for (const [index, div] of arr<any>(mets.structMap.div.div).entries()) {
  const names = arr<any>(div.fptr).map((f) => files.get(f.FILEID)!);
  const file = names.find((n) => /\.tiff?$/i.test(n))!,
    xml = names.find((n) => /\.xml$/i.test(n))!;
  if (!file || !xml || basename(file) !== file || basename(xml) !== xml)
    throw Error("Invalid METS paths");
  const alto = parser.parse(readFileSync(`images/${xml}`, "utf8")).alto;
  if (alto.Description.MeasurementUnit !== "pixel")
    throw Error("Only pixel ALTO coordinates supported");
  const source = alto.Layout.Page,
    id = file.replace(/\.tiff?$/i, "");
  const tags = new Map(
    arr<any>(alto.Tags.OtherTag).map((t) => [t.ID, t.LABEL]),
  );
  const page: Page = {
    id,
    file,
    order: index + 1,
    width: Number(source.WIDTH),
    height: Number(source.HEIGHT),
    service: `${process.env.IIIF_BASE_URL || "https://iiif-staging-almadar.biennale.org.sa/iiif/3/"}${encodeURIComponent(file)}`,
    regions: [],
  };
  const make = (
    node: any,
    level: Region["level"],
    label: string,
    parentId?: string,
  ): Region => {
    const strings =
      level === "line"
        ? arr<any>(node.String)
        : arr<any>(node.TextLine).flatMap((l) => arr<any>(l.String));
    const conf = strings
      .filter((s) => s.WC !== undefined)
      .map((s) => Number(s.WC));
    const box = [node.HPOS, node.VPOS, node.WIDTH, node.HEIGHT].map(
      Number,
    ) as Region["box"];
    if (box.some((v) => !Number.isFinite(v)) || box[2] <= 0 || box[3] <= 0)
      throw Error(`Bad coordinates ${node.ID}`);
    const polygon = String(node.Shape?.Polygon?.POINTS || "")
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (polygon.length % 2 || polygon.some((n) => !Number.isFinite(n)))
      throw Error(`Bad polygon ${node.ID}`);
    return {
      id: `${id}--${node.ID}`,
      sourceId: node.ID,
      pageId: id,
      parentId,
      level,
      label,
      box,
      polygon,
      text: strings
        .map((s) => s.CONTENT || "")
        .filter(Boolean)
        .join(level === "block" ? "\n" : " "),
      ...(conf.length
        ? { confidence: conf.reduce((a, b) => a + b, 0) / conf.length }
        : {}),
      ...(node.BASELINE ? { baseline: node.BASELINE } : {}),
    };
  };
  for (const block of arr<any>(source.PrintSpace.TextBlock)) {
    const label =
      String(block.TAGREFS || "")
        .split(" ")
        .map((t) => tags.get(t))
        .find(Boolean) || "Unclassified";
    if (block.HPOS === undefined) {
      for (const line of arr<any>(block.TextLine))
        page.regions.push({
          ...make(line, "line", "Unclassified"),
          sourceParentId: block.ID,
        });
      continue;
    }
    const region = make(block, "block", label);
    page.regions.push(region);
    for (const line of arr<any>(block.TextLine))
      page.regions.push(make(line, "line", label, region.id));
  }
  pages.push(page);
}
const dataset: Dataset = {
  schemaVersion: 1,
  title: "Almadar Manuscript Explorer",
  pages,
};
mkdirSync("public/data", { recursive: true });
writeFileSync(
  "public/data/manuscript.json",
  JSON.stringify(dataset, null, 2) + "\n",
);
console.log(
  `Prepared ${pages.length} pages, ${pages.flatMap((p) => p.regions).length} regions and lines.`,
);
