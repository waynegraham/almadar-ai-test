# Almadar Manuscript Explorer

A read-only research demo built with Next.js App Router, React, TypeScript, Tailwind CSS 4, Mirador 4, and Transformers.js. Six manuscript pages are streamed from the public IIIF Image API; their eScriptorium ALTO exports supply 49 regions and 92 lines.

## Run locally

Use Node.js 24.

```sh
npm ci
npm run dev -- --port 3000
```

Open http://localhost:3000. For a production preview:

```sh
npm run build
npm start -- --port 3000
```

If installation detects an incompatible system libvips on macOS, use `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci`.

## Deploy to Vercel

Push this repository to GitHub, then import it into Vercel. Select the Next.js preset and keep the default build command (`npm run build`). No database, API keys, or environment variables are required. The generated `public/data/manuscript.json` must be committed; local TIFFs and XMLs are excluded by `.gitignore` and are not needed at deployment time. Images remain on the IIIF server. Next.js route handlers generate absolute manifest and annotation URLs for the request origin, including preview deployments.

## Using the explorer

- Choose a page, then switch between region and line overlays.
- Click an outline or a list entry to inspect the original transcription and zoom to its bounds.
- Filter the inspection list by source region type. All overlays remain visible for context.
- Open a IIIF crop, or copy a stable link to a selected region.
- Search original text without downloading a model. Arabic diacritics and common Persian letter variants are normalized only for matching; source text is unchanged.
- Optionally download the quantized multilingual MiniLM embedding model to search with English questions. Model assets are downloaded from Hugging Face, cached by the browser, and inference runs locally in a Web Worker using WASM. This can take several hundred MB and indexing may take time. Cancellation terminates the worker; partial assets may remain cached. Download/runtime errors preserve ordinary text search.
- Export a JSON dataset with original IDs, parent relationships, labels, source text, confidence, polygons, bounding boxes, and IIIF crop URLs.

## Data preparation

With original files in `images/`, run:

```sh
npm run prepare:data
npm test
npm run typecheck
```

The converter uses `images/METS.xml` for page order. `IIIF_BASE_URL` can override the image-service prefix during conversion; supply a trailing slash. The default is `https://iiif-staging-almadar.biennale.org.sa/iiif/3/`.

ALTO dimensions are original pixel coordinates. All six image dimensions and public CORS headers were verified against `info.json` during development. Polygon shapes are preserved, with rectangular selectors only where the export lacks polygons. Crop URLs round outward to include the full rectangle. Polygons remain available for downstream masking.

Some ALTO `eSc_dummyblock_` elements have no geometry. Their lines are retained as `Unclassified`, with `sourceParentId` preserving provenance. No synthetic block or region type is inferred. OCR confidence is the mean of available String confidence values, not human validation. Source text and labels are unreviewed. Corrections should be made in eScriptorium and reimported.

Routes:

- `/api/manifest?level=block` or `level=line`: IIIF Presentation 3 manifest.
- `/api/annotations/<page-id>?level=block` or `level=line`: Web Annotations.
- `/data/manuscript.json`: normalized source data.

## AI scope and next steps

Semantic search is an experiment, not validated manuscript understanding. The model is `Xenova/paraphrase-multilingual-MiniLM-L12-v2`; Arabic and Persian retrieval need assessment on these OCR passages, and Ottoman Turkish is not a validated target. Long blocks can exceed the model context; line mode provides finer retrieval units. Similarity scores are rankings, not probabilities of correctness. English questions retrieve source evidence; the app does not generate answers or translations.

Translation is deliberately not fabricated. Evaluate a translation model with language-labelled examples and human reference translations, especially for Ottoman Turkish, before enabling it. NLLB is one candidate for Arabic/Persian experiments but has substantial downloads and a noncommercial license; it is not bundled here. Do not silently treat Ottoman Turkish as modern Turkish.

For region classification, export crops plus source labels and review the taxonomy. Separate orphan/unclassified lines and empty transcriptions. Build a larger reviewed collection and split evaluation by manuscript, not randomly by lines, to prevent leakage. This six-page sample is sufficient to demonstrate exports, not train or evaluate a dependable classifier.

For region-grounded question answering, retrieve lines, retain their parent regions and page IDs, then supply those passages to an evaluated generation model. Require citations to region links, abstention when evidence is missing, and separation of original text from model output. Preserve model version and provenance in a separate output record.

## Validation

`npm test` checks page order, stable IDs, parent links, annotation targets, polygon/fallback selectors, text normalization, and crop geometry. `npm run build` checks the production bundle and TypeScript. Model downloads require internet access and may be blocked by browser settings or network policy.
