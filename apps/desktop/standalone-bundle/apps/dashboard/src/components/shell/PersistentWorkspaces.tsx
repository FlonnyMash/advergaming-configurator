"use client";

import { ConfiguratorProjectGate } from "@/components/configurator/ConfiguratorProjectGate";
import { ConfiguratorWorkspace } from "@/components/configurator/ConfiguratorWorkspace";
import { StudioTemplateGate } from "@/components/studio/StudioTemplateGate";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

function workspaceLayerClass(visible: boolean): string {
  return visible
    ? "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
    : "pointer-events-none absolute inset-0 z-0 flex min-h-0 flex-1 flex-col overflow-hidden opacity-0";
}

function PersistentWorkspacesInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");
  const projectParam = searchParams.get("project");

  const activeStudioTemplateId = useWorkspaceSessionStore(
    (s) => s.activeStudioTemplateId,
  );
  const activeConfiguratorProjectId = useWorkspaceSessionStore(
    (s) => s.activeConfiguratorProjectId,
  );

  const showStudio =
    pathname === "/studio" && Boolean(templateParam ?? activeStudioTemplateId);
  const showConfigurator =
    pathname === "/configurator" &&
    Boolean(projectParam ?? activeConfiguratorProjectId);

  const mountStudio =
    Boolean(activeStudioTemplateId) ||
    (pathname === "/studio" && Boolean(templateParam));
  const mountConfigurator =
    Boolean(activeConfiguratorProjectId) ||
    (pathname === "/configurator" && Boolean(projectParam));
  const workspaceActive = showStudio || showConfigurator;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {mountStudio ? (
        <div
          className={workspaceLayerClass(showStudio)}
          aria-hidden={!showStudio}
        >
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
                Loading studio…
              </div>
            }
          >
            <StudioTemplateGate detached={!showStudio}>
              <StudioWorkspace suspended={!showStudio} />
            </StudioTemplateGate>
          </Suspense>
        </div>
      ) : null}

      {mountConfigurator ? (
        <div
          className={workspaceLayerClass(showConfigurator)}
          aria-hidden={!showConfigurator}
        >
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
                Loading configurator…
              </div>
            }
          >
            <ConfiguratorProjectGate detached={!showConfigurator}>
              <ConfiguratorWorkspace suspended={!showConfigurator} />
            </ConfiguratorProjectGate>
          </Suspense>
        </div>
      ) : null}

      <div
        className={
          workspaceActive
            ? "hidden"
            : "relative flex min-h-0 flex-1 flex-col overflow-hidden"
        }
      >
        {children}
      </div>
    </div>
  );
}

export function PersistentWorkspaces({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      }
    >
      <PersistentWorkspacesInner>{children}</PersistentWorkspacesInner>
    </Suspense>
  );
}
