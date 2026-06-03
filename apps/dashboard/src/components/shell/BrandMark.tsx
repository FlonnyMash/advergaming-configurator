import { APP_DISPLAY_NAME } from "@advergaming/shared";
import Image from "next/image";
import Link from "next/link";

const APP_TITLE = APP_DISPLAY_NAME;

type BrandMarkProps = {
  size?: "sm" | "lg";
  linkHome?: boolean;
};

export function BrandMark({ size = "sm", linkHome = true }: BrandMarkProps) {
  const logoHeight = size === "lg" ? 81 : 48;
  const logoWidth = size === "lg" ? 235 : 137;
  const titleClass =
    size === "lg"
      ? "text-2xl font-semibold tracking-tight text-zinc-900"
      : "text-sm font-semibold tracking-tight text-zinc-900";

  const content = (
    <div className="flex items-center gap-3">
      <Image
        src="/mashed-games-logo.png"
        alt={APP_DISPLAY_NAME}
        width={logoWidth}
        height={logoHeight}
        className="block shrink-0 object-contain invert"
        style={{ height: logoHeight, width: "auto", maxWidth: logoWidth }}
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
