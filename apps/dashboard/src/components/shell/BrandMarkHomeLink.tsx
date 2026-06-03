"use client";

import { BRAND_LOGO_INTRINSIC_SIZE } from "@/lib/brand-logo-constants";
import { APP_DISPLAY_NAME, BRAND_LOGO_URL_PATH } from "@mashedgames/shared";
import Image from "next/image";

export function BrandMarkHomeLink({ onHomeClick }: { onHomeClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onHomeClick}
      className="rounded-lg outline-offset-2 hover:opacity-90"
      aria-label={`${APP_DISPLAY_NAME} — back to home`}
    >
      <Image
        src={BRAND_LOGO_URL_PATH}
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
