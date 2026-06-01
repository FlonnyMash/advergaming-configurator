"use client";

import { useConfigStore } from "@/store/useConfigStore";
import {
  GAME_SCHEMAS,
  GAME_TEMPLATES,
  isGameMasterConfig,
  type ControlSchema,
  type DOMOverlayConfig,
  type GameMasterConfig,
  type GameplayConfig,
  type GameTemplateId,
  type ThemeConfig,
} from "@advergaming/shared";
import { useRef, useState } from "react";

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

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const segmentButtonClass =
  "flex-1 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50";

const MAX_TEXTURE_BYTES = 4 * 1024 * 1024;

const IMPORT_ERROR_INVALID_SHAPE =
  "Invalid config file. Expected theme, gameplay, and domOverlay fields.";
const IMPORT_ERROR_PARSE = "Could not parse JSON. Check the file format.";

type ConfigCategory = ControlSchema["targetCategory"];

const CATEGORY_ORDER: ConfigCategory[] = ["theme", "gameplay", "domOverlay"];

const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  theme: "Theme",
  gameplay: "Gameplay",
  domOverlay: "DOM Overlay",
};

function getControlValue(
  config: GameMasterConfig,
  schema: ControlSchema,
): string | number | null {
  const slice = config[schema.targetCategory];
  const value = (slice as unknown as Record<string, unknown>)[schema.key];
  if (typeof value === "string" || typeof value === "number") return value;
  if (value === null) return null;
  return "";
}

function SchemaControl({
  schema,
  value,
  onChange,
}: {
  schema: ControlSchema;
  value: string | number | null;
  onChange: (value: string | number | null) => void;
}) {
  const textureInputRef = useRef<HTMLInputElement>(null);

  switch (schema.type) {
    case "slider": {
      const min = schema.min ?? 50;
      const max = schema.max ?? 400;
      const numericValue = typeof value === "number" ? value : min;
      return (
        <Field label={`${schema.label} — ${numericValue}`}>
          <input
            type="range"
            min={min}
            max={max}
            step={10}
            value={numericValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{min}</span>
            <span>{max}</span>
          </div>
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
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </Field>
      );
    }
    case "image": {
      const textureValue = typeof value === "string" ? value : null;
      const handlePlayerTextureChange = (
        event: React.ChangeEvent<HTMLInputElement>,
      ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_TEXTURE_BYTES) {
          event.target.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") {
            onChange(result);
          }
          event.target.value = "";
        };
        reader.readAsDataURL(file);
      };

      return (
        <Field label={schema.label}>
          <input
            ref={textureInputRef}
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            onChange={handlePlayerTextureChange}
            className={`${inputClass} cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100`}
          />
          {textureValue ? (
            <div className="flex items-center gap-3">
              <img
                src={textureValue}
                alt={`${schema.label} preview`}
                className="h-12 w-12 rounded-lg border border-zinc-200 object-contain bg-zinc-50"
              />
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  if (textureInputRef.current) textureInputRef.current.value = "";
                }}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Clear
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">PNG or JPG, max 4 MB</p>
          )}
        </Field>
      );
    }
    default:
      return null;
  }
}

export function ConfigSidebar() {
  const jsonImportInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const config = useConfigStore((state) => state.config);
  const activeTemplate = useConfigStore((state) => state.activeTemplate);
  const setActiveTemplate = useConfigStore((state) => state.setActiveTemplate);
  const setTheme = useConfigStore((state) => state.setTheme);
  const setPlayerTexture = useConfigStore((state) => state.setPlayerTexture);
  const setGameplay = useConfigStore((state) => state.setGameplay);
  const setDomOverlay = useConfigStore((state) => state.setDomOverlay);
  const setConfig = useConfigStore((state) => state.setConfig);
  const resetConfig = useConfigStore((state) => state.resetConfig);

  const activeSchema = GAME_SCHEMAS[activeTemplate];

  const handleChange = (schema: ControlSchema, value: string | number | null) => {
    switch (schema.targetCategory) {
      case "theme":
        if (schema.key === "playerTexture") {
          setPlayerTexture(typeof value === "string" ? value : null);
        } else {
          setTheme({ [schema.key]: value } as Partial<ThemeConfig>);
        }
        break;
      case "gameplay":
        setGameplay({ [schema.key]: value } as Partial<GameplayConfig>);
        break;
      case "domOverlay":
        setDomOverlay({ [schema.key]: value } as Partial<DOMOverlayConfig>);
        break;
    }
  };

  const handleExport = () => {
    const currentConfig = useConfigStore.getState().config;
    const json = JSON.stringify(currentConfig, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setImportError(null);
    jsonImportInputRef.current?.click();
  };

  const handleConfigImport = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        if (typeof text !== "string") {
          setImportError(IMPORT_ERROR_PARSE);
          return;
        }

        const parsed: unknown = JSON.parse(text);

        if (!isGameMasterConfig(parsed)) {
          setImportError(IMPORT_ERROR_INVALID_SHAPE);
          return;
        }

        setConfig(parsed);
        setImportError(null);
      } catch {
        setImportError(IMPORT_ERROR_PARSE);
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setImportError(IMPORT_ERROR_PARSE);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const schemasByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    schemas: activeSchema.filter((schema) => schema.targetCategory === category),
  })).filter((group) => group.schemas.length > 0);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">
            Advergaming Configurator
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Tweak settings and preview live
          </p>
        </div>
        <button
          type="button"
          onClick={resetConfig}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          Reset
        </button>
      </header>

      <div className="border-b border-zinc-200 px-6 py-4">
        <input
          ref={jsonImportInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleConfigImport}
          className="hidden"
          aria-hidden
        />
        <div className="flex overflow-hidden rounded-lg border border-zinc-200 divide-x divide-zinc-200">
          <button
            type="button"
            onClick={handleExport}
            className={segmentButtonClass}
          >
            Export
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className={segmentButtonClass}
          >
            Import
          </button>
        </div>
        {importError ? (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {importError}
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <Section title="Game Template">
          <select
            value={activeTemplate}
            onChange={(e) =>
              setActiveTemplate(e.target.value as GameTemplateId)
            }
            className={inputClass}
          >
            {GAME_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </Section>

        {schemasByCategory.map(({ category, schemas }) => (
          <Section key={category} title={CATEGORY_LABELS[category]}>
            {schemas.map((schema) => (
              <SchemaControl
                key={`${category}-${schema.key}`}
                schema={schema}
                value={getControlValue(config, schema)}
                onChange={(value) => handleChange(schema, value)}
              />
            ))}
          </Section>
        ))}
      </div>
    </aside>
  );
}
