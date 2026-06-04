"use client";

import dynamic from "next/dynamic";

const MetaBuilderDevFab = dynamic(
  () =>
    import("@/components/shell/MetaBuilderDevFab").then((m) => m.MetaBuilderDevFab),
  { ssr: false },
);

export function MetaBuilderDevFabHost() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <MetaBuilderDevFab />;
}
