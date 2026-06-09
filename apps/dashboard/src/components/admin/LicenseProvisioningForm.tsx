"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/useAuthStore";
import type { Tables } from "@/lib/supabaseClient";
import { getAdminRefDataViaIpc, provisionLicenseViaIpc } from "@/lib/auth-ipc";

// ---------------------------------------------------------------------------
// Reference data types
// ---------------------------------------------------------------------------

type OrgOption = Pick<Tables<"organizations">, "id" | "name">;
type TemplateOption = Pick<Tables<"templates">, "id" | "template_slug">;

type RefDataState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; orgs: OrgOption[]; templates: TemplateOption[] };

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const ORG_ID_RE = /^org_[a-z0-9_-]{1,64}$/;

const schema = z.object({
  org_id: z
    .string()
    .min(1, "Organisation is required.")
    .regex(ORG_ID_RE, 'ID must match "org_<slug>", e.g. "org_acme".'),
  template_id: z
    .string()
    .min(1, "Template is required.")
    .uuid('Must be a valid UUID v4.'),
  max_projects: z.coerce
    .number({ invalid_type_error: "Must be a whole number." })
    .int("Must be a whole number.")
    .min(-1, "Must be ≥ -1 (use -1 for unlimited)."),
  valid_until: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// API response type
// ---------------------------------------------------------------------------

type ApiResponse =
  | { ok: true; licenseId: string }
  | { ok: false; error: string };

function resolveApiError(status: number, serverMessage: string | undefined): string {
  if (status === 401) return "Session expired or invalid. Please log in again.";
  if (status === 403) return "Forbidden — studio_admin role required.";
  if (status === 500) return "Server error. Please try again later.";
  return serverMessage ?? `Unexpected error (HTTP ${status}).`;
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
};

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-700">
        {label}
        {hint ? (
          <span className="ml-1.5 font-normal text-zinc-400">{hint}</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 " +
  "placeholder-zinc-400 outline-none transition-colors " +
  "focus:border-zinc-400 focus:bg-white " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-invalid:border-red-400 aria-invalid:bg-red-50";

function isElectronRuntime() {
  return (
    typeof window !== "undefined" &&
    !!(window as Window & { electron?: { ipcRenderer?: unknown } }).electron
      ?.ipcRenderer
  );
}

// ---------------------------------------------------------------------------
// Combobox — searchable select, no external library
// ---------------------------------------------------------------------------

type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  isInvalid?: boolean;
};

const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  function Combobox(
    {
      value,
      onChange,
      onBlur,
      options,
      placeholder = "Select…",
      emptyMessage = "No options found.",
      disabled = false,
      isInvalid = false,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIdx, setActiveIdx] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

    const filtered = query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase()),
        )
      : options;

    // Close on outside click / focus-loss
    useEffect(() => {
      if (!open) return;
      function onPointerDown(e: PointerEvent) {
        if (!containerRef.current?.contains(e.target as Node)) {
          setOpen(false);
          onBlur?.();
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open, onBlur]);

    // Reset keyboard cursor when search changes
    useEffect(() => {
      setActiveIdx(-1);
    }, [query]);

    function openDropdown() {
      if (disabled) return;
      setQuery("");
      setOpen(true);
    }

    function select(opt: ComboboxOption) {
      onChange(opt.value);
      setQuery("");
      setOpen(false);
    }

    function clear(e: React.MouseEvent) {
      e.stopPropagation();
      onChange("");
      setQuery("");
      setOpen(false);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDropdown();
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIdx >= 0 && filtered[activeIdx]) {
            select(filtered[activeIdx]);
          }
          break;
        case "Escape":
        case "Tab":
          setOpen(false);
          onBlur?.();
          break;
      }
    }

    const ringClass = isInvalid
      ? "border-red-400 bg-red-50"
      : open
        ? "border-zinc-400 bg-white"
        : "border-zinc-200 bg-zinc-50";

    return (
      <div ref={containerRef} className="relative">
        {/* Trigger row */}
        <div
          className={`flex items-center rounded-lg border transition-colors ${ringClass} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <Search className="ml-3 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          <input
            ref={ref}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={isInvalid || undefined}
            aria-activedescendant={
              activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined
            }
            disabled={disabled}
            placeholder={open ? "Type to filter…" : (selectedLabel || placeholder)}
            value={open ? query : ""}
            onClick={openDropdown}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 bg-transparent py-2 pl-2 pr-1 text-sm text-zinc-900 placeholder-zinc-400 outline-none disabled:cursor-not-allowed"
          />
          {/* Show selected label as non-editable overlay when closed */}
          {!open && selectedLabel ? (
            <span className="pointer-events-none absolute left-9 right-10 truncate text-sm text-zinc-900">
              {selectedLabel}
            </span>
          ) : null}
          {value && !disabled ? (
            <button
              type="button"
              onPointerDown={clear}
              aria-label="Clear selection"
              className="mr-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <ChevronDown
              className={`mr-3 h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          )}
        </div>

        {/* Dropdown list */}
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-zinc-400">{emptyMessage}</li>
            ) : (
              filtered.map((opt, idx) => {
                const isActive = idx === activeIdx;
                const isSelected = opt.value === value;
                return (
                  <li
                    key={opt.value}
                    id={`${listId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      select(opt);
                    }}
                    onPointerEnter={() => setActiveIdx(idx)}
                    className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900"
                        : isSelected
                          ? "bg-zinc-50 text-zinc-900"
                          : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected ? (
                      <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// ComboboxSkeleton — shown while ref data is loading
// ---------------------------------------------------------------------------

function ComboboxSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      <span>Loading {label}…</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LicenseProvisioningForm
// ---------------------------------------------------------------------------

/**
 * Admin-only form for provisioning a license for a client organisation.
 * Sends a POST to /api/provision-license with a Bearer JWT from the current
 * Supabase session.
 *
 * Intended to be rendered inside <RoleGate allow="studio_admin"> — the
 * component also renders its own unauthorised guard for defence-in-depth.
 */
export function LicenseProvisioningForm() {
  const role = useAuthStore((s) => s.role);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refData, setRefData] = useState<RefDataState>({ status: "loading" });

  const fetchRefData = useCallback(async () => {
    setRefData({ status: "loading" });

    if (isElectronRuntime()) {
      const body = await getAdminRefDataViaIpc();
      if (!body?.ok) {
        setRefData({ status: "error" });
        return;
      }
      // Keep only the shape this form needs.
      setRefData({
        status: "success",
        orgs: body.orgs,
        templates: body.templates.map((t) => ({ id: t.id, template_slug: t.template_slug })),
      });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setRefData({ status: "error" });
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/admin/ref-data", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      setRefData({ status: "error" });
      return;
    }

    if (!res.ok) {
      setRefData({ status: "error" });
      return;
    }

    const body = (await res.json()) as
      | { ok: true; orgs: OrgOption[]; templates: TemplateOption[] }
      | { ok: false; error: string };

    if (!body.ok) {
      setRefData({ status: "error" });
      return;
    }

    setRefData({ status: "success", orgs: body.orgs, templates: body.templates });
  }, []);

  useEffect(() => {
    if (role === "studio_admin") {
      fetchRefData();
    }
  }, [role, fetchRefData]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      org_id: "",
      template_id: "",
      max_projects: -1,
      valid_until: "",
    },
  });

  if (role !== "studio_admin") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-500">
        <ShieldAlert className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        <span>License provisioning is restricted to Studio Admins.</span>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setApiError(null);

    if (isElectronRuntime()) {
      const payload = {
        org_id: values.org_id,
        template_id: values.template_id,
        max_projects: values.max_projects,
        valid_until: values.valid_until?.trim() || null,
      };

      const body = await provisionLicenseViaIpc(payload);
      if (!body?.ok) {
        setApiError(body?.error ?? "Desktop auth bridge is out of date. Restart the app.");
        return;
      }

      toast.success("License provisioned", {
        description: `License ID: ${body.licenseId}`,
      });
      reset();
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setApiError("No active session. Please log in again.");
      return;
    }

    const payload = {
      org_id: values.org_id,
      template_id: values.template_id,
      max_projects: values.max_projects,
      valid_until: values.valid_until?.trim() || null,
    };

    let res: Response;
    try {
      res = await fetch("/api/provision-license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      setApiError("Network error. Check your connection and try again.");
      return;
    }

    let body: ApiResponse;
    try {
      body = (await res.json()) as ApiResponse;
    } catch {
      setApiError(`Unexpected response (HTTP ${res.status}).`);
      return;
    }

    if (!res.ok || !body.ok) {
      const message = resolveApiError(
        res.status,
        body.ok === false ? body.error : undefined,
      );
      setApiError(message);
      return;
    }

    toast.success("License provisioned", {
      description: `License ID: ${body.licenseId}`,
    });
    reset();
  };

  const orgOptions: ComboboxOption[] =
    refData.status === "success"
      ? refData.orgs.map((o) => ({ value: o.id, label: o.name }))
      : [];

  const templateOptions: ComboboxOption[] =
    refData.status === "success"
      ? refData.templates.map((t) => ({ value: t.id, label: t.template_slug }))
      : [];

  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-zinc-100 px-6 py-5">
        <h2 className="text-sm font-semibold text-zinc-900">Provision License</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Grant a client organisation access to a template.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-5">
        {/* Ref-data fetch error */}
        {refData.status === "error" ? (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          >
            <span>Failed to load organisations and templates.</span>
            <button
              type="button"
              onClick={fetchRefData}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Retry
            </button>
          </div>
        ) : null}

        <div className="space-y-5">
          {/* Organisation combobox */}
          <Field label="Organisation" error={errors.org_id?.message}>
            {refData.status === "loading" ? (
              <ComboboxSkeleton label="organisations" />
            ) : (
              <Controller
                control={control}
                name="org_id"
                render={({ field }) => (
                  <Combobox
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={orgOptions}
                    placeholder="Select an organisation…"
                    emptyMessage="No organisations match your search."
                    disabled={isSubmitting || refData.status === "error"}
                    isInvalid={!!errors.org_id}
                  />
                )}
              />
            )}
          </Field>

          {/* Template combobox */}
          <Field label="Template" error={errors.template_id?.message}>
            {refData.status === "loading" ? (
              <ComboboxSkeleton label="templates" />
            ) : (
              <Controller
                control={control}
                name="template_id"
                render={({ field }) => (
                  <Combobox
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={templateOptions}
                    placeholder="Select a template…"
                    emptyMessage="No templates match your search."
                    disabled={isSubmitting || refData.status === "error"}
                    isInvalid={!!errors.template_id}
                  />
                )}
              />
            )}
          </Field>

          {/* Max projects */}
          <Field label="Max Projects" hint="−1 = unlimited" error={errors.max_projects?.message}>
            <input
              {...register("max_projects")}
              type="number"
              min={-1}
              step={1}
              disabled={isSubmitting}
              aria-invalid={!!errors.max_projects}
              className={inputClass}
            />
          </Field>

          {/* Expiry date */}
          <Field
            label="Expires On"
            hint="optional — leave blank for perpetual"
            error={errors.valid_until?.message}
          >
            <input
              {...register("valid_until")}
              type="date"
              disabled={isSubmitting}
              aria-invalid={!!errors.valid_until}
              className={inputClass}
            />
          </Field>
        </div>

        {/* API error */}
        {apiError ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {apiError}
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              reset();
              setApiError(null);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          <button
            type="submit"
            disabled={isSubmitting || refData.status !== "success"}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Provisioning…
              </>
            ) : (
              "Provision License"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
