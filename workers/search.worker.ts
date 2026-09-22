import { pipeline, env } from "@huggingface/transformers";
env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1;
const model = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
let extractor: any;
let entries: { id: string; text: string }[] = [];
let vectors: number[][] = [];
let busy = false;
self.onmessage = async (event: MessageEvent) => {
  if (busy) return;
  busy = true;
  try {
    const { type, items, query, requestId } = event.data;
    if (type === "load") {
      extractor = await pipeline("feature-extraction", model, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: any) =>
          self.postMessage({
            type: "progress",
            message:
              p.status === "progress"
                ? `Downloading ${p.file}: ${Math.round(p.progress)}%`
                : p.status,
          }),
      });
      entries = items;
      vectors = [];
      for (let i = 0; i < entries.length; i++) {
        const out = await extractor(entries[i].text, {
          pooling: "mean",
          normalize: true,
        });
        vectors.push(Array.from(out.data) as number[]);
        self.postMessage({
          type: "progress",
          message: `Indexing passage ${i + 1} of ${entries.length}`,
        });
      }
      self.postMessage({ type: "ready", model });
    } else if (type === "search") {
      if (!extractor || vectors.length !== entries.length)
        throw Error("Search model is not ready");
      const out = await extractor(query, { pooling: "mean", normalize: true });
      const q = Array.from(out.data) as number[];
      const results = entries
        .map((e, i) => ({
          id: e.id,
          score: vectors[i].reduce((sum, v, j) => sum + v * q[j], 0),
        }))
        .sort((a, b) => b.score - a.score);
      self.postMessage({ type: "results", results, requestId });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    busy = false;
  }
};
