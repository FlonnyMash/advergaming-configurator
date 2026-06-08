/** Build-time constant. Webpack evaluates this and DCE-eliminates all false branches. */
export const STUDIO_MODE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_STUDIO_MODE === "true";
