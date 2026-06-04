import { notFound } from "next/navigation";
import { MetaBuilderLoader } from "./MetaBuilderLoader";

export default function MetaBuilderPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <MetaBuilderLoader />;
}
