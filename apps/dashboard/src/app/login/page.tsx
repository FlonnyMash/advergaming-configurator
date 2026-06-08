import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginComponent } from "@/components/auth/LoginComponent";

export const metadata: Metadata = {
  title: "Sign in — Mashed Games Studio",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginComponent />
    </Suspense>
  );
}
