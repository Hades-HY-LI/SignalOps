"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Blocks,
  Boxes,
  Database,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Menu,
  PackageCheck,
  PanelLeftClose,
  RefreshCw,
  Route,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { clearAttachments, deleteAttachment } from "@/lib/attachments";

const globalNav = [
  ["/portfolio", "Portfolio", LayoutDashboard],
  ["/vendors", "Vendors", Boxes],
  ["/datasets", "Datasets", Database],
  ["/registry", "Registry", Blocks],
] as const;
const projectNav = [
  ["mission", "Mission", FolderKanban],
  ["requirements", "Requirements", ListChecks],
  ["operations", "Operations", SlidersHorizontal],
  ["workflow", "Workflow", Route],
  ["lineage", "Lineage", GitBranch],
  ["release", "Release", PackageCheck],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const router = useRouter();
  const { state, dispatch, hydrated } = useWorkspace();
  const [open, setOpen] = useState(false);
  const isProject = pathname.startsWith("/projects/");
  const routeProjectId =
    typeof params.projectId === "string" ? params.projectId : undefined;
  const routeProject = routeProjectId
    ? state.projects.find((item) => item.id === routeProjectId)
    : undefined;
  const projectId = routeProject?.id ?? state.activeProjectId;
  const project =
    routeProject ??
    (!isProject
      ? state.projects.find((item) => item.id === state.activeProjectId)
      : undefined);
  useEffect(() => {
    if (
      isProject &&
      routeProject &&
      routeProject.id !== state.activeProjectId
    ) {
      dispatch({ type: "SWITCH_PROJECT", projectId: routeProject.id });
    }
  }, [dispatch, isProject, routeProject, state.activeProjectId]);
  const chooseProject = (id: string) => {
    dispatch({ type: "SWITCH_PROJECT", projectId: id });
    setOpen(false);
    router.push(`/projects/${id}/mission`);
  };
  const resetWorkspace = async () => {
    try {
      await clearAttachments();
    } finally {
      dispatch({ type: "RESET" });
    }
  };
  const resetProject = async () => {
    try {
      await Promise.all(
        state.projectStates[projectId].requirements.attachments.map(
          (attachment) => deleteAttachment(attachment.storageKey),
        ),
      );
    } finally {
      dispatch({ type: "RESET_PROJECT", projectId });
    }
  };
  const navigation = (
    <>
      <Link
        className="brand shell-brand"
        href="/portfolio"
        onClick={() => setOpen(false)}
      >
        <span className="brand-mark">
          <Activity size={16} />
        </span>
        <span>SignalOps</span>
      </Link>
      <div className="environment">Workspace</div>
      <nav className="shell-nav" aria-label="Global navigation">
        {globalNav.map(([href, label, Icon]) => (
          <Link
            className={pathname === href ? "active" : ""}
            key={href}
            href={href}
            onClick={() => setOpen(false)}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="nav-divider" />
      <label className="project-picker-label">
        Active project
        <select
          className="project-picker"
          value={projectId}
          onChange={(event) => chooseProject(event.target.value)}
        >
          {state.projects.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <nav className="shell-nav project-links" aria-label="Project navigation">
        {projectNav.map(([route, label, Icon]) => {
          const href = `/projects/${projectId}/${route}`;
          return (
            <Link
              className={pathname === href ? "active" : ""}
              key={route}
              href={href}
              onClick={() => setOpen(false)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shell-bottom">
        <button className="button ghost" onClick={resetWorkspace}>
          <RefreshCw size={14} /> Reset workspace
        </button>
        <p>
          <span className="dot" /> Saved locally · v2
        </p>
      </div>
    </>
  );
  return (
    <main className="workspace-shell" aria-busy={!hydrated}>
      <aside className="workspace-sidebar">{navigation}</aside>
      {open ? (
        <div className="mobile-drawer-backdrop" onClick={() => setOpen(false)}>
          <aside
            className="mobile-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="drawer-close"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
            {navigation}
          </aside>
        </div>
      ) : null}
      <div className="workspace-main">
        <header className="context-bar">
          <button
            className="menu-trigger"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <div className="context-copy">
            <span>{isProject ? "Project workspace" : "Global workspace"}</span>
            <strong>
              {isProject
                ? (project?.name ?? "Project not found")
                : pathname.slice(1).replaceAll("-", " ") || "Portfolio"}
            </strong>
          </div>
          {isProject && project ? (
            <div className="context-meta">
              <span>{project.owner}</span>
              <span className={`health-dot ${project.health}`} />
              <button className="button small" onClick={resetProject}>
                <PanelLeftClose size={13} /> Reset project
              </button>
            </div>
          ) : !isProject ? (
            <div className="context-meta">
              <span>{state.projects.length} active projects</span>
            </div>
          ) : null}
        </header>
        <div className="route-content">{children}</div>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile global navigation">
        {globalNav.map(([href, label, Icon]) => (
          <Link
            className={pathname === href ? "active" : ""}
            href={href}
            key={href}
            aria-label={label}
          >
            <Icon size={18} />
            <small>{label}</small>
          </Link>
        ))}
      </nav>
    </main>
  );
}
