import { getProductionTemplateOptions } from "@mashedgames/configurator-engine";
import { resolveTemplatePreviewUrl } from "@mashedgames/shared";
import { getStudioTemplateOptions } from "@mashedgames/studio-engine";
import { getAppEnv } from "@/lib/env";

const preloadedUrls = new Set<string>();

function preloadImage(url: string): void {
  if (typeof window === "undefined" || preloadedUrls.has(url)) {
    return;
  }

  preloadedUrls.add(url);

  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "low";
  img.src = url;
}

function collectTemplatePreviewUrls(): string[] {
  const urls = new Set<string>();

  for (const template of getStudioTemplateOptions(getAppEnv())) {
    if (template.previewUrl) {
      urls.add(resolveTemplatePreviewUrl(template.previewUrl));
    }
  }

  for (const template of getProductionTemplateOptions()) {
    if (template.previewUrl) {
      urls.add(resolveTemplatePreviewUrl(template.previewUrl));
    }
  }

  return [...urls];
}

/** Warm the browser image cache for template catalog cover art. Idempotent per session. */
export function warmTemplatePreviewImages(): void {
  for (const url of collectTemplatePreviewUrls()) {
    preloadImage(url);
  }
}
