"use client";

import type { DevToolkitAssetLayout } from "@advergaming/shared";

export interface AssetLayoutOverlayProps {
  layout: DevToolkitAssetLayout;
  showHitbox: boolean;
  showAnchor: boolean;
  showOrigin: boolean;
}

export function AssetLayoutOverlay({
  layout,
  showHitbox,
  showAnchor,
  showOrigin,
}: AssetLayoutOverlayProps) {
  const hitbox = layout.hitbox ?? { width: 1, height: 1 };
  const hitW = (hitbox.width ?? 1) * 100;
  const hitH = (hitbox.height ?? 1) * 100;
  const hitLeft = (hitbox.offsetX ?? (1 - (hitbox.width ?? 1)) / 2) * 100;
  const hitTop = (hitbox.offsetY ?? (1 - (hitbox.height ?? 1)) / 2) * 100;

  const anchor = layout.rotationAnchor ?? layout.origin ?? { x: 0.5, y: 0.5 };
  const center = layout.centerOffset ?? { x: 0, y: 0 };
  const centerX = (0.5 + (center.x ?? 0)) * 100;
  const centerY = (0.5 + (center.y ?? 0)) * 100;

  return (
    <div className="pointer-events-none absolute inset-0">
      {showHitbox ? (
        <div
          className="absolute border-2 border-emerald-500 bg-emerald-400/10"
          style={{
            left: `${hitLeft}%`,
            top: `${hitTop}%`,
            width: `${hitW}%`,
            height: `${hitH}%`,
          }}
        />
      ) : null}

      {showAnchor ? (
        <>
          <div
            className="absolute h-px w-full bg-pink-500/70"
            style={{ top: `${anchor.y! * 100}%` }}
          />
          <div
            className="absolute w-px bg-pink-500/70"
            style={{ left: `${anchor.x! * 100}%`, top: 0, bottom: 0 }}
          />
          <div
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pink-500 bg-pink-500/30"
            style={{ left: `${anchor.x! * 100}%`, top: `${anchor.y! * 100}%` }}
          />
        </>
      ) : null}

      {showOrigin && !showAnchor ? (
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500 bg-red-500/40"
          style={{
            left: `${(layout.origin?.x ?? 0.5) * 100}%`,
            top: `${(layout.origin?.y ?? 0.5) * 100}%`,
          }}
        />
      ) : null}

      {showHitbox && (center.x !== 0 || center.y !== 0) ? (
        <div
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-amber-500 bg-amber-400/50"
          style={{ left: `${centerX}%`, top: `${centerY}%` }}
        />
      ) : null}
    </div>
  );
}
