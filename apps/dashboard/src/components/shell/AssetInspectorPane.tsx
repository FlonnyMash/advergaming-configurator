"use client";

import { AssetLayoutEditor } from "@/components/shell/AssetLayoutEditor";
import { AssetLayoutOverlay } from "@/components/shell/AssetLayoutOverlay";
import { AssetPreviewZoom } from "@/components/shell/AssetPreviewZoom";
import type { DevToolkitAssetLayout, DevToolkitPickedAsset } from "@mashedgames/shared";
import { useEffect, useState } from "react";

export function AssetInspectorPane({
  paneId,
  asset,
  isActive = true,
}: {
  paneId: string;
  asset: DevToolkitPickedAsset;
  isActive?: boolean;
}) {
  const title =
    asset.name ||
    asset.textureKey ||
    `${asset.objectType} @ ${asset.sceneKey}`;

  const [layoutDraft, setLayoutDraft] = useState<DevToolkitAssetLayout>(
    asset.layout ?? {},
  );
  const [overlays, setOverlays] = useState({
    hitbox: true,
    anchor: true,
    origin: true,
  });

  useEffect(() => {
    setLayoutDraft(asset.layout ?? {});
  }, [paneId, asset.layout]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl min-h-0 flex-1 flex-col gap-5">
        <header className="shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {asset.objectType} · scene {asset.sceneKey}
            {asset.configBinding
              ? ` · ${asset.configBinding.itemKind}${
                  asset.configBinding.itemIndex !== undefined
                    ? ` #${asset.configBinding.itemIndex}`
                    : ""
                }`
              : ""}
          </p>
        </header>

        {asset.previewDataUrl ? (
          <AssetPreviewZoom
            src={asset.previewDataUrl}
            alt={title}
            sourceWidth={asset.sourceWidth}
            sourceHeight={asset.sourceHeight}
            displayWidth={asset.displayWidth}
            displayHeight={asset.displayHeight}
            resetKey={paneId}
            overlay={
              <AssetLayoutOverlay
                layout={layoutDraft}
                showHitbox={overlays.hitbox}
                showAnchor={overlays.anchor}
                showOrigin={overlays.origin}
              />
            }
          />
        ) : (
          <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-2xl border border-zinc-200 bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fafafa_0%_50%)] bg-size-[20px_20px] shadow-inner">
            <p className="px-6 text-center text-sm text-zinc-500">
              No texture preview available for this object.
            </p>
          </div>
        )}

        <AssetLayoutEditor
          paneId={paneId}
          asset={asset}
          isActive={isActive}
          layoutDraft={layoutDraft}
          onLayoutDraftChange={setLayoutDraft}
          overlays={overlays}
          onOverlaysChange={setOverlays}
        />

        <dl className="grid shrink-0 gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2">
          <AssetDetailRow label="Texture" value={asset.textureKey ?? "—"} />
          <AssetDetailRow
            label="Frame"
            value={
              asset.frameName !== undefined ? String(asset.frameName) : "—"
            }
          />
          <AssetDetailRow
            label="On screen"
            value={`${Math.round(asset.displayWidth)} × ${Math.round(asset.displayHeight)} px`}
          />
          {asset.sourceWidth !== undefined && asset.sourceHeight !== undefined ? (
            <AssetDetailRow
              label="Source"
              value={`${asset.sourceWidth} × ${asset.sourceHeight} px`}
            />
          ) : (
            <AssetDetailRow label="Source" value="—" />
          )}
          <AssetDetailRow
            label="Position"
            value={`${Math.round(asset.x)}, ${Math.round(asset.y)}`}
          />
          <AssetDetailRow
            label="Scale"
            value={`${asset.scaleX.toFixed(2)} × ${asset.scaleY.toFixed(2)}`}
          />
        </dl>
      </div>
    </div>
  );
}

function AssetDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="font-mono text-sm text-zinc-900">{value}</dd>
    </div>
  );
}
