"use client";

import {
  getConfigValue,
  groupControlsByElement,
  type ControlFieldSchema,
  type ControlValue,
  type GameMasterConfig,
  type GameSchema,
} from "@advergaming/shared";
import { useRef, useState } from "react";

export const controlInputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const MAX_TEXTURE_BYTES = 4 * 1024 * 1024;

function ChevronIcon({ expanded }: { expanded?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
        expanded ? "rotate-180" : ""
      }`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CollapsibleGroup({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50"
      >
        <ChevronIcon expanded={open} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
          {title}
        </span>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">
          {count}
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/40 px-4 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function clampSliderValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function SliderControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      onChange(clampSliderValue(parsed, min, max));
    }
    setDraft(null);
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            setDraft(null);
            onChange(Number(e.target.value));
          }}
          className="min-w-0 flex-1 accent-indigo-500"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitDraft();
              e.currentTarget.blur();
            }
          }}
          className={`${controlInputClass} w-20 shrink-0 tabular-nums`}
        />
      </div>
    </Field>
  );
}

export type ImageUploadMode = "base64" | "workspace-file";

function SchemaControl({
  schema,
  value,
  onChange,
  imageUploadMode = "base64",
  onImageFile,
}: {
  schema: ControlFieldSchema;
  value: ControlValue;
  onChange: (value: ControlValue) => void;
  imageUploadMode?: ImageUploadMode;
  onImageFile?: (
    file: File,
    control: ControlFieldSchema,
  ) => void | Promise<void>;
}) {
  const textureInputRef = useRef<HTMLInputElement>(null);

  switch (schema.type) {
    case "slider": {
      const min = schema.min ?? 50;
      const max = schema.max ?? 400;
      const step = schema.step ?? 10;
      const numericValue = typeof value === "number" ? value : min;
      return (
        <SliderControl
          label={schema.label}
          min={min}
          max={max}
          step={step}
          value={numericValue}
          onChange={onChange}
        />
      );
    }
    case "color": {
      const colorValue = typeof value === "string" ? value : "#000000";
      return (
        <Field label={schema.label}>
          <input
            type="color"
            value={colorValue}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-200"
          />
        </Field>
      );
    }
    case "text":
      return (
        <Field label={schema.label}>
          <input
            type="text"
            value={typeof value === "string" ? value : ""}
            placeholder={schema.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={controlInputClass}
          />
        </Field>
      );
    case "toggle": {
      const checked = typeof value === "boolean" ? value : false;
      return (
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-zinc-700">{schema.label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              checked ? "bg-indigo-500" : "bg-zinc-200"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                checked ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      );
    }
    case "image":
      return (
        <Field label={schema.label}>
          <input
            ref={textureInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file || file.size > MAX_TEXTURE_BYTES) return;
              if (imageUploadMode === "workspace-file" && onImageFile) {
                void Promise.resolve(onImageFile(file, schema)).finally(() => {
                  event.target.value = "";
                });
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") onChange(reader.result);
                event.target.value = "";
              };
              reader.readAsDataURL(file);
            }}
            className={controlInputClass}
          />
        </Field>
      );
    default:
      return null;
  }
}

export interface SchemaControlPanelProps {
  schema: GameSchema;
  config: GameMasterConfig;
  onControlChange: (control: ControlFieldSchema, value: ControlValue) => void;
  imageUploadMode?: ImageUploadMode;
  onImageFile?: (
    file: File,
    control: ControlFieldSchema,
  ) => void | Promise<void>;
}

export function SchemaControlPanel({
  schema,
  config,
  onControlChange,
  imageUploadMode = "base64",
  onImageFile,
}: SchemaControlPanelProps) {
  const brandingControls = schema.controls.filter(
    (control) => control.targetCategory === "branding",
  );
  const groups = groupControlsByElement(brandingControls);

  if (groups.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {groups.map((group, index) => (
        <CollapsibleGroup
          key={group.key}
          title={group.label}
          count={group.controls.length}
          defaultOpen={index === 0}
        >
          {group.controls.map((control) => (
            <SchemaControl
              key={control.targetPath}
              schema={control}
              value={getConfigValue(config, control)}
              onChange={(value) => onControlChange(control, value)}
              imageUploadMode={imageUploadMode}
              onImageFile={onImageFile}
            />
          ))}
        </CollapsibleGroup>
      ))}
    </div>
  );
}
