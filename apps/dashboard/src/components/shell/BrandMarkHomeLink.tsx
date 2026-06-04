"use client";

import { BRAND_LOGO_INTRINSIC_SIZE } from "@/lib/brand-logo-constants";
import { usePlatformStore } from "@/store/usePlatformStore";
import Image from "next/image";

export function BrandMarkHomeLink({ onHomeClick }: { onHomeClick: () => void }) {
  const appName = usePlatformStore((s) => s.appName);
  const logoPath = usePlatformStore((s) => s.logoPath);

  return (
    <button
      type="button"
      onClick={onHomeClick}
      className="rounded-lg outline-offset-2 hover:opacity-90"
      aria-label={`${appName} — back to home`}
    >
      <Image
        src={logoPath}
        alt=""
        width={BRAND_LOGO_INTRINSIC_SIZE.width}
        height={BRAND_LOGO_INTRINSIC_SIZE.height}
        unoptimized
        className="block h-12 w-auto max-w-[137px] shrink-0 object-contain"
        priority
      />
    </button>
  );
}
