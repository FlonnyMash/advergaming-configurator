"use client";

import { warmTemplatePreviewImages } from "@/lib/template-preview-preload";
import { useLayoutEffect } from "react";

/** Starts loading template cover images as soon as the dashboard shell mounts. */
export function TemplatePreviewWarmup() {
  useLayoutEffect(() => {
    warmTemplatePreviewImages();
  }, []);

  return null;
}
