"use client";

import type { FlatFieldDefinition, GameConfig } from "@mashedgames/shared";
import { fieldsForMode } from "@mashedgames/shared";

export type FlatConfigPanelProps = {
  config: GameConfig;
  onFieldChange: <K extends keyof GameConfig>(
    key: K,
    value: GameConfig[K],
  ) => void;
  onImageFile?: (
    file: File,
    field: FlatFieldDefinition,
  ) => void | Promise<void>;
  onSave?: () => Promise<void>;
  onLoad?: () => Promise<void>;
};

export function FlatConfigPanel({
  config,
  onFieldChange,
  onImageFile,
  onSave,
  onLoad,
}: FlatConfigPanelProps) {
  const fields = fieldsForMode("studio");

  return (
    <div className="space-y-4">
      {(onSave ?? onLoad) ? (
        <div className="mb-1 flex gap-2 border-b border-zinc-200 pb-3">
          {onSave ? (
            <button
              type="button"
              onClick={() => void onSave()}
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Save Project
            </button>
          ) : null}
          {onLoad ? (
            <button
              type="button"
              onClick={() => void onLoad()}
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Load Project
            </button>
          ) : null}
        </div>
      ) : null}
      {fields.map((field) => {
        const value = config[field.key];

        if (field.type === "color") {
          return (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-700">{field.label}</span>
              <input
                type="color"
                value={typeof value === "string" ? value : "#6366f1"}
                onChange={(event) =>
                  onFieldChange(field.key, event.target.value as never)
                }
                className="h-10 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white"
              />
            </label>
          );
        }

        if (field.type === "slider" || field.type === "number") {
          return (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-700">{field.label}</span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={typeof value === "number" ? value : 0}
                onChange={(event) =>
                  onFieldChange(field.key, Number(event.target.value) as never)
                }
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          );
        }

        if (field.type === "image") {
          return (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-700">{field.label}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && onImageFile) {
                    void onImageFile(file, field);
                  }
                  event.target.value = "";
                }}
                className="block w-full text-xs text-zinc-600"
              />
              {typeof value === "string" && value ? (
                <p className="truncate text-[11px] text-zinc-500">{value}</p>
              ) : null}
            </label>
          );
        }

        return (
          <label key={field.key} className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">{field.label}</span>
            <input
              type="text"
              value={typeof value === "string" ? value : ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                onFieldChange(field.key, event.target.value as never)
              }
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
        );
      })}
    </div>
  );
}
