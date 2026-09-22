import test from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/manuscript.json";
import { annotations, manifest } from "../lib/iiif";
import { cropUrl, lexicalSearch, normalize, type Dataset } from "../lib/data";
const dataset = data as Dataset;
test("METS order and source records remain stable", () => {
  assert.equal(dataset.pages.length, 6);
  assert.equal(dataset.pages[0].file, "00003-747-AB009300.tif");
  const regions = dataset.pages.flatMap((p) => p.regions);
  assert.equal(regions.length, 141);
  assert.equal(new Set(regions.map((r) => r.id)).size, regions.length);
  assert.equal(regions.filter((r) => r.level === "line").length, 92);
  for (const p of dataset.pages)
    for (const r of p.regions) {
      assert.equal(r.pageId, p.id);
      assert.ok(r.box.every(Number.isFinite));
      assert.ok(r.box[2] > 0 && r.box[3] > 0);
      if (r.parentId)
        assert.ok(
          p.regions.some(
            (parent) => parent.id === r.parentId && parent.level === "block",
          ),
        );
      if (r.sourceParentId) assert.equal(r.label, "Unclassified");
    }
});
test("annotations resolve to manifest canvases and preserve polygon vertices", () => {
  const base = "https://example.org",
    m = manifest(base, dataset, "line");
  for (const p of dataset.pages) {
    const a = annotations(base, p, "line");
    assert.equal(
      a.items.length,
      p.regions.filter((r) => r.level === "line").length,
    );
    for (const item of a.items)
      assert.ok(m.items.some((c) => c.id === item.target.source));
    for (const item of a.items) {
      const source = p.regions.find((r) => item.id.endsWith("#" + r.id))!;
      assert.equal(
        item.target.selector.type,
        source.polygon.length ? "SvgSelector" : "FragmentSelector",
      );
      if (source.polygon.length)
        assert.ok(
          item.target.selector.value.includes(
            source.polygon.slice(0, 2).join(","),
          ),
        );
    }
  }
});
test("search normalizes Arabic diacritics and Persian letter variants", () => {
  assert.equal(normalize("إِکْی"), "اكي");
  assert.deepEqual(lexicalSearch(dataset.pages, "   ", "block"), []);
  const r = dataset.pages
    .flatMap((p) => p.regions)
    .find((r) => r.level === "line" && r.text.includes("المصحف"))!;
  assert.ok(
    lexicalSearch(dataset.pages, "المصحف", "line").some((x) => x.id === r.id),
  );
});
test("crop rounds outward and clips to source dimensions", () => {
  const p = dataset.pages[0],
    r = {
      ...p.regions[0],
      box: [0.5, 1.2, 10.1, 20.9] as [number, number, number, number],
    };
  assert.ok(cropUrl(p, r).includes("/0,1,11,22/"));
});

test('manifest origin preserves browser host behind Next and Vercel proxies', async()=>{
 const {requestOrigin}=await import('../lib/origin');
 assert.equal(requestOrigin(new Request('http://localhost:3000/api/manifest',{headers:{host:'127.0.0.1:3000'}})),'http://127.0.0.1:3000');
 assert.equal(requestOrigin(new Request('http://localhost/api/manifest',{headers:{'x-forwarded-host':'example.vercel.app','x-forwarded-proto':'https'}})),'https://example.vercel.app');
});
