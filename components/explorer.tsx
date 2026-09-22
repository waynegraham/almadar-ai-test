"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { highlights } from "@/lib/highlights";
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
  const selectionHeading = useRef<HTMLHeadingElement>(null);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const activeHighlight = highlights.find((h) => h.regionId === selected?.id);
  const highlightIndex = highlights.findIndex((h) => h.regionId === selected?.id);
  function clearSelection() {
    setSelected(undefined);
    setNotice("");
    history.replaceState(null, "", location.pathname + location.search);
  }
  function closeSelection() {
    clearSelection();
    selectionTrigger.current?.focus({ preventScroll: true });
  }
  function openHighlight(index: number) {
    const region = all.find((r) => r.id === highlights[index].regionId);
    if (!region) return;
    setTab("regions");
    setFilter("All types");
    choose(region);
    document.getElementById("manuscript")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useEffect(() => {
    if (!selected || tab === "dataset") return;
    selectionHeading.current?.focus({ preventScroll: true });
    document.querySelector(".inspector-content")?.scrollTo({ top: 0 });
  }, [selected, tab]);
  function choose(r: Region) {
    if (!document.activeElement?.closest(".selection")) {
      selectionTrigger.current = document.activeElement as HTMLElement | null;
    }
    setNotice("");
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
    <main className="explorer min-h-screen">
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
        <nav className="header-nav" aria-label="Explorer navigation">
          {(["regions", "search", "dataset"] as const).map((section) => (
            <button
              key={section}
              className={tab === section ? "active" : ""}
              aria-current={tab === section ? "page" : undefined}
              onClick={() => {
                setTab(section);
                document
                  .querySelector(".inspector")
                  ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
            >
              {section === "regions"
                ? "Discover"
                : section === "search"
                  ? "Search"
                  : "For researchers"}
            </button>
          ))}
        </nav>
        <button className="button" onClick={() => openHighlight(0)}>
          <BookOpen size={15} /> Take a tour
        </button>
      </header>
      <section className="intro">
        <div className="intro-image" aria-hidden="true">
          <img
            src={`${data.pages[0].service}/full/!1000,1400/0/default.jpg`}
            alt=""
          />
        </div>
        <div className="intro-copy">
          <div className="eyebrow">
            Discover <span>/</span> Manuscript explorer
          </div>
          <h1>
            Discover the details.
            <br />
            Explore handwritten pages.
          </h1>
          <p>Explore six manuscript pages, examine details up close, and compare handwriting with its original transcription.</p>
          <div className="intro-actions">
            <button className="button solid" onClick={() => openHighlight(0)}>Explore three highlights <ChevronRight size={16} /></button>
            <a className="button" href="#manuscript" onClick={() => { clearSelection(); setTab("regions"); }}>Browse all six pages</a>
          </div>
        </div>
        <div className="collection-stats">
          <div>
            <b>{String(data.pages.length).padStart(2, "0")}</b>
            <span>Pages</span>
          </div>
          <div>
            <b>{blocks.length}</b>
            <span>Details</span>
          </div>
          <div>
            <b>03</b>
            <span>Languages</span>
          </div>
        </div>
      </section>
      <section className="discovery" aria-labelledby="discovery-title">
        <div className="discovery-heading">
          <div><span className="eyebrow">A TWO-MINUTE TOUR</span><h2 id="discovery-title">Start with something small.</h2></div>
          <p>No language knowledge needed. Follow these observation prompts, then share what catches your eye.</p>
        </div>
        <div className="highlight-grid">
          {highlights.map((highlight, index) => {
            const region = all.find((r) => r.id === highlight.regionId);
            const sourcePage = data.pages.find((p) => p.id === region?.pageId);
            if (!region || !sourcePage) return null;
            return <button className="highlight-card" key={highlight.regionId} onClick={() => openHighlight(index)}>
              <img src={cropUrl(sourcePage, region).replace("/max/", "/!600,360/")} alt={`Detail labelled ${region.label} on page ${sourcePage.order}`} loading="lazy" />
              <span className="highlight-copy"><span className="eyebrow">0{index + 1} / PAGE {sourcePage.order}</span><strong>{highlight.title} <ArrowUpRight size={18} /></strong><span>{highlight.description}</span></span>
            </button>;
          })}
        </div>
        <details className="sample-context">
          <summary>About this six-page sample</summary>
          <p>Explore how handwriting, headings, and stamps are recorded as individual details. Use the prompts for a classroom observation activity, compare image and text, or copy a link to discuss a discovery.</p>
          <p>The project describes the sample as Arabic, Ottoman Turkish, and Persian. Individual manuscript titles, dates, places of origin, and holding collections are not supplied in this dataset. Source labels and transcriptions are unreviewed; these prompts are not translations or historical interpretations.</p>
        </details>
      </section>
      <div className="workspace-heading">
        <h2>Explore the six-page sample</h2>
        <p>
          Arabic, Ottoman Turkish &amp; Persian <span> / </span> Six pages,
          closely read
        </p>
      </div>
      <div className="workspace" id="manuscript">
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
                  clearSelection();
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
              <span /> Zoom & explore
            </span>
          </div>
          <div className="reader-tools">
            <div className="segmented">
              <button
                className={level === "block" ? "chosen" : ""}
                onClick={() => {
                  setLevel("block");
                  clearSelection();
                }}
              >
                <Layers size={14} /> Details
              </button>
              <button
                className={level === "line" ? "chosen" : ""}
                onClick={() => {
                  setLevel("line");
                  clearSelection();
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
                  clearSelection();
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
        <aside className={`inspector ${selected && tab !== "dataset" ? "has-selection" : ""}`} onKeyDown={(event) => { if (event.key === "Escape" && selected) { event.stopPropagation(); closeSelection(); } }}>
          <div className="tabs">
            {(["regions", "search", "dataset"] as const).map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "regions"
                  ? "Discover"
                  : t === "search"
                    ? "Search"
                    : "For researchers"}
              </button>
            ))}
          </div>
          <div className="inspector-content">
            {selected && tab !== "dataset" && (
              <section className="selection" aria-labelledby="selection-heading">
                <div className="selection-title">
                  <span className="eyebrow">
                    SELECTED {selected.level === "block" ? "REGION" : "LINE"}
                  </span>
                  <button
                    aria-label="Close selection"
                    onClick={closeSelection}
                  >
                    <X size={16} />
                  </button>
                </div>
                <button className="text-button" onClick={closeSelection}>← Back to {tab === "search" ? "search results" : "all details"}</button>
                <h3 id="selection-heading" tabIndex={-1} ref={selectionHeading}>{activeHighlight?.title || `${selected.label} · Page ${page.order}`}</h3>
                {activeHighlight && <><p className="body-copy">{activeHighlight.description}</p><p className="activity-prompt">{activeHighlight.activity}</p></>}
                <img className="selection-crop" src={cropUrl(page, selected).replace("/max/", "/!800,600/")} alt={`${selected.label} detail from manuscript page ${page.order}`} />
                <h4 className="small-title">Original transcription</h4>
                <p className={selected.text ? "arabic transcription" : "body-copy"} dir={selected.text ? "rtl" : "ltr"}>
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
                    View full-size detail <ArrowUpRight size={14} />
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
                    <LinkIcon size={13} /> Share this detail
                  </button>
                </div>
                <p className="model-note">Source transcription is unreviewed. A reviewed English translation is not available for this sample.</p>
                {notice && <p role="status" className="body-copy">{notice}</p>}
                {activeHighlight && <div className="tour-navigation"><span>Highlight {highlightIndex + 1} of {highlights.length}</span><button className="button" onClick={() => highlightIndex < highlights.length - 1 ? openHighlight(highlightIndex + 1) : closeSelection()}>{highlightIndex < highlights.length - 1 ? "Next highlight →" : "Finish tour"}</button></div>}
                <details className="technical-details"><summary>Source details</summary>
                <code className="region-id">{selected.sourceId}</code></details>
              </section>
            )}

            {tab !== "dataset" && (
              <>
                <div className="panel-heading">
                  <h2>
                    {tab === "regions" ? "Discover this page" : "Find a passage"}
                  </h2>
                  <p>
                    {tab === "regions"
                      ? "Choose a detail to see its image and original text."
                      : "Search the text, or explore across languages."}
                  </p>
                </div>
                <label className="filter-label">
                  DETAIL TYPE
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
                <div className="instant-examples">
                  <p className="body-copy">Start with a detail — no model download needed:</p>
                  {highlights.map((h, i) => <button className="text-button" key={h.regionId} onClick={() => openHighlight(i)}>{h.title} <ChevronRight size={14} /></button>)}
                </div>
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
                    <strong>Experimental search across languages</strong>
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
            {notice && !selected && (
              <p role="status" className="model-note">
                {notice}
              </p>
            )}
          </div>
        </aside>
      </div>
      <footer className="site-footer">
        <span>
          <img
            src="/branding/logo-en-light.svg"
            width={240}
            height={59}
            alt="AlMadar"
          />
          <span>A window into the written past.</span>
        </span>
        <span>IIIF images · ALTO annotations · Open exploration</span>
      </footer>
    </main>
  );
}
