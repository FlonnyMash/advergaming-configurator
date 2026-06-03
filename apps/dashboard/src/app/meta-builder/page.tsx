import { notFound } from "next/navigation";
import { MetaBuilderClient } from "./MetaBuilderClient";

export default function MetaBuilderPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <MetaBuilderClient />;
}
