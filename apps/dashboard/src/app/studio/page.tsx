import { notFound } from "next/navigation";
import { STUDIO_MODE_ENABLED } from "@/lib/studio-mode";

/** Workspace UI is mounted persistently in AppShell — this route only satisfies routing. */
export default function StudioPage() {
  if (!STUDIO_MODE_ENABLED) notFound();
  return null;
}
