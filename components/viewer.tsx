"use client";
import { useEffect, useRef, useState } from "react";
import type { Page, Region } from "@/lib/data";
import { canvasId, annotationId } from "@/lib/iiif";
interface Props {
  page: Page;
  level: "block" | "line";
  selected?: Region;
  onSelect: (r: Region) => void;
  onPage: (id: string) => void;
}
export default function Viewer(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    instance = useRef<any>(null),
    api = useRef<any>(null),
    latest = useRef(props);
  const [error, setError] = useState(""),
    [ready, setReady] = useState(0);
  latest.current = props;
  useEffect(() => {
    let cancelled = false,
      unsubscribe: (() => void) | undefined,
      local: any;
    const container = document.createElement("div");
    container.id = `mirador-${crypto.randomUUID()}`;
    container.style.height = "100%";
    host.current?.appendChild(container);
    setError("");
    import("mirador")
      .then(({ default: M }) => {
        if (cancelled) return;
        api.current = M;
        local = M.viewer({
          id: container.id,
          language: "en",
          windows: [
            {
              id: "manuscript",
              manifestId: `${location.origin}/api/manifest?level=${props.level}`,
              canvasId: canvasId(location.origin, latest.current.page),
            },
          ],
          window: {
            allowClose: false,
            allowMaximize: false,
            allowTopMenuButton: false,
            allowWindowSideBar: false,
            forceDrawAnnotations: true,
            highlightAllAnnotations: true,
            sideBarOpen: false,
          },
          workspace: {
            type: "mosaic",
            showZoomControls: true,
            allowNewWindows: false,
          },
          workspaceControlPanel: { enabled: false },
          thumbnailNavigation: { defaultPosition: "off" },
          theme: {
            components: {
              MuiPaper: { styleOverrides: { root: { boxShadow: "none" } } },
            },
            typography: { fontFamily: '"Public Sans", Arial, sans-serif' },
            palette: {
              primary: { main: "#002fd3" },
              secondary: { main: "#002fd3" },
              background: { default: "#e5e6ec", paper: "#ece8e5" },
              shades: { dark: "#201f1f", main: "#ece8e5", light: "#e5e6ec" },
              annotations: {
                default: { strokeStyle: "#b79345", globalAlpha: 0.8 },
                selected: { strokeStyle: "#e06a35", globalAlpha: 1 },
                hovered: { strokeStyle: "#577e99", globalAlpha: 1 },
              },
            },
          },
          osdConfig: {
            preserveViewport: false,
            crossOriginPolicy: "Anonymous",
          },
        });
        instance.current = local;
        let lastCanvas = "",
          lastSelection = "";
        unsubscribe = local.store.subscribe(() => {
          const state = local.store.getState(),
            w = state.windows.manuscript;
          if (!w) return;
          const id = w.canvasId?.split("/").pop();
          if (id && id !== lastCanvas) {
            lastCanvas = id;
            if (id !== latest.current.page.id) latest.current.onPage(id);
          }
          if (w.selectedAnnotationId !== lastSelection) {
            lastSelection = w.selectedAnnotationId;
            const r = latest.current.page.regions.find(
              (r) => annotationId(location.origin, r) === lastSelection,
            );
            if (r && r.id !== latest.current.selected?.id)
              latest.current.onSelect(r);
          }
        });
        setReady((v) => v + 1);
      })
      .catch((e) => setError(`Viewer could not load: ${e.message}`));
    return () => {
      cancelled = true;
      unsubscribe?.();
      if (instance.current === local) instance.current = null;
      setTimeout(() => {
        local?.unmount();
        container.remove();
      }, 0);
    };
  }, [props.level]);
  useEffect(() => {
    const viewer = instance.current,
      M = api.current;
    if (!viewer || !M) return;
    const id = canvasId(location.origin, props.page);
    if (viewer.store.getState().windows.manuscript?.canvasId !== id)
      viewer.store.dispatch(M.actions.setCanvas("manuscript", id));
    if (props.selected) {
      viewer.store.dispatch(
        M.actions.selectAnnotation(
          "manuscript",
          annotationId(location.origin, props.selected),
        ),
      );
      const [x, y, w, h] = props.selected.box,
        pad = Math.max(w, h) * 0.12;
      viewer.store.dispatch(
        M.actions.updateViewport("manuscript", {
          bounds: [x - pad, y - pad, w + 2 * pad, h + 2 * pad],
        }),
      );
    } else {
      const current =
        viewer.store.getState().windows.manuscript?.selectedAnnotationId;
      if (current)
        viewer.store.dispatch(
          M.actions.deselectAnnotation("manuscript", current),
        );
    }
  }, [props.page, props.selected, ready]);
  return (
    <>
      <div ref={host} className="mirador-host" />
      {error && (
        <div className="viewer-error" role="alert">
          {error}
          <button className="button" onClick={() => location.reload()}>
            Reload viewer
          </button>
        </div>
      )}
    </>
  );
}
