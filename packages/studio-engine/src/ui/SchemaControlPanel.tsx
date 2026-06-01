"use client";

import {
  getConfigValue,
  type ControlFieldSchema,
  type ControlValue,
  type GameMasterConfig,
  type GameSchema,
} from "@advergaming/shared";
import { useRef } from "react";

export const controlInputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const MAX_TEXTURE_BYTES = 4 * 1024 * 1024;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
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

function SchemaControl({
  schema,
  value,
  onChange,
}: {
  schema: ControlFieldSchema;
  value: ControlValue;
  onChange: (value: ControlValue) => void;
}) {
  const textureInputRef = useRef<HTMLInputElement>(null);

  switch (schema.type) {
    case "slider": {
      const min = schema.min ?? 50;
      const max = schema.max ?? 400;
      const step = schema.step ?? 10;
      const numericValue = typeof value === "number" ? value : min;
      return (
        <Field label={`${schema.label} — ${numericValue}`}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={numericValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </Field>
      );
    }
    case "color": {
      const colorValue = typeof value === "string" ? value : "#000000";
      return (
        <Field label={schema.label}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorValue}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1"
            />
            <span className="font-mono text-sm text-zinc-600">{colorValue}</span>
          </div>
        </Field>
      );
    }
    case "text": {
      const textValue = typeof value === "string" ? value : "";
      return (
        <Field label={schema.label}>
          <input
            type="text"
            value={textValue}
            placeholder={schema.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={controlInputClass}
          />
        </Field>
      );
    }
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
    case "image": {
      const textureValue = typeof value === "string" ? value : null;
      return (
        <Field label={schema.label}>
          <input
            ref={textureInputRef}
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file || file.size > MAX_TEXTURE_BYTES) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") onChange(reader.result);
                event.target.value = "";
              };
              reader.readAsDataURL(file);
            }}
            className={`${controlInputClass} cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700`}
          />
          {textureValue ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-zinc-500 underline"
            >
              Clear image
            </button>
          ) : null}
        </Field>
      );
    }
    default:
      return null;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  system: "System / Mechanics",
  branding: "Branding & UI",
};

export interface SchemaControlPanelProps {
  schema: GameSchema;
  config: GameMasterConfig;
  onControlChange: (control: ControlFieldSchema, value: ControlValue) => void;
}

export function SchemaControlPanel({
  schema,
  config,
  onControlChange,
}: SchemaControlPanelProps) {
  const groups = ["system", "branding"] as const;

  return (
    <>
      {groups.map((category) => {
        const controls = schema.controls.filter(
          (c) => c.targetCategory === category,
        );
        if (controls.length === 0) return null;
        return (
          <Section key={category} title={CATEGORY_LABELS[category] ?? category}>
            {controls.map((control) => (
              <SchemaControl
                key={`${control.targetCategory}-${control.targetPath}`}
                schema={control}
                value={getConfigValue(config, control)}
                onChange={(value) => onControlChange(control, value)}
              />
            ))}
          </Section>
        );
      })}
    </>
  );
}
