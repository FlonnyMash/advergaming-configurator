"use client";

import { AssetInspectorPane } from "@/components/shell/AssetInspectorPane";
import { DevicePreview, type DevicePreviewProps } from "@/components/shell/DevicePreview";
import {
  assetPaneLabel,
  GAME_PREVIEW_PANE_ID,
  useWorkspaceCenterStore,
} from "@/lib/workspace-center-store";
import { Gamepad2, ImageIcon, X } from "lucide-react";

export function CenterWorkspace({
  previewSuspended = false,
  ...props
}: DevicePreviewProps) {
  const activePaneId = useWorkspaceCenterStore((state) => state.activePaneId);
  const panes = useWorkspaceCenterStore((state) => state.panes);
  const setActivePane = useWorkspaceCenterStore((state) => state.setActivePane);
  const closePane = useWorkspaceCenterStore((state) => state.closePane);

  const assetPanes = panes.filter((pane) => pane.kind === "asset");

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-100">
      <div
        className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-zinc-200 bg-white px-2 pt-2"
        role="tablist"
        aria-label="Workspace views"
      >
        {panes.map((pane) => {
          const isActive = activePaneId === pane.id;
          const isGame = pane.kind === "game-preview";
          const Icon = isGame ? Gamepad2 : ImageIcon;
          const label = isGame ? "Game preview" : assetPaneLabel(pane.asset);
          const closable = !isGame;

          return (
            <div key={pane.id} className="flex shrink-0 items-stretch">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActivePane(pane.id)}
                className={`inline-flex max-w-[14rem] items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                    : "border-transparent bg-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
              {closable ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closePane(pane.id);
                  }}
                  className={`mb-0.5 inline-flex items-center justify-center rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 ${
                    isActive ? "bg-zinc-100" : ""
                  }`}
                  aria-label={`Close ${label}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <section
          role="tabpanel"
          aria-hidden={activePaneId !== GAME_PREVIEW_PANE_ID}
          className={
            activePaneId === GAME_PREVIEW_PANE_ID
              ? "flex min-h-0 flex-1 flex-col"
              : "pointer-events-none absolute inset-0 flex min-h-0 flex-1 flex-col opacity-0"
          }
        >
          <DevicePreview {...props} suspended={previewSuspended} />
        </section>

        {assetPanes.map((pane) => {
          const isActive = activePaneId === pane.id;
          return (
            <section
              key={pane.id}
              role="tabpanel"
              aria-hidden={!isActive}
              className={
                isActive
                  ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50"
                  : "pointer-events-none absolute inset-0 flex min-h-0 flex-1 flex-col overflow-hidden opacity-0"
              }
            >
              <AssetInspectorPane
                paneId={pane.id}
                asset={pane.asset}
                isActive={isActive}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
