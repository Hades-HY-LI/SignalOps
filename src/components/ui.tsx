"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

const statusHelp: Record<string, string> = {
  pending: "Required evidence or work has not started yet.",
  active: "Work is in progress and its completion evidence is not final.",
  blocked: "A failed gate or unresolved dependency prevents progress.",
  complete: "The required evidence exists and its gate has passed.",
  aligned: "The artifact references the current published requirement version.",
  stale: "The artifact references an older requirement version and needs review.",
  not_required: "The saved source plan does not require this workstream.",
  simulated: "The state comes from a visibly simulated local connector or fixture.",
  healthy: "No current project blocker is recorded.",
  at_risk: "A recorded risk may affect the next milestone or deadline.",
  promoted: "The dataset passed its required evaluation and received a promote decision.",
  held: "A hold decision was recorded with rationale.",
  passed: "The calculated threshold was met.",
  failed: "The calculated threshold was not met.",
  planning: "The project is defining requirements, sources, and operating scope.",
  collecting: "Approved sources are currently producing or returning records.",
  quality_review: "Returned data is moving through quality review and remediation.",
  release_ready: "Required quality evidence exists and the dataset can enter evaluation.",
  signal_detected: "A product or research signal exists, but operational setup has not started.",
  requirements_aligned: "Requirement-dependent artifacts reference the current version.",
  sources_active: "At least one configured source is actively producing records.",
  qa_blocked: "A critical delivery QA gate failed and requires resolution.",
  remediation_requested: "A correction request has been recorded for the failed delivery.",
  corrected_received: "A corrected delivery is available for another QA pass.",
  internal_review_complete: "Required in-house review evidence has passed.",
  available: "The vendor reports capacity for new or expanded work.",
  limited: "The vendor has constrained near-term capacity.",
  unavailable: "The vendor is not available for new work.",
  expand: "Current score and trajectory support increasing allocation.",
  maintain: "Current evidence supports keeping allocation steady.",
  remediate: "Performance needs a corrective plan before allocation expands.",
  pause: "Current evidence does not support assigning additional work.",
  executable: "The registry definition has a runnable adapter in this prototype.",
  template: "The registry definition is reusable but has no active execution here.",
  connected: "A connector configuration is recorded and available to assigned projects.",
  draft: "The artifact can still change and is not an immutable release candidate.",
  candidate: "The immutable dataset is awaiting required evaluation and a final decision.",
  not_requested: "No evaluation handoff has been created.",
  requested: "An evaluation handoff has been created and awaits acceptance.",
  accepted: "The evaluation owner accepted the handoff but has not started execution.",
  running: "The evaluation owner is currently executing the requested checks.",
  results_submitted: "Evaluation results were returned and await decision review.",
  decision_ready: "All required evaluation evidence is present for a decision.",
  planned: "The work item is configured but has not begun.",
  pilot: "The vendor engagement is in a limited validation phase.",
  production: "The vendor engagement is approved for ongoing production work.",
  paused: "The work item is intentionally stopped pending a decision or dependency.",
  proceed: "Pilot evidence supports continuing the engagement.",
  hold: "Pilot evidence needs review before the engagement can proceed.",
  in_progress: "The batch has begun but is not fully synchronized and quality-approved.",
  completed: "The batch is fully synchronized and its aggregate QA passed.",
  qa_failed: "The batch completed but did not meet the aggregate QA threshold.",
  open: "The item still needs action or acknowledgement.",
  resolved: "The requested follow-up was completed.",
  sent: "The remediation request was recorded as delivered.",
};

export function Status({
  value,
  detail,
}: {
  value: string;
  detail?: string;
}) {
  const label = value.replaceAll("_", " ");
  const variant =
    value === "quality_review" || value === "qa_blocked"
      ? "blocked"
      : value === "release_ready" || value === "healthy" || value === "passed"
        ? "complete"
        : value;
  const explanation = detail ?? statusHelp[value];
  return (
    <span
      className={`status ${variant}`}
      title={explanation}
      aria-label={explanation ? `${label}: ${explanation}` : label}
    >
      {label}
    </span>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-intro">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="button-row">{actions}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <article className={`card ${className}`}>{children}</article>;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div>
        {icon}
        <strong>{title}</strong>
        <p>{text}</p>
        {action}
      </div>
    </div>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstControl = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    firstControl?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (controls.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadCsv(filename: string, rows: object[]) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    keys.map(escape).join(","),
    ...rows.map((row) =>
      keys
        .map((key) => escape((row as Record<string, unknown>)[key]))
        .join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
