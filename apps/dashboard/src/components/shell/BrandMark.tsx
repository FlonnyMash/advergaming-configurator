import { APP_DISPLAY_NAME } from "@mashedgames/shared";
import { brandLogoSrc, BRAND_LOGO_INTRINSIC_SIZE } from "@/lib/brand-logo-src";
import Image from "next/image";
import Link from "next/link";

const APP_TITLE = APP_DISPLAY_NAME;

type BrandMarkProps = {
  size?: "sm" | "lg";
  linkHome?: boolean;
  /** Logo above title (home hero); default is side-by-side. */
  layout?: "inline" | "stacked";
};

export function BrandMark({
  size = "sm",
  linkHome = true,
  layout = "inline",
}: BrandMarkProps) {
  const logoClass =
    size === "lg"
      ? "block h-[81px] w-auto max-w-[235px] shrink-0 object-contain"
      : "block h-12 w-auto max-w-[137px] shrink-0 object-contain";
  const titleClass =
    size === "lg"
      ? "text-2xl font-semibold tracking-tight text-zinc-900"
      : "text-sm font-semibold tracking-tight text-zinc-900";

  const content = (
    <div
      className={
        layout === "stacked"
          ? "flex flex-col items-center gap-3"
          : "flex items-center gap-3"
      }
    >
      <Image
        src={brandLogoSrc()}
        alt={APP_DISPLAY_NAME}
        width={BRAND_LOGO_INTRINSIC_SIZE.width}
        height={BRAND_LOGO_INTRINSIC_SIZE.height}
        unoptimized
        className={logoClass}
        priority={size === "lg"}
      />
      <span className={titleClass}>{APP_TITLE}</span>
    </div>
  );

  if (linkHome) {
    return (
      <Link href="/" className="rounded-lg outline-offset-2 hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}

export { APP_TITLE };
