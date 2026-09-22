import test from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/manuscript.json";
import type { Dataset } from "../lib/data";
import { highlights } from "../lib/highlights";

test("tour destinations retain the source evidence described in their prompts", () => {
  const regions = (data as Dataset).pages.flatMap((page) => page.regions);
  const targets = highlights.map((highlight) => {
    const target = regions.find((region) => region.id === highlight.regionId);
    assert.ok(target, `Missing tour destination: ${highlight.title}`);
    assert.equal(target.level, "block");
    return target;
  });
  assert.deepEqual(targets.map((target) => target.label), ["Title", "Stamp", "Main"]);
  assert.equal(targets[1].text, "");
  assert.ok(targets[2].text.trim(), "Comparison activity needs a transcription");
  assert.equal(new Set(targets.map((target) => target.pageId)).size, 3);
});
