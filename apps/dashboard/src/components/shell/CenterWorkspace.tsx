"use client";

import { DevicePreview, type DevicePreviewProps } from "@/components/shell/DevicePreview";

export function CenterWorkspace({
  previewSuspended = false,
  ...props
}: DevicePreviewProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-100">
      <DevicePreview {...props} suspended={previewSuspended} />
    </div>
  );
}
