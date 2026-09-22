"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  Download,
  Search,
  Layers,
  ScanLine,
  Sparkles,
  BookOpen,
  ChevronRight,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { cropUrl, lexicalSearch, type Dataset, type Region } from "@/lib/data";
const Viewer = dynamic(() => import("./viewer"), {
  ssr: false,
  loading: () => (
    <div className="viewer-loading">Opening manuscript viewer…</div>
  ),
});
const palette: Record<string, string> = {
  Main: "#59775e",
  Title: "#a97534",
  Commentary: "#816e99",
  Illustration: "#b17764",
  Stamp: "#ad5353",
  Note: "#608697",
  Unclassified: "#929087",
};
export default function Explorer({ data }: { data: Dataset }) {
  const [pageIndex, setPageIndex] = useState(0),
    [level, setLevel] = useState<"block" | "line">("block");
  const [selected, setSelected] = useState<Region>(),
    [filter, setFilter] = useState("All types");
  const [tab, setTab] = useState<"regions" | "search" | "dataset">("regions");
  const [query, setQuery] = useState(""),
    [searched, setSearched] = useState(""),
    [semanticResults, setSemanticResults] = useState(false),
    [results, setResults] = useState<{ region: Region; score?: number }[]>([]);
  const [ai, setAi] = useState<"off" | "loading" | "ready" | "error">("off"),
    [status, setStatus] = useState(""),
    [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const worker = useRef<Worker | null>(null),
    requestId = useRef(0);
  const page = data.pages[pageIndex],
    all = data.pages.flatMap((p) => p.regions),
    blocks = all.filter((r) => r.level === "block");
  function choose(r: Region) {
    setPageIndex(data.pages.findIndex((p) => p.id === r.pageId));
    setLevel(r.level);
    setSelected(r);
    history.replaceState(null, "", `#${encodeURIComponent(r.id)}`);
  }
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    const r = data.pages.flatMap((p) => p.regions).find((r) => r.id === id);
    if (r) {
      setSelected(r);
      setPageIndex(data.pages.findIndex((p) => p.id === r.pageId));
      setLevel(r.level);
    }
    return () => worker.current?.terminate();
  }, [data]);
  function enableAI() {
    worker.current?.terminate();
    setAi("loading");
    setStatus("Preparing optional model download…");
    const w = new Worker(
      new URL("../workers/search.worker.ts", import.meta.url),
    );
    worker.current = w;
    w.onmessage = ({ data: message }) => {
      if (message.type === "progress") setStatus(message.message);
      if (message.type === "ready") {
        setAi("ready");
        setStatus("Multilingual search is ready.");
      }
      if (
        message.type === "results" &&
        message.requestId === requestId.current
      ) {
        setResults(
          message.results.map((x: { id: string; score: number }) => ({
            region: all.find((r) => r.id === x.id)!,
            score: x.score,
          })),
        );
        setSearching(false);
      }
      if (message.type === "error") {
        setAi("error");
        setStatus(message.message);
        setSearching(false);
      }
    };
    w.onerror = () => {
      setAi("error");
      setStatus(
        "The browser model could not start. Text search is still available.",
      );
      setSearching(false);
    };
    w.postMessage({
      type: "load",
      items: all
        .filter((r) => r.text.trim())
        .map((r) => ({ id: r.id, text: r.text })),
    });
  }
  function search() {
    if (!query.trim() || searching) return;
    setSearched(query.trim());
    setSemanticResults(ai === "ready");
    if (ai === "ready") {
      setSearching(true);
      worker.current?.postMessage({
        type: "search",
        query: query.trim(),
        requestId: ++requestId.current,
      });
    } else
      setResults(
        lexicalSearch(data.pages, query, "block")
          .concat(lexicalSearch(data.pages, query, "line"))
          .map((region) => ({ region })),
      );
  }
  function download() {
    const value = {
      ...data,
      provenance: {
        source: "eScriptorium ALTO export",
        coordinates: "Original image pixels",
        reviewStatus: "Unreviewed source annotations",
        languages: ["Arabic", "Ottoman Turkish", "Persian"],
      },
      pages: data.pages.map((p) => ({
        ...p,
        regions: p.regions.map((r) => ({ ...r, cropUrl: cropUrl(p, r) })),
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "almadar-regions.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const visible = page.regions.filter(
    (r) => r.level === level && (filter === "All types" || r.label === filter),
  );
  const visibleResults = results
    .filter(
      (x) =>
        x.region.level === level &&
        (filter === "All types" || x.region.label === filter),
    )
    .slice(0, 20);
  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#263c36]">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Almadar home">
          <img
            className="brand-logo"
            src="/branding/logo-en-light.svg"
            width={240}
            height={59}
            alt="AlMadar"
          />
          <span className="brand-sub">MANUSCRIPT EXPLORER</span>
        </a>
        <div className="header-caption">A closer reading of the collection</div>
        <button className="button" onClick={download}>
          <Download size={15} /> Export dataset
        </button>
      </header>
      <section className="intro">
        <div>
          <div className="eyebrow">
            THE DIGITAL READING ROOM <span> / </span> MANUSCRIPT 01
          </div>
          <h1>Between the lines.</h1>
          <p>Explore the page. Discover its structure. Follow the text.</p>
        </div>
        <div className="collection-stats">
          <div>
            <b>06</b>
            <span>Pages</span>
          </div>
          <div>
            <b>{blocks.length}</b>
            <span>Regions</span>
          </div>
          <div>
            <b>03</b>
            <span>Languages</span>
          </div>
        </div>
      </section>
      <div className="workspace">
        <aside className="pages">
          <div className="section-label">
            <BookOpen size={14} /> THE MANUSCRIPT
          </div>
          <div className="page-list">
            {data.pages.map((p, i) => (
              <button
                key={p.id}
                className={`page-card ${i === pageIndex ? "active" : ""}`}
                onClick={() => {
                  setPageIndex(i);
                  setSelected(undefined);
                  history.replaceState(null, "", location.pathname);
                }}
                aria-pressed={i === pageIndex}
              >
                <div className="thumbnail">
                  <img
                    src={`${p.service}/full/!180,240/0/default.jpg`}
                    alt={`Manuscript page ${p.order}`}
                    loading="lazy"
                  />
                </div>
                <span>
                  Page {String(p.order).padStart(2, "0")}
                  <span className="page-dot" />
                </span>
              </button>
            ))}
          </div>
          <div className="pages-foot">
            Arabic · Ottoman Turkish
            <br />
            Persian
          </div>
        </aside>
        <section className="reader">
          <div className="reader-heading">
            <div>
              <span className="eyebrow">MANUSCRIPT VIEW</span>
              <h2>Page {String(page.order).padStart(2, "0")}</h2>
            </div>
            <span className="iiif-badge">
              <span /> IIIF viewer
            </span>
          </div>
          <div className="reader-tools">
            <div className="segmented">
              <button
                className={level === "block" ? "chosen" : ""}
                onClick={() => {
                  setLevel("block");
                  setSelected(undefined);
                }}
              >
                <Layers size={14} /> Regions
              </button>
              <button
                className={level === "line" ? "chosen" : ""}
                onClick={() => {
                  setLevel("line");
                  setSelected(undefined);
                }}
              >
                <ScanLine size={14} /> Lines
              </button>
            </div>
            <span className="tool-hint">Select an outline to inspect</span>
          </div>
          <div className="viewer-wrap">
            <Viewer
              page={page}
              level={level}
              selected={selected}
              onSelect={choose}
              onPage={(id) => {
                const i = data.pages.findIndex((p) => p.id === id);
                if (i >= 0) {
                  setPageIndex(i);
                  setSelected(undefined);
                }
              }}
            />
          </div>
          <div className="reader-footer">
            <span>{page.file}</span>
            <span>
              {page.width.toLocaleString()} × {page.height.toLocaleString()} px
            </span>
          </div>
        </section>
        <aside className="inspector">
          <div className="tabs">
            {(["regions", "search", "dataset"] as const).map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "regions"
                  ? "Explore"
                  : t === "search"
                    ? "Search"
                    : "Dataset"}
              </button>
            ))}
          </div>
          <div className="inspector-content">
            {tab !== "dataset" && (
              <>
                <div className="panel-heading">
                  <h2>
                    {tab === "regions" ? "Anatomy of a page" : "Find a passage"}
                  </h2>
                  <p>
                    {tab === "regions"
                      ? "The annotations behind the manuscript."
                      : "Search the text, or explore across languages."}
                  </p>
                </div>
                <label className="filter-label">
                  REGION TYPE
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {["All types", ...Object.keys(palette)].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {tab === "search" && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    search();
                  }}
                  className="search-form"
                >
                  <input
                    aria-label="Search passages"
                    placeholder={
                      ai === "ready"
                        ? "Ask in English…"
                        : "Search original text…"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    aria-label="Run search"
                    disabled={searching || !query.trim()}
                  >
                    <Search size={18} />
                  </button>
                </form>
                <div className="ai-card">
                  <Sparkles size={18} />
                  <div>
                    <strong>Read across languages</strong>
                    <p>
                      Optional browser AI matches English queries to source
                      passages. Results are experimental, especially for Ottoman
                      Turkish.
                    </p>
                    {ai === "off" || ai === "error" ? (
                      <button className="text-button" onClick={enableAI}>
                        Download search model <ArrowUpRight size={13} />
                      </button>
                    ) : null}
                    <p className="model-note">
                      Multilingual MiniLM · several hundred MB · runs locally
                    </p>
                    {status && <p role="status">{status}</p>}
                    {ai === "loading" && (
                      <button
                        className="text-button"
                        onClick={() => {
                          worker.current?.terminate();
                          setAi("off");
                          setStatus("Download stopped.");
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                <div className="result-count">
                  {searching
                    ? "Finding passages…"
                    : searched
                      ? `${visibleResults.length} ${semanticResults ? "ranked passages" : "matches"} for “${searched}”`
                      : "Try a word from the transcription, or enable AI."}
                </div>
                {visibleResults.map(({ region: r, score }) => (
                  <button
                    className="region-row"
                    key={r.id}
                    onClick={() => choose(r)}
                  >
                    <span className="row-top">
                      <span
                        className="type-label"
                        style={{ color: palette[r.label] }}
                      >
                        {r.label}
                      </span>
                      <span>
                        Page {data.pages.find((p) => p.id === r.pageId)?.order}
                        {score !== undefined
                          ? ` · similarity ${score.toFixed(2)}`
                          : ""}
                      </span>
                    </span>
                    <span className="arabic snippet" dir="rtl">
                      {r.text}
                    </span>
                  </button>
                ))}
                {searched && !searching && !visibleResults.length && (
                  <p className="empty">
                    No matching passages. Try another term or switch between
                    regions and lines.
                  </p>
                )}
                {ai === "ready" && (
                  <p className="model-note">
                    Rankings are similarity scores, not answer confidence. Click
                    a result to inspect its evidence.
                  </p>
                )}
              </>
            )}
            {tab === "regions" && (
              <>
                <div className="legend">
                  {Object.entries(palette).map(([label, color]) => (
                    <span key={label}>
                      <i style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                </div>
                <div className="result-count">
                  {visible.length} {level === "block" ? "regions" : "lines"} on
                  this page
                </div>
                <div className="region-list">
                  {visible.map((r, i) => (
                    <button
                      key={r.id}
                      className={`region-row ${selected?.id === r.id ? "selected" : ""}`}
                      onClick={() => choose(r)}
                    >
                      <span className="row-top">
                        <span className="type-label">
                          <i style={{ background: palette[r.label] }} />
                          {r.label}
                        </span>
                        <span>
                          {String(i + 1).padStart(2, "0")}{" "}
                          <ChevronRight size={13} />
                        </span>
                      </span>
                      <span
                        className={`snippet ${r.text ? "arabic" : ""}`}
                        dir={r.text ? "rtl" : "ltr"}
                      >
                        {r.text || "No transcription available"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {tab === "dataset" && (
              <>
                <div className="panel-heading">
                  <h2>From page to dataset</h2>
                  <p>Traceable examples for the next stage of research.</p>
                </div>
                <div className="dataset-card">
                  <Layers size={24} />
                  <h3>{blocks.length} labelled regions</h3>
                  <p>
                    {all.length - blocks.length} text lines · 6 source pages
                  </p>
                  <button className="button solid" onClick={download}>
                    <Download size={15} /> Download JSON
                  </button>
                </div>
                <h3 className="small-title">Included in every example</h3>
                <ul className="dataset-list">
                  <li>Original ALTO ID and parent region</li>
                  <li>Region type and source transcription</li>
                  <li>Pixel bounds and polygon coordinates</li>
                  <li>IIIF image crop URL and page reference</li>
                  <li>OCR confidence, where available</li>
                </ul>
                <h3 className="small-title">A research starting point</h3>
                <p className="body-copy">
                  Use crops and labels to develop region classifiers. Link
                  retrieved passages to stable region IDs for evidence-based
                  question answering. Six pages demonstrate the workflow;
                  evaluate on additional manuscripts before training
                  conclusions.
                </p>
                <p className="body-copy">
                  Source annotations remain unchanged. Corrections belong in
                  eScriptorium and can be imported again.
                </p>
                <a
                  className="text-button"
                  href="/api/manifest?level=block"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open IIIF manifest <ArrowUpRight size={14} />
                </a>
              </>
            )}
            {selected && tab !== "dataset" && (
              <section className="selection">
                <div className="selection-title">
                  <span className="eyebrow">
                    SELECTED {selected.level === "block" ? "REGION" : "LINE"}
                  </span>
                  <button
                    aria-label="Close selection"
                    onClick={() => setSelected(undefined)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <h3>{selected.label}</h3>
                <p className="arabic transcription" dir="rtl">
                  {selected.text || "No transcription available"}
                </p>
                {selected.confidence !== undefined && (
                  <p className="model-note">
                    Mean OCR confidence:{" "}
                    {(selected.confidence * 100).toFixed(1)}% · not human
                    verification
                  </p>
                )}
                <div className="selection-actions">
                  <a
                    className="text-button"
                    href={cropUrl(page, selected)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open image crop <ArrowUpRight size={14} />
                  </a>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${location.origin}/#${encodeURIComponent(selected.id)}`,
                        );
                        setNotice("Region link copied.");
                      } catch {
                        setNotice("Copy the region link from the address bar.");
                      }
                    }}
                  >
                    <LinkIcon size={13} /> Copy link
                  </button>
                </div>
                <div className="translation-note">
                  <strong>English translation</strong>
                  <p>
                    Not yet generated. Browser translation for these historical
                    languages requires evaluation; original text is preserved
                    above.
                  </p>
                </div>
                <code className="region-id">{selected.sourceId}</code>
              </section>
            )}
            {notice && (
              <p role="status" className="model-note">
                {notice}
              </p>
            )}
          </div>
        </aside>
      </div>
      <footer className="site-footer">
        <span>
          ALMADAR <span className="footer-divider">/</span> A window into the
          written past.
        </span>
        <span>IIIF images · ALTO annotations · Open exploration</span>
      </footer>
    </main>
  );
}
