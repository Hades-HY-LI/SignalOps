"use client";

import { AppShell } from "./app-shell";
import { GlobalView } from "./views-global";
import { ProjectView } from "./views-project";

export type WorkspaceView = "portfolio" | "vendors" | "datasets" | "registry" | "mission" | "requirements" | "operations" | "workflow" | "lineage" | "release";

export function WorkspaceScreen({ view }: { view: WorkspaceView }) {
  const global = ["portfolio", "vendors", "datasets", "registry"].includes(view);
  return <AppShell>{global ? <GlobalView view={view as "portfolio" | "vendors" | "datasets" | "registry"}/> : <ProjectView view={view as "mission" | "requirements" | "operations" | "workflow" | "lineage" | "release"}/>}</AppShell>;
}
