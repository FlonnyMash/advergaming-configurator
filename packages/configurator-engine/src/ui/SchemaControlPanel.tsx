"use client";

import {
  getConfigValue,
  groupControlsByElement,
  resolveControlAssetPreviewSrc,
  type ControlFieldSchema,
  type ControlValue,
  type EntityArrayItemField,
  type GameConfig,
  type GameSchema,
} from "@mashedgames/shared";
import { useEffect, useMemo, useRef, useState } from "react";

export const controlInputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const MAX_TEXTURE_BYTES = 4 * 1024 * 1024;

type EntityRecord = Record<string, string | number | boolean>;

function isEntityRecord(value: unknown): value is EntityRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEntityArray(value: ControlValue): EntityRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isEntityRecord);
}

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

const checkerboardClass =
  "bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fafafa_0%_50%)] bg-size-[12px_12px]";

function ImageUploadWithPreview({
  label,
  value,
  onChange,
  onFileSelected,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  onFileSelected: (file: File) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const previewSrc = useMemo(
    () => resolveControlAssetPreviewSrc(value),
    [value],
  );
  const showPreview = Boolean(previewSrc) && !previewBroken;

  useEffect(() => {
    setPreviewBroken(false);
  }, [value, previewSrc]);

  return (
    <Field label={label}>
      <div className="flex gap-3">
        <div
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 ${checkerboardClass}`}
        >
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc!}
              alt=""
              className="max-h-full max-w-full object-contain"
              onError={() => setPreviewBroken(true)}
            />
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-zinc-400">
              {value && !previewSrc ? "Saved" : "No image"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file || file.size > MAX_TEXTURE_BYTES) return;
              setPreviewBroken(false);
              void Promise.resolve(onFileSelected(file)).finally(() => {
                event.target.value = "";
              });
            }}
            className={`${controlInputClass} w-full cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700`}
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                setPreviewBroken(false);
                onChange(null);
              }}
              className="text-xs text-zinc-500 underline"
            >
              Clear image
            </button>
          ) : null}
        </div>
      </div>
    </Field>
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

function EntityArrayItemFieldControl({
  field,
  item,
  onItemChange,
  imageUploadMode,
  onImageFile,
}: {
  field: EntityArrayItemField;
  item: EntityRecord;
  onItemChange: (nextItem: EntityRecord) => void;
  imageUploadMode?: ImageUploadMode;
  onImageFile?: (file: File) => void | Promise<void>;
}) {
  const rawValue = item[field.key];

  if (field.type === "text") {
    return (
      <Field label={field.label}>
        <input
          type="text"
          value={typeof rawValue === "string" ? rawValue : String(rawValue ?? "")}
          onChange={(e) => onItemChange({ ...item, [field.key]: e.target.value })}
          className={controlInputClass}
        />
      </Field>
    );
  }

  if (field.type === "slider") {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const step = field.step ?? 1;
    const numericValue =
      typeof rawValue === "number" ? rawValue : Number(rawValue ?? min);
    return (
      <SliderControl
        label={field.label}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(numericValue) ? numericValue : min}
        onChange={(next) => onItemChange({ ...item, [field.key]: next })}
      />
    );
  }

  const textureValue = typeof rawValue === "string" && rawValue.length > 0 ? rawValue : null;
  return (
    <ImageUploadWithPreview
      label={field.label}
      value={textureValue}
      onChange={(next) => onItemChange({ ...item, [field.key]: next ?? "" })}
      onFileSelected={async (file) => {
        if (imageUploadMode === "workspace-file" && onImageFile) {
          await onImageFile(file);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            onItemChange({ ...item, [field.key]: reader.result });
          }
        };
        reader.readAsDataURL(file);
      }}
    />
  );
}

function EntityArrayControl({
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
  const items = readEntityArray(value);
  const itemFields = schema.itemFields ?? [];
  const itemLabel = schema.itemLabel ?? "Item";
  const defaultItem = schema.defaultItem ?? { id: "entity-new" };

  const updateItems = (nextItems: EntityRecord[]) => {
    onChange(nextItems);
  };

  const addItem = () => {
    const baseId =
      typeof defaultItem.id === "string" ? defaultItem.id : "entity-new";
    const nextItem: EntityRecord = {
      ...defaultItem,
      id: `${baseId}-${items.length + 1}`,
    };
    updateItems([...items, nextItem]);
  };

  const removeItem = (index: number) => {
    updateItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateItem = (index: number, nextItem: EntityRecord) => {
    updateItems(items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900">{schema.label}</span>
        <button
          type="button"
          onClick={addItem}
          className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100"
        >
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">No items configured. Add one to spawn entities.</p>
      ) : null}

      {items.map((item, index) => (
        <div
          key={`${schema.targetPath}-${index}-${String(item.id ?? index)}`}
          className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {itemLabel} {index + 1}
              {typeof item.id === "string" && item.id ? ` · ${item.id}` : ""}
            </span>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
          {itemFields.map((field) => (
            <EntityArrayItemFieldControl
              key={`${schema.targetPath}-${index}-${field.key}`}
              field={field}
              item={item}
              onItemChange={(nextItem) => updateItem(index, nextItem)}
              imageUploadMode={imageUploadMode}
              onImageFile={
                onImageFile
                  ? (file) => onImageFile(file, schema)
                  : undefined
              }
            />
          ))}
        </div>
      ))}
    </div>
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
  switch (schema.type) {
    case "entityArray":
      return (
        <EntityArrayControl
          schema={schema}
          value={value}
          onChange={onChange}
          imageUploadMode={imageUploadMode}
          onImageFile={onImageFile}
        />
      );
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
        <ImageUploadWithPreview
          label={schema.label}
          value={typeof value === "string" && value.length > 0 ? value : null}
          onChange={onChange}
          onFileSelected={async (file) => {
            if (imageUploadMode === "workspace-file" && onImageFile) {
              await onImageFile(file, schema);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") onChange(reader.result);
            };
            reader.readAsDataURL(file);
          }}
        />
      );
    default:
      return null;
  }
}

export interface SchemaControlPanelProps {
  schema: GameSchema;
  config: GameConfig;
  onControlChange: (control: ControlFieldSchema, value: ControlValue) => void;
  imageUploadMode?: ImageUploadMode;
  onImageFile?: (
    file: File,
    control: ControlFieldSchema,
  ) => void | Promise<void>;
  /** When set, only controls in this category are shown. */
  categoryFilter?: "branding" | "system";
}

export function SchemaControlPanel({
  schema,
  config,
  onControlChange,
  imageUploadMode = "base64",
  onImageFile,
  categoryFilter,
}: SchemaControlPanelProps) {
  const controls = categoryFilter
    ? schema.controls.filter((control) => control.targetCategory === categoryFilter)
    : schema.controls;
  const groups = groupControlsByElement(controls);

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
