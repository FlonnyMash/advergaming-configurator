"use client";

import dynamic from "next/dynamic";

const MetaBuilderClient = dynamic(
  () => import("./MetaBuilderClient").then((m) => m.MetaBuilderClient),
  { ssr: false },
);

export function MetaBuilderLoader() {
  return <MetaBuilderClient />;
}
