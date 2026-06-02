"use client";

import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;
const ZOOM_STEP = 1.25;
const VIEWPORT_FILL = 0.75;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function computeDefaultZoom(options: {
  pixelWidth: number;
  pixelHeight: number;
  displayWidth?: number;
  displayHeight?: number;
  viewportWidth: number;
  viewportHeight: number;
}): number {
  const { pixelWidth, pixelHeight, displayWidth, displayHeight } = options;
  if (pixelWidth <= 0 || pixelHeight <= 0) {
    return 1;
  }

  // Match how large the sprite appears in the game preview.
  if (displayWidth && displayHeight && displayWidth > 0 && displayHeight > 0) {
    const zoomW = displayWidth / pixelWidth;
    const zoomH = displayHeight / pixelHeight;
    const gameZoom = Math.max(zoomW, zoomH);
    if (gameZoom >= 1) {
      return clampZoom(gameZoom);
    }
  }

  const padding = 48;
  const availableW = Math.max(1, options.viewportWidth - padding);
  const availableH = Math.max(1, options.viewportHeight - padding);
  const fillZoom = Math.min(
    (availableW * VIEWPORT_FILL) / pixelWidth,
    (availableH * VIEWPORT_FILL) / pixelHeight,
  );

  if (fillZoom > 1) {
    return clampZoom(Math.floor(fillZoom));
  }

  return 1;
}

export interface AssetPreviewZoomProps {
  src: string;
  alt: string;
  resetKey: string;
  sourceWidth?: number;
  sourceHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
  overlay?: ReactNode;
}

export function AssetPreviewZoom({
  src,
  alt,
  resetKey,
  sourceWidth,
  sourceHeight,
  displayWidth,
  displayHeight,
  overlay,
}: AssetPreviewZoomProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const defaultZoomAppliedForKey = useRef<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const baseScale =
    naturalSize.w > 0 && sourceWidth ? sourceWidth / naturalSize.w : 1;

  const pixelWidth = naturalSize.w * baseScale;
  const pixelHeight = naturalSize.h * baseScale;
  const displayW = Math.round(pixelWidth * zoom);
  const displayH = Math.round(pixelHeight * zoom);

  const scrollViewportToStart = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }, []);

  const applySourcePixelView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    scrollViewportToStart();
  }, [scrollViewportToStart]);

  const applyDefaultView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || pixelWidth <= 0 || pixelHeight <= 0) {
      applySourcePixelView();
      return;
    }

    const nextZoom = computeDefaultZoom({
      pixelWidth,
      pixelHeight,
      displayWidth,
      displayHeight,
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
    });

    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
    scrollViewportToStart();
  }, [
    applySourcePixelView,
    displayHeight,
    displayWidth,
    pixelHeight,
    pixelWidth,
    scrollViewportToStart,
  ]);

  useEffect(() => {
    defaultZoomAppliedForKey.current = null;
    setNaturalSize({ w: 0, h: 0 });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [resetKey]);

  const onImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    },
    [],
  );

  useEffect(() => {
    if (naturalSize.w <= 0) {
      return;
    }

    const tryApplyDefaultZoom = () => {
      if (defaultZoomAppliedForKey.current === resetKey) {
        return;
      }
      const viewport = viewportRef.current;
      if (!viewport || viewport.clientWidth < 16 || viewport.clientHeight < 16) {
        return;
      }
      applyDefaultView();
      defaultZoomAppliedForKey.current = resetKey;
    };

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(tryApplyDefaultZoom);
    });

    const viewport = viewportRef.current;
    if (!viewport) {
      return () => cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(tryApplyDefaultZoom);
    observer.observe(viewport);
    tryApplyDefaultZoom();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [naturalSize, resetKey, applyDefaultView]);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || pixelWidth <= 0 || pixelHeight <= 0) {
      applySourcePixelView();
      return;
    }

    const padding = 48;
    const fitZoom = Math.min(
      (viewport.clientWidth - padding) / pixelWidth,
      (viewport.clientHeight - padding) / pixelHeight,
    );

    setZoom(clampZoom(fitZoom));
    setPan({ x: 0, y: 0 });
    scrollViewportToStart();
  }, [applySourcePixelView, pixelHeight, pixelWidth, scrollViewportToStart]);

  const zoomBy = useCallback((factor: number) => {
    setZoom((current) => clampZoom(current * factor));
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    setZoom((current) => clampZoom(current * factor));
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || zoom <= 1) {
        return;
      }
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y, zoom],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setPan({
      x: drag.panX + (event.clientX - drag.startX),
      y: drag.panY + (event.clientY - drag.startY),
    });
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const zoomPercent = Math.round(baseScale * zoom * 100);
  const canPan = zoom > 1;

  return (
    <div className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-inner">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2">
        <span className="text-xs font-medium tabular-nums text-zinc-600">
          {zoomPercent}%
          {sourceWidth && sourceHeight ? (
            <span className="ml-1.5 text-zinc-400">
              · {sourceWidth}×{sourceHeight}px source
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          <ZoomButton
            label="Zoom out"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </ZoomButton>
          <ZoomButton
            label="Zoom in"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </ZoomButton>
          <ZoomButton label="Fit to view" onClick={fitToView}>
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </ZoomButton>
          <ZoomButton label="Source pixels (1:1)" onClick={applySourcePixelView}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </ZoomButton>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative min-h-0 flex-1 overflow-auto bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fafafa_0%_50%)] bg-size-[20px_20px] ${
          canPan ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={`${alt} preview, ${zoomPercent}% zoom`}
      >
        <div
          className="inline-flex min-h-full min-w-full items-center justify-center p-6"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <div className="relative inline-block leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              width={displayW > 0 ? displayW : undefined}
              height={displayH > 0 ? displayH : undefined}
              draggable={false}
              className="select-none"
              style={{ imageRendering: "pixelated" }}
              onLoad={onImageLoad}
            />
            {overlay}
          </div>
        </div>
        <p className="pointer-events-none sticky bottom-2 left-1/2 mx-auto w-fit -translate-x-1/2 rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-zinc-500 backdrop-blur-sm">
          Opens at in-game size · Scroll to zoom
        </p>
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
