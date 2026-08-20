"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileText,
  Layers3,
  PackageCheck,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { getAttachment, putAttachment } from "@/lib/attachments";
import {
  buildLineageGraph,
  getReleaseEligibility,
  scoreVendor,
} from "@/lib/domain";
import {
  buildDatasetExport,
  buildEvaluationHandoffPackage,
  datasetExportRows,
} from "@/lib/exports";
import { DEMO_NOW } from "@/lib/fixtures";
import {
  canPromoteDataset,
  useWorkspace,
} from "@/lib/workspace";
import { buildReleaseCheckpoints } from "@/lib/status";
import type {
  EvaluationMetricResult,
  Project,
  RequirementAttachment,
} from "@/lib/types";
import {
  Card,
  downloadCsv,
  downloadJson,
  EmptyState,
  Modal,
  PageIntro,
  Status,
} from "./ui";
import { visibleWidgets, WidgetManager } from "./widget-manager";

const LineageMap = dynamic(
  () => import("./lineage-map").then((m) => m.LineageMap),
  {
    ssr: false,
    loading: () => (
      <div className="lineage-shell empty-state">Preparing lineage graph…</div>
    ),
  },
);
type ProjectViewName =
  | "mission"
  | "requirements"
  | "operations"
  | "workflow"
  | "lineage"
  | "release";

function useProjectContext() {
  const params = useParams<{ projectId: string }>();
  const { state, dispatch } = useWorkspace();
  const id =
    typeof params.projectId === "string"
      ? params.projectId
      : state.activeProjectId;
  const project = state.projects.find((p) => p.id === id);
  if (!project || !state.projectStates[project.id]) {
    throw new Error(`Unknown project route: ${id}`);
  }
  const ps = state.projectStates[project.id];
  return { state, dispatch, project, ps, id: project.id };
}

export function ProjectView({ view }: { view: ProjectViewName }) {
  const params = useParams<{ projectId: string }>();
  const { state } = useWorkspace();
  const id =
    typeof params.projectId === "string"
      ? params.projectId
      : state.activeProjectId;
  if (!state.projectStates[id])
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="Project not found"
        text="Return to the portfolio and choose an available project."
      />
    );
  if (view === "mission") return <Mission />;
  if (view === "requirements") return <Requirements />;
  if (view === "operations") return <Operations />;
  if (view === "workflow") return <Workflow />;
  if (view === "lineage") return <Lineage />;
  return <Release />;
}

function ProjectBadge({ project }: { project: Project }) {
  return (
    <div className="project-badge">
      <Status value={project.health} />
      <span>{project.modality}</span>
      <span>Due {project.deadline}</span>
    </div>
  );
}

function requirementValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "None";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "None");
}

function Mission() {
  const { project, ps, id, dispatch } = useProjectContext();
  const [manage, setManage] = useState(false);
  const widgets = visibleWidgets(ps.missionConfig);
  const values: Record<string, [string, string, string]> = {
    target_metric: [
      "Target metric",
      `${ps.scenario.program.target}%`,
      `Baseline ${ps.scenario.program.baseline}%`,
    ],
    release_readiness: [
      "Release readiness",
      `${project.releaseReadiness}%`,
      project.nextDecision,
    ],
    source_status: [
      "Sources",
      String(ps.sourcePlan.filter((x) => x.targetRecords > 0).length),
      ps.sourcePlanStatus,
    ],
    quality_status: [
      "Quality",
      ps.scenario.qaReport?.passed
        ? "Passing"
        : ps.scenario.qaReport
          ? "Blocked"
          : "Pending",
      ps.scenario.qaReport
        ? `${ps.scenario.qaReport.gates.filter((g) => g.passed).length}/${ps.scenario.qaReport.gates.length} gates`
        : "Not run",
    ],
    blockers: [
      "Open blockers",
      String(project.blockers.length),
      project.blockers[0] ?? "No blockers",
    ],
    owners: ["Owners", "3", `${project.owner} · ${project.researchOwner}`],
  };
  return (
    <>
      <PageIntro
        eyebrow="Project / Mission control"
        title={project.name}
        description={project.summary}
        actions={
          <>
            <ProjectBadge project={project} />
            <button className="button" onClick={() => setManage(true)}>
              <Settings2 size={14} /> Widgets
            </button>
          </>
        }
      />
      <div className="preset-bar">
        <div className="preset-copy">
          <strong>Dashboard view</strong>
          <small>Changes the KPI set; it does not change project data.</small>
        </div>
        {(
          ["delivery_health", "source_operations", "release_readiness"] as const
        ).map((p) => (
          <button
            className={ps.missionConfig.preset === p ? "active" : ""}
            key={p}
            aria-pressed={ps.missionConfig.preset === p}
            title={`Show ${p.replaceAll("_", " ")} widgets`}
            onClick={() =>
              dispatch({
                type: "SET_DASHBOARD_PRESET",
                scope: "project",
                preset: p,
                projectId: id,
              })
            }
          >
            {p.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        {widgets.map((w) => {
          const v = values[w.id];
          return (
            <Card className="kpi-widget" key={w.id}>
              <span>{v[0]}</span>
              <strong>{v[1]}</strong>
              <p>{v[2]}</p>
            </Card>
          );
        })}
      </div>
      <div className="grid grid-2 route-section">
        <Card className="dark">
          <div className="eyebrow">Decision focus</div>
          <h2 className="big-card-title">{project.nextDecision}</h2>
          <p className="subtle">
            Resolve the current operating constraint to advance the project
            toward release.
          </p>
          <div className="decision-provenance">
            <span className="calc-label">Auto-derived</span>
            <p>
              Generated from the project stage, blockers, sourcing status, and
              latest evaluation state stored in this workspace.
            </p>
            <div className="tag-row">
              <span className="tag">
                Stage · {project.stage.replaceAll("_", " ")}
              </span>
              <span className="tag">Sources · {ps.sourcePlanStatus}</span>
              <span className="tag">
                Evaluation · {project.evaluationStatus.replaceAll("_", " ")}
              </span>
            </div>
          </div>
          <div className="button-row">
            <Link
              className="button primary"
              href={`/projects/${id}/operations`}
            >
              Open operations <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
        <Card>
          <div className="card-header">
            <h3>Current source plan</h3>
            <span className="calc-label sim-label">Live calculation</span>
          </div>
          {ps.sourcePlan.map((s) => (
            <div className="kv" key={s.source}>
              <span>
                {s.source} · {s.share}%
              </span>
              <b>{s.targetRecords.toLocaleString()} records</b>
            </div>
          ))}
        </Card>
      </div>
      {manage ? (
        <WidgetManager
          config={ps.missionConfig}
          scope="project"
          projectId={id}
          dispatch={dispatch}
          onClose={() => setManage(false)}
        />
      ) : null}
    </>
  );
}

function Requirements() {
  const { state, project, ps, id, dispatch } = useProjectContext();
  const req = ps.requirements;
  const [reason, setReason] = useState("");
  const [compare, setCompare] = useState(req.versions.at(-1)?.version ?? "");
  const [uploadError, setUploadError] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [recipient, setRecipient] = useState(project.owner);
  const [message, setMessage] = useState(
    "Please align the linked artifact to the latest requirement.",
  );
  const [reminderDue, setReminderDue] = useState(project.deadline);
  const draft = req.draft;
  const totalShare = ps.sourcePlan.reduce((sum, item) => sum + item.share, 0);
  const plannedRecords = ps.sourcePlan.reduce(
    (sum, item) => sum + item.targetRecords,
    0,
  );
  const vendorPlan = ps.sourcePlan.find((item) => item.source === "vendor");
  const vendorMatches = state.vendors
    .map((item) => ({ vendor: item, score: scoreVendor(item.metrics) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const edit = (
    changes: Parameters<typeof dispatch>[0] extends never
      ? never
      : Partial<typeof draft>,
  ) => dispatch({ type: "EDIT_REQUIREMENT_DRAFT", projectId: id, changes });
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = [
      "text/markdown",
      "text/plain",
      "application/json",
      "application/pdf",
    ];
    const allowedExtensions = ["md", "txt", "json", "pdf"];
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    const inferredType =
      file.type ||
      (
        {
          md: "text/markdown",
          txt: "text/plain",
          json: "application/json",
          pdf: "application/pdf",
        } as Record<string, string>
      )[extension ?? ""];
    if (
      file.size > 2 * 1024 * 1024 ||
      !extension ||
      !allowedExtensions.includes(extension) ||
      !allowed.includes(inferredType)
    ) {
      setUploadError("Use .md, .txt, .json, or .pdf files up to 2 MB.");
      return;
    }
    const storageKey = `${id}/${Date.now()}-${file.name}`;
    try {
      const storedBlob = file.type
        ? file
        : new Blob([file], { type: inferredType });
      await putAttachment(storageKey, storedBlob);
      const attachment: RequirementAttachment = {
        id: `attachment-${id}-${Date.now()}`,
        name: file.name,
        mimeType: inferredType as RequirementAttachment["mimeType"],
        size: file.size,
        storageKey,
        uploadedAt: DEMO_NOW,
        uploadedBy: project.researchOwner,
      };
      dispatch({ type: "ADD_ATTACHMENT", projectId: id, attachment });
      setUploadError("");
    } catch {
      setUploadError("Local attachment storage is unavailable.");
    }
  };
  const openAttachment = async (a: RequirementAttachment) => {
    const blob = await getAttachment(a.storageKey);
    if (!blob) {
      setUploadError(
        "This local file is no longer available in browser storage.",
      );
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const version = req.versions.find((v) => v.version === compare);
  const versionIndex = req.versions.findIndex((v) => v.version === compare);
  const previousVersion =
    versionIndex > 0 ? req.versions[versionIndex - 1] : undefined;
  return (
    <>
      <PageIntro
        eyebrow="Project / Requirements"
        title="Requirement contract"
        description="Edit structured research intent, publish traceable versions, and keep downstream work aligned."
        actions={
          <>
            <Status value={ps.sourcePlanStatus} />
            <span className="mono subtle">Current {req.currentVersion}</span>
          </>
        }
      />
      <div className="requirements-layout">
        <div className="stack">
          <Card>
            <div className="card-header">
              <div>
                <h3>Structured draft</h3>
                <p className="subtle">
                  Publishing creates a new immutable version.
                </p>
              </div>
              <span className="calc-label sim-label">Editable draft</span>
            </div>
            <div className="document-origin-panel">
              <div>
                <strong>Requirement source documents</strong>
                <p>
                  This is the single document library for the source brief and
                  supporting requirement evidence. The structured fields below
                  are the working interpretation that receives an immutable
                  version when published.
                </p>
              </div>
              <label className="upload-control compact-upload">
                <Upload size={15} /> Add requirement document
                <input
                  type="file"
                  accept=".md,.txt,.json,.pdf"
                  onChange={upload}
                />
              </label>
              <div className="document-library-inline">
                <span className="mono subtle">
                  {req.attachments.length} document
                  {req.attachments.length === 1 ? "" : "s"} linked · local
                  browser storage
                </span>
                {uploadError ? (
                  <p className="error-text" role="alert">
                    {uploadError}
                  </p>
                ) : null}
                {req.attachments.length ? (
                  req.attachments.map((attachment) => (
                    <button
                      className="list-row document-row"
                      key={attachment.id}
                      onClick={() => openAttachment(attachment)}
                    >
                      <span>
                        <strong>{attachment.name}</strong>
                        <small>
                          Source document · {attachment.mimeType} ·{" "}
                          {(attachment.size / 1024).toFixed(1)} KB
                        </small>
                      </span>
                      <span className="button small">
                        Preview <FileText size={14} />
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="subtle">
                    No requirement documents linked yet. Files are preserved as
                    source evidence; their contents are not automatically
                    parsed or diffed.
                  </p>
                )}
              </div>
            </div>
            <div className="form-stack">
              <label>
                Target behavior
                <textarea
                  value={draft.targetBehavior}
                  onChange={(e) => edit({ targetBehavior: e.target.value })}
                />
              </label>
              <label>
                Scope
                <textarea
                  value={draft.scope}
                  onChange={(e) => edit({ scope: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  Target slices
                  <input
                    value={draft.slices.join(", ")}
                    onChange={(e) =>
                      edit({
                        slices: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label>
                  Exclusions
                  <input
                    value={draft.exclusions.join(", ")}
                    onChange={(e) =>
                      edit({
                        exclusions: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label>
                  Owner
                  <input
                    value={draft.owner}
                    onChange={(e) => edit({ owner: e.target.value })}
                  />
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => edit({ dueDate: e.target.value })}
                  />
                </label>
                <label>
                  Gold accuracy
                  <input
                    type="number"
                    step=".01"
                    value={draft.thresholds.goldAccuracy}
                    onChange={(e) =>
                      edit({
                        thresholds: {
                          ...draft.thresholds,
                          goldAccuracy: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Max disagreement
                  <input
                    type="number"
                    step=".01"
                    value={draft.thresholds.maxDisagreement}
                    onChange={(e) =>
                      edit({
                        thresholds: {
                          ...draft.thresholds,
                          maxDisagreement: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Required change reason
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What changed and why?"
                />
              </label>
              <button
                className="button dark"
                disabled={!reason.trim()}
                onClick={() => {
                  dispatch({
                    type: "PUBLISH_REQUIREMENT",
                    projectId: id,
                    reason,
                  });
                  setReason("");
                }}
              >
                <Send size={14} /> Publish next version
              </button>
            </div>
          </Card>
          <Card>
            <div className="card-header">
              <div>
                <h3>Source plan</h3>
                <p className="subtle">
                  Edit volume, allocation, cost, confidence, and turnaround for
                  this project.
                </p>
              </div>
              <Status value={ps.sourcePlanStatus} />
            </div>
            <div className="stack">
              {ps.sourcePlan.map((source) => (
                <div className="engagement" key={source.source}>
                  <strong>{source.source.replaceAll("_", " ")}</strong>
                  <div className="form-grid">
                    <label>
                      Target records
                      <input
                        type="number"
                        min="0"
                        value={source.targetRecords}
                        onChange={(event) =>
                          dispatch({
                            type: "EDIT_SOURCE_PLAN_ITEM",
                            projectId: id,
                            source: source.source,
                            changes: {
                              targetRecords: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Share %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={source.share}
                        onChange={(event) =>
                          dispatch({
                            type: "EDIT_SOURCE_PLAN_ITEM",
                            projectId: id,
                            source: source.source,
                            changes: { share: Number(event.target.value) },
                          })
                        }
                      />
                    </label>
                    <label>
                      Estimated cost
                      <input
                        type="number"
                        min="0"
                        value={source.estimatedCost}
                        onChange={(event) =>
                          dispatch({
                            type: "EDIT_SOURCE_PLAN_ITEM",
                            projectId: id,
                            source: source.source,
                            changes: {
                              estimatedCost: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Confidence
                      <select
                        value={source.confidence}
                        onChange={(event) =>
                          dispatch({
                            type: "EDIT_SOURCE_PLAN_ITEM",
                            projectId: id,
                            source: source.source,
                            changes: {
                              confidence: event.target.value as
                                | "high"
                                | "medium"
                                | "low",
                            },
                          })
                        }
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                    <label>
                      Turnaround
                      <input
                        value={source.turnaround}
                        onChange={(event) =>
                          dispatch({
                            type: "EDIT_SOURCE_PLAN_ITEM",
                            projectId: id,
                            source: source.source,
                            changes: { turnaround: event.target.value },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="source-plan-summary">
              <div>
                <span>Allocation</span>
                <b className={totalShare === 100 ? "good-text" : "error-text"}>
                  {totalShare}% / 100%
                </b>
              </div>
              <div>
                <span>Planned records</span>
                <b>{plannedRecords.toLocaleString()}</b>
              </div>
              <div>
                <span>Vendor budget</span>
                <b>${(vendorPlan?.estimatedCost ?? 0).toLocaleString()}</b>
              </div>
            </div>
            <div className="button-row source-plan-actions">
              <button
                className="button primary"
                disabled={
                  totalShare !== 100 || ps.sourcePlanStatus === "aligned"
                }
                onClick={() =>
                  dispatch({ type: "SAVE_SOURCE_PLAN", projectId: id })
                }
              >
                <Check size={14} /> Save source plan
              </button>
              <Link className="button" href={`/projects/${id}/operations`}>
                Review vendor match <ArrowRight size={13} />
              </Link>
              <span className="subtle">
                {ps.sourcePlanStatus === "aligned"
                  ? "Saved in this browser and linked to the current requirement."
                  : totalShare === 100
                    ? "Unsaved source-plan changes."
                    : "Allocation must total 100% before saving."}
              </span>
            </div>
            <div className="vendor-match-preview">
              <div className="card-header">
                <div>
                  <h4>Vendor scorecard connection</h4>
                  <p className="subtle">
                    Matching combines the directory score with project modality,
                    capacity, availability, and the vendor share above.
                  </p>
                </div>
                <span className="calc-label">Live ranking</span>
              </div>
              {vendorMatches.map(({ vendor: item, score }) => (
                <div className="kv" key={item.id}>
                  <span>
                    {item.name} · {item.availability}
                  </span>
                  <b>
                    {score}/100 · {item.weeklyCapacity.toLocaleString()}/wk
                  </b>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <div className="card-header">
              <h3>Version history & compare</h3>
              <FileText size={17} />
            </div>
            <label>
              Compare published version
              <select
                value={compare}
                onChange={(e) => setCompare(e.target.value)}
              >
                {req.versions.map((v) => (
                  <option key={v.version}>{v.version}</option>
                ))}
              </select>
            </label>
            {version ? (
              <div className="version-panel">
                <Status value="complete" />
                <h3>{version.version}</h3>
                <p>{version.changeReason}</p>
                <p className="subtle">
                  {version.publishedBy} · {version.publishedAt.slice(0, 10)}
                </p>
                <div className="kv">
                  <span>Changed fields</span>
                  <b>{version.changedFields.length}</b>
                </div>
                <div className="kv">
                  <span>Gold threshold</span>
                  <b>{Math.round(version.thresholds.goldAccuracy * 100)}%</b>
                </div>
                <div className="kv">
                  <span>Slices</span>
                  <b>{version.slices.length}</b>
                </div>
                <h4 className="subsection-title">Field-level changes</h4>
                {version.changedFields.length ? (
                  version.changedFields.map((field) => (
                    <div className="version-diff" key={field}>
                      <strong>{field.replaceAll(/([A-Z])/g, " $1")}</strong>
                      <small>
                        Previous:{" "}
                        {requirementValue(
                          previousVersion?.[
                            field as keyof typeof previousVersion
                          ],
                        )}
                      </small>
                      <span>
                        Current:{" "}
                        {requirementValue(
                          version[field as keyof typeof version],
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="subtle">
                    No field changes from the previous version.
                  </p>
                )}
              </div>
            ) : null}
            <h4 className="subsection-title">Chronological change log</h4>
            {req.versions.map((item) => (
              <div className="audit-item" key={item.version}>
                <strong>
                  {item.version} · {item.changeReason}
                </strong>
                <p>
                  {item.publishedBy} · {item.publishedAt.slice(0, 10)} ·{" "}
                  {item.changedFields.join(", ") || "no fields"}
                </p>
              </div>
            ))}
          </Card>
          <Card>
            <div className="card-header">
              <h3>Downstream alignment</h3>
              <Status value={ps.sourcePlanStatus} />
            </div>
            {ps.scenario.artifacts.map((a) => (
              <div className="kv" key={a.id}>
                <span>
                  {a.name} · {a.version}
                </span>
                <Status value={a.status} />
              </div>
            ))}
            <div className="kv">
              <span>Vendor engagements</span>
              <b>
                {
                  ps.vendorEngagements.filter((e) => e.status === "stale")
                    .length
                }{" "}
                stale
              </b>
            </div>
            <div className="kv">
              <span>Workflow stages</span>
              <b>
                {ps.workflowStages.filter((s) => s.status === "stale").length}{" "}
                stale
              </b>
            </div>
          </Card>
          <Card>
            <div className="card-header">
              <h3>Alignment reminders</h3>
              <button
                className="button small"
                onClick={() => setReminderOpen(true)}
              >
                <Plus size={13} /> Add
              </button>
            </div>
            {req.reminders.map((r) => (
              <div className="list-row static" key={r.id}>
                <span>
                  <strong>{r.recipient}</strong>
                  <small>
                    Due {r.dueDate} · {r.message} · simulated delivery
                  </small>
                </span>
                {r.status === "open" ? (
                  <button
                    className="button small"
                    onClick={() =>
                      dispatch({
                        type: "RESOLVE_REMINDER",
                        projectId: id,
                        reminderId: r.id,
                      })
                    }
                  >
                    Resolve
                  </button>
                ) : (
                  <Status value="complete" />
                )}
              </div>
            ))}
            {!req.reminders.length ? (
              <p className="subtle">No reminders created.</p>
            ) : null}
          </Card>
        </div>
      </div>
      {reminderOpen ? (
        <Modal
          title="Create alignment reminder"
          description="Reminder delivery is simulated and stored locally."
          onClose={() => setReminderOpen(false)}
        >
          <div className="form-stack">
            <label>
              Recipient
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </label>
            <label>
              Message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label>
              Due date
              <input
                type="date"
                value={reminderDue}
                onChange={(event) => setReminderDue(event.target.value)}
              />
            </label>
            <button
              className="button dark"
              onClick={() => {
                dispatch({
                  type: "ADD_REMINDER",
                  projectId: id,
                  reminder: { recipient, dueDate: reminderDue, message },
                });
                setReminderOpen(false);
              }}
            >
              Create simulated reminder
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function Operations() {
  const { state, project, ps, id, dispatch } = useProjectContext();
  const scenario = ps.scenario;
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchName, setBatchName] = useState("Priority review batch");
  const [vendor, setVendor] = useState(state.vendors[0]?.id ?? "");
  const selectedVendor = state.vendors.find((item) => item.id === vendor);
  const snapshot = ps.internalOpsSnapshots.at(-1);
  const vendorSource = ps.sourcePlan.find((item) => item.source === "vendor");
  const internalSource = ps.sourcePlan.find(
    (item) => item.source === "internal",
  );
  const projectDataset = state.datasets.find((item) => item.projectId === id);
  const qa = scenario.qaReport;
  const flagged = qa?.gates.flatMap((g) => (g.passed ? [] : g.recordIds))[0];
  const completeBatch = (batchId: string, total: number) => {
    dispatch({
      type: "SYNC_INTERNAL_BATCH",
      projectId: id,
      batchId,
      completedTasks: total,
    });
  };
  const importBatch = (batchId: string) => {
    dispatch({
      type: "IMPORT_INTERNAL_RESULT",
      projectId: id,
      batchId,
      aggregateQA: 0.94,
    });
  };
  return (
    <>
      <PageIntro
        eyebrow="Project / Source operations"
        title="Collection operations"
        description="Coordinate vendor delivery and in-house throughput without exposing record-level annotation."
        actions={<ProjectBadge project={project} />}
      />
      <div className="grid grid-2">
        <Card className="vendor-engagement-card">
          <span id="vendor-engagement" className="anchor-target" />
          <div className="card-header">
            <div>
              <h3>Vendor engagement</h3>
              <p className="subtle">
                Select operating partners and inspect pilot economics.
              </p>
            </div>
            <Boxes size={17} />
          </div>
          <div className="form-grid">
            <label>
              Available vendor
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              >
                {state.vendors.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button primary field-button"
              onClick={() =>
                dispatch({
                  type: "SELECT_VENDOR",
                  projectId: id,
                  vendorId: vendor,
                })
              }
            >
              Add engagement
            </button>
          </div>
          {selectedVendor ? (
            <div className="vendor-fit-strip">
              <div>
                <span>Weighted score</span>
                <b>{scoreVendor(selectedVendor.metrics)}/100</b>
              </div>
              <div>
                <span>Throughput score</span>
                <b>{selectedVendor.metrics.throughput}/100</b>
              </div>
              <div>
                <span>Weekly capacity</span>
                <b>{selectedVendor.weeklyCapacity.toLocaleString()}</b>
              </div>
              <div>
                <span>Rate</span>
                <b>${selectedVendor.rate}/task</b>
              </div>
              <div>
                <span>Plan demand</span>
                <b>{(vendorSource?.targetRecords ?? 0).toLocaleString()}</b>
              </div>
            </div>
          ) : null}
          {ps.vendorEngagements.map((e) => {
            const v = state.vendors.find((x) => x.id === e.vendorId)!;
            const pilots = state.vendorPilots.filter(
              (p) => p.projectId === id && p.vendorId === e.vendorId,
            );
            return (
              <div className="engagement" key={e.id}>
                <div className="card-header">
                  <div>
                    <strong>{v?.name}</strong>
                    <p className="subtle">
                      {e.workPackageVersion} · requirement{" "}
                      {e.requirementVersion}
                    </p>
                  </div>
                  <Status value={e.status} />
                </div>
                {pilots.map((p) => (
                  <div className="pilot-grid" key={p.id}>
                    <span>{p.version}</span>
                    <b>{p.taskCount} tasks</b>
                    <b>${p.totalCost}</b>
                    <b>{p.turnaroundHours}h</b>
                    <b>{p.throughputPerDay}/day</b>
                    <b>{Math.round(p.quality * 100)}% quality</b>
                    <Status value={p.decision} />
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
        <Card className="anchor-card">
          <span className="anchor-target" id="in-house" />
          <div className="card-header">
            <div>
              <h3>In-house management</h3>
              <p className="subtle">
                Track data entering the external annotation platform, aggregate
                processing progress, and data returned to unified QA.
              </p>
            </div>
            <Users size={17} />
          </div>
          <div
            className="ops-data-route"
            role="region"
            aria-label="In-house data flow"
          >
            <div>
              <span>Input source</span>
              <b>
                {(internalSource?.targetRecords ?? 0).toLocaleString()} planned
                records
              </b>
              <small>
                Source plan · requirement {ps.requirements.currentVersion}
              </small>
            </div>
            <ArrowRight size={15} />
            <div>
              <span>Processing</span>
              <b>Annotation platform</b>
              <small>Batch sync · calibration · human QC</small>
            </div>
            <ArrowRight size={15} />
            <div>
              <span>Destination</span>
              <b>Unified quality layer</b>
              <small>Aggregate QA result and dataset eligibility</small>
            </div>
          </div>
          <p className="source-note">
            <span className="sim-label">Browser-local sync</span>
            {snapshot
              ? ` Latest operational snapshot: ${snapshot.capturedAt.slice(0, 10)}. Metrics are imported from the simulated annotation-platform connector.`
              : " No operational snapshot has been imported. Create a batch, then sync external progress to populate throughput and QA."}
          </p>
          {snapshot ? (
            <>
              <div className="grid grid-3 mini-stats">
                <div>
                  <span>Backlog</span>
                  <b>{snapshot.backlog}</b>
                </div>
                <div>
                  <span>Completed</span>
                  <b>{snapshot.completedTasks}</b>
                </div>
                <div>
                  <span>Daily throughput</span>
                  <b>{snapshot.dailyThroughput}</b>
                </div>
                <div>
                  <span>Median cycle</span>
                  <b>{snapshot.medianCycleHours}h</b>
                </div>
                <div>
                  <span>SLA</span>
                  <b>{Math.round(snapshot.slaAttainment * 100)}%</b>
                </div>
                <div>
                  <span>Capacity</span>
                  <b>{snapshot.availableCapacity}</b>
                </div>
                <div>
                  <span>Calibration</span>
                  <b>{Math.round(snapshot.calibrationAgreement * 100)}%</b>
                </div>
                <div>
                  <span>Escalation</span>
                  <b>{Math.round(snapshot.escalationRate * 100)}%</b>
                </div>
                <div>
                  <span>QC failure</span>
                  <b>{Math.round(snapshot.qcFailureRate * 100)}%</b>
                </div>
              </div>
              <div className="grid grid-2 ops-breakdown">
                <div>
                  <h4>Team allocation</h4>
                  {snapshot.teamAllocation.map((item) => (
                    <div className="kv" key={item.team}>
                      <span>{item.team}</span>
                      <b>{item.tasks} tasks</b>
                    </div>
                  ))}
                </div>
                <div>
                  <h4>Defect taxonomy</h4>
                  {snapshot.defectTaxonomy.map((item) => (
                    <div className="kv" key={item.label}>
                      <span>{item.label}</span>
                      <b>{item.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          <div className="button-row">
            <button className="button" onClick={() => setBatchOpen(true)}>
              <Plus size={14} /> Create batch
            </button>
          </div>
          {ps.internalWorkBatches.length ? (
            ps.internalWorkBatches.map((b) => (
              <div className="batch-row" key={b.id}>
                <div>
                  <strong>{b.name}</strong>
                  <small>
                    {b.team} · {b.completedTasks}/{b.totalTasks} ·{" "}
                    {b.aggregateQA
                      ? `${Math.round(b.aggregateQA * 100)}% QA`
                      : "QA pending"}
                  </small>
                  <div className="progress">
                    <i
                      style={{
                        width: `${b.totalTasks ? (b.completedTasks / b.totalTasks) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="button-row">
                  <Status value={b.status} />
                  {b.completedTasks < b.totalTasks ? (
                    <button
                      className="button small"
                      onClick={() => completeBatch(b.id, b.totalTasks)}
                    >
                      <RefreshCw size={12} /> Sync
                    </button>
                  ) : !b.aggregateQA ? (
                    <button
                      className="button small"
                      onClick={() => importBatch(b.id)}
                    >
                      <Upload size={12} /> Import results
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<Users />}
              title="No in-house batches"
              text="Create a batch to begin internal operations tracking."
            />
          )}
        </Card>
      </div>
      <Card className="route-section anchor-card">
        <span className="anchor-target" id="quality-control" />
        <div className="card-header">
          <div>
            <h3>{project.name} delivery quality control</h3>
            <p className="subtle">
              Layered intake checks, AI-assisted screening, gold calibration,
              human QC, and release gating for incoming data.
            </p>
          </div>
          <Status value={scenario.program.stage} />
        </div>
        <QualityFunnel
          deliveryCount={
            id === "unexpected-vocals"
              ? 48
              : (projectDataset?.recordCount ?? project.recordVolume)
          }
          qa={qa}
          datasetPassed={projectDataset?.qaStatus === "passed"}
          stage={scenario.program.stage}
        />
        {id !== "unexpected-vocals" ? (
          projectDataset ? (
            <div className="notice quality-evidence-notice">
              <ShieldCheck size={16} />
              <div>
                <strong>
                  {projectDataset.version} passed aggregate quality review
                </strong>
                <p>
                  {projectDataset.recordCount.toLocaleString()} accepted records
                  are linked to requirement {projectDataset.requirementVersion}.
                  This seeded project exposes management evidence; the
                  executable record-level defect drill-down remains scoped to
                  Unexpected Vocals.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<ShieldCheck />}
              title="Connect the first delivery"
              text="The quality-control design is ready, but this seeded project has no executable delivery attached. Save a source plan and add a vendor engagement to begin the intake funnel."
              action={
                <div className="button-row">
                  <Link
                    className="button"
                    href={`/projects/${id}/requirements`}
                  >
                    Complete source plan
                  </Link>
                  <a className="button primary" href="#vendor-engagement">
                    Select vendor
                  </a>
                </div>
              }
            />
          )
        ) : (
          <>
            <div className="button-row">
              <button
                className="button"
                disabled={scenario.program.stage !== "signal_detected"}
                onClick={() =>
                  dispatch({ type: "ALIGN_REQUIREMENTS", projectId: id })
                }
              >
                <Check size={13} /> Align
              </button>
              <button
                className="button"
                disabled={scenario.program.stage !== "requirements_aligned"}
                onClick={() =>
                  dispatch({ type: "ACTIVATE_SOURCES", projectId: id })
                }
              >
                <Zap size={13} /> Activate
              </button>
              <button
                className="button primary"
                disabled={
                  ![
                    "sources_active",
                    "qa_blocked",
                    "corrected_received",
                  ].includes(scenario.program.stage)
                }
                onClick={() => dispatch({ type: "RUN_QA", projectId: id })}
              >
                <ShieldCheck size={13} /> Run QA
              </button>
              {flagged && !Object.keys(scenario.vendorDecisions).length ? (
                <button
                  className="button"
                  onClick={() =>
                    dispatch({
                      type: "REVIEW_VENDOR",
                      projectId: id,
                      recordId: flagged,
                      action: "reject",
                      rationale:
                        "Rejected from aggregate quality exception review.",
                    })
                  }
                >
                  <ClipboardCheck size={13} /> Adjudicate exception
                </button>
              ) : null}
              {qa && !qa.passed ? (
                <button
                  className="button danger"
                  disabled={
                    !Object.keys(scenario.vendorDecisions).length ||
                    !!scenario.remediation
                  }
                  onClick={() =>
                    dispatch({ type: "REQUEST_REMEDIATION", projectId: id })
                  }
                >
                  <Send size={13} /> Request remediation
                </button>
              ) : null}
              {scenario.remediation &&
              scenario.activeDelivery === "defective" ? (
                <button
                  className="button primary"
                  onClick={() =>
                    dispatch({ type: "LOAD_CORRECTED", projectId: id })
                  }
                >
                  <RefreshCw size={13} /> Load correction
                </button>
              ) : null}
            </div>
            {qa ? (
              <div className="qa-grid">
                {qa.gates.map((g) => (
                  <div className={`gate ${g.passed ? "" : "fail"}`} key={g.id}>
                    <span className="gate-icon">
                      {g.passed ? <Check /> : <X />}
                    </span>
                    <div>
                      <strong>{g.label}</strong>
                      <small>
                        {g.displayValue} · target {g.threshold}
                      </small>
                    </div>
                    <Status value={g.passed ? "complete" : "blocked"} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="notice">
                Activate sources and run the first automated QA pass.
              </p>
            )}
          </>
        )}
      </Card>
      {batchOpen ? (
        <Modal
          title="Create in-house work batch"
          description="Creates an aggregate operations batch, not an annotation task."
          onClose={() => setBatchOpen(false)}
        >
          <div className="form-stack">
            <label>
              Batch name
              <input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
              />
            </label>
            <button
              className="button dark"
              onClick={() => {
                dispatch({
                  type: "CREATE_INTERNAL_BATCH",
                  projectId: id,
                  batch: {
                    name: batchName,
                    team: "Audio Quality",
                    totalTasks: 100,
                    requirementVersion: ps.requirements.currentVersion,
                  },
                });
                setBatchOpen(false);
              }}
            >
              Create batch
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function QualityFunnel({
  deliveryCount,
  qa,
  datasetPassed,
  stage,
}: {
  deliveryCount: number;
  qa: ReturnType<typeof useProjectContext>["ps"]["scenario"]["qaReport"];
  datasetPassed: boolean;
  stage: ReturnType<
    typeof useProjectContext
  >["ps"]["scenario"]["program"]["stage"];
}) {
  const failed = qa?.blockedCount ?? 0;
  const passed = qa?.acceptedCount ?? (datasetPassed ? deliveryCount : 0);
  const layers = [
    {
      label: "Intake",
      detail: "schema · duplicates · provenance",
      count: deliveryCount,
      state: datasetPassed ? "complete" : deliveryCount ? "active" : "pending",
    },
    {
      label: "AI screen",
      detail: "confidence · anomaly · slice routing",
      count: qa || datasetPassed ? deliveryCount : 0,
      state: qa || datasetPassed ? "complete" : "pending",
    },
    {
      label: "Gold calibration",
      detail: "reference accuracy · disagreement",
      count: qa || datasetPassed ? deliveryCount : 0,
      state: qa
        ? qa.passed
          ? "complete"
          : "blocked"
        : datasetPassed
          ? "complete"
          : "pending",
    },
    {
      label: "Human QC",
      detail: "exception adjudication · rationale",
      count: failed,
      state: failed ? "active" : qa || datasetPassed ? "complete" : "pending",
    },
    {
      label: "Release gate",
      detail: "coverage · aggregate QA · lineage",
      count: passed,
      state:
        qa?.passed || datasetPassed
          ? "complete"
          : stage === "qa_blocked"
            ? "blocked"
            : "pending",
    },
  ];
  return (
    <div
      className="quality-funnel"
      role="region"
      aria-label="Quality-control layers"
    >
      {layers.map((layer, index) => (
        <div className={`quality-layer ${layer.state}`} key={layer.label}>
          <span className="layer-number">{index + 1}</span>
          <div>
            <strong>{layer.label}</strong>
            <small>{layer.detail}</small>
          </div>
          <b>{layer.count.toLocaleString()}</b>
          <Status value={layer.state} />
        </div>
      ))}
    </div>
  );
}

function ReleaseCheckpointPanel({
  checkpoints,
  title = "Release checkpoints",
}: {
  checkpoints: ReturnType<typeof buildReleaseCheckpoints>["checkpoints"];
  title?: string;
}) {
  return (
    <section className="checkpoint-panel" aria-label={title}>
      <div className="section-label-row">
        <div>
          <strong>{title}</strong>
          <p>
            Calculated from linked project evidence. Open any checkpoint to
            inspect its source or resolve its blocker.
          </p>
        </div>
      </div>
      <div className="release-steps">
        {checkpoints.map((checkpoint) => (
          <Step key={checkpoint.id} {...checkpoint} />
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  const { state, ps, project, id } = useProjectContext();
  const assigned = state.registryEntries.filter((entry) =>
    entry.assignedProjectIds.includes(id),
  );
  const primary = assigned.find((entry) => entry.kind === "workflow");
  const { checkpoints } = buildReleaseCheckpoints(state, id);
  const plannedRecords = ps.sourcePlan.reduce(
    (sum, item) => sum + item.targetRecords,
    0,
  );
  return (
    <>
      <PageIntro
        eyebrow="Project / Workflow"
        title="Data production lifecycle"
        description="The operational contract that defines how selected records become quality-approved, evaluation-ready dataset versions."
        actions={<ProjectBadge project={project} />}
      />
      <div className="notice contract-definition">
        <Layers3 size={18} />
        <div>
          <strong>This is an operational data contract, not a legal contract.</strong>
          <p>
            It connects requirement versions, sourcing, collection, quality
            evidence, dataset creation, and evaluation. Statuses are populated
            from those linked records; users update the underlying work on its
            owning page instead of manually choosing a green or red label.
          </p>
        </div>
      </div>
      <div className="workflow-overview">
        <Card>
          <div className="eyebrow">Assigned workflow</div>
          <h3>{primary?.name ?? "No workflow assigned"}</h3>
          <p>
            {primary
              ? `${primary.version} controls the collection and evidence contract for this project.`
              : "Choose a reusable workflow before collection starts. Placeholder stages are not treated as configured work."}
          </p>
          {!primary ? (
            <Link className="button" href="/registry">
              Open Registry <ArrowRight size={13} />
            </Link>
          ) : null}
        </Card>
        <Card>
          <div className="eyebrow">Live inputs · auto-populated</div>
          <div className="tag-row">
            <span className="tag">
              Requirement {ps.requirements.currentVersion}
            </span>
            <span className="tag">Source plan · {ps.sourcePlanStatus}</span>
            <span className="tag">
              {plannedRecords.toLocaleString()} planned records
            </span>
            <span className="tag">
              {ps.vendorEngagements.length} vendor engagement(s)
            </span>
            <span className="tag">
              {ps.internalWorkBatches.length} in-house batch(es)
            </span>
          </div>
          <p className="source-note">
            Sources: current requirement, saved source plan, vendor
            engagements, and in-house operations.
          </p>
        </Card>
        <Card>
          <div className="eyebrow">Evidence outputs · auto-populated</div>
          <div className="tag-row">
            <span className="tag">Decision records</span>
            <span className="tag">QA report</span>
            <span className="tag">Dataset manifest</span>
            <span className="tag">Evaluation result</span>
          </div>
          <p className="source-note">
            Outputs appear only when their source workflow creates immutable
            evidence.
          </p>
        </Card>
      </div>
      <div className="workflow-data-route" aria-label="Project workflow path">
        {[
          "Requirement & source plan",
          "Vendor / in-house collection",
          "Layered quality control",
          "Dataset release",
          "Evaluation decision",
        ].map((item, index, list) => (
          <div className="workflow-route-item" key={item}>
            <span>{index + 1}</span>
            <b>{item}</b>
            {index < list.length - 1 ? <ArrowRight size={15} /> : null}
          </div>
        ))}
      </div>
      <ReleaseCheckpointPanel
        checkpoints={checkpoints}
        title="Release readiness inside this lifecycle"
      />
      <Card className="status-provenance">
        <div className="card-header">
          <div>
            <h3>How status is sourced</h3>
            <p className="subtle">
              Badges summarize stored facts or calculated evidence; they are
              not free-form labels.
            </p>
          </div>
          <span className="calc-label sim-label">Explainable state</span>
        </div>
        <div className="grid grid-4 status-source-grid">
          <div>
            <Status value="aligned" />
            <b>Requirement alignment</b>
            <p>Version equality after publishing and source-plan saving.</p>
          </div>
          <div>
            <Status value="active" />
            <b>Operational progress</b>
            <p>Engagement, batch, QA, handoff, and decision records.</p>
          </div>
          <div>
            <Status value="blocked" />
            <b>Failed evidence</b>
            <p>Critical QA, aggregate-QA, or evaluation guardrail failures.</p>
          </div>
          <div>
            <Status value="simulated" />
            <b>Demo-only facts</b>
            <p>Seed fixtures and connector execution marked as simulated.</p>
          </div>
        </div>
        <p className="source-note">
          In this prototype, actions update versioned browser-local state. In a
          production deployment, the same selectors would consume vendor,
          annotation-platform, warehouse, and evaluation-system events.
        </p>
      </Card>
      {primary ? (
        <div className="workflow-timeline">
          {ps.workflowStages.map((stage, index) => (
            <Card key={stage.id} className="workflow-stage">
              <div className="stage-index">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="card-header">
                <div>
                  <h2>{stage.name}</h2>
                  <p className="subtle">
                    {stage.version} · {stage.owner}
                  </p>
                </div>
                <Status
                  value={stage.status}
                  detail="Project workflow configuration state. Publishing a new requirement marks the stage stale until it is reviewed."
                />
              </div>
              <div className="grid grid-2">
                <div>
                  <div className="eyebrow">Entry criteria</div>
                  <ul>
                    {stage.entryCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="eyebrow">Exit criteria</div>
                  <ul>
                    {stage.exitCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="stage-evidence-grid">
                <div>
                  <span>What runs</span>
                  <b>
                    {stage.name === "Rubric classification"
                      ? "Versioned rubric assignment with confidence routing"
                      : "Configured project workflow control"}
                  </b>
                </div>
                <div>
                  <span>Evidence produced</span>
                  <b>Decision log · QA metrics · artifact lineage</b>
                </div>
                <div>
                  <span>Execution boundary</span>
                  <b>External annotation; SignalOps monitors and gates</b>
                </div>
              </div>
              <div className="tag-row">
                {stage.dependencies.map((dependency) => (
                  <span className="tag" key={dependency}>
                    Depends on {dependency}
                  </span>
                ))}
                {stage.linkedArtifactIds.map((artifactId) => (
                  <span className="tag" key={artifactId}>
                    Artifact · {artifactId}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Layers3 />}
          title="No lifecycle workflow assigned"
          text="Assign a reusable workflow from the Registry. Until then, SignalOps shows live inputs and release blockers without presenting a placeholder workflow as configured work."
          action={
            <Link className="button primary" href="/registry">
              Assign workflow <ArrowRight size={13} />
            </Link>
          }
        />
      )}
    </>
  );
}

function Lineage() {
  const { ps, project, state, id } = useProjectContext();
  const [selected, setSelected] = useState("qa");
  const graph = useMemo(() => {
    const base = buildLineageGraph(ps.scenario);
    const dataset = state.datasets.find(
      (item) =>
        item.projectId === id &&
        item.requirementVersion === ps.requirements.currentVersion,
    );
    const handoff = state.evaluationHandoffs.find(
      (item) => item.datasetId === dataset?.id,
    );
    return {
      ...base,
      nodes: base.nodes.map((node) => {
        if (node.id === "release" && dataset)
          return {
            ...node,
            detail: `${dataset.version} · ${dataset.recordCount} records`,
            status: "complete" as const,
            count: dataset.recordCount,
          };
        if (node.id === "evaluation" && handoff)
          return {
            ...node,
            detail: `${handoff.status.replaceAll("_", " ")} · ${handoff.owners.join(" + ")}`,
            status:
              handoff.status === "decision_ready"
                ? ("complete" as const)
                : ("active" as const),
          };
        return node;
      }),
    };
  }, [
    id,
    ps.requirements.currentVersion,
    ps.scenario,
    state.datasets,
    state.evaluationHandoffs,
  ]);
  const node = graph.nodes.find((n) => n.id === selected) ?? graph.nodes[0];
  const projectAudit = state.audit.filter((event) => event.projectId === id);
  const events = [...projectAudit, ...ps.scenario.audit].slice(-8).reverse();
  return (
    <>
      <PageIntro
        eyebrow="Project / Lineage"
        title="Data flow & lineage"
        description="Live source-to-release state for the selected project. Click a node for evidence."
        actions={<ProjectBadge project={project} />}
      />
      <div className="grid lineage-layout">
        <LineageMap
          graph={graph}
          selectedId={selected}
          onSelect={setSelected}
        />
        <Card>
          <div className="card-header">
            <div>
              <h2>{node.label}</h2>
              <p className="subtle mono">NODE / {node.id}</p>
            </div>
            <Status value={node.status} />
          </div>
          <p>{node.detail}</p>
          {typeof node.count === "number" ? (
            <div className="metric-card accent">
              <span className="eyebrow">Records</span>
              <strong>{node.count}</strong>
            </div>
          ) : null}
          {node.id === "qa" &&
          ps.scenario.qaReport &&
          !ps.scenario.qaReport.passed ? (
            <div className="notice">
              {ps.scenario.qaReport.gates
                .filter((g) => !g.passed)
                .map((g) => g.label)
                .join(" · ")}
            </div>
          ) : null}
          <h3 className="subsection-title">Audit trail</h3>
          <div className="audit-list">
            {events.map((e) => (
              <div className="audit-item" key={e.id}>
                <strong>{e.action}</strong>
                <p>
                  {e.detail}
                  <br />
                  {e.actor}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Release() {
  const { state, project, ps, id, dispatch } = useProjectContext();
  const scenario = ps.scenario;
  const eligibility = getReleaseEligibility(scenario);
  const { checkpoints, dataset, handoff } = buildReleaseCheckpoints(state, id);
  const prerequisiteCheckpoints = checkpoints.filter((checkpoint) =>
    ["configuration", "quality", "internal"].includes(checkpoint.id),
  );
  const releasePrerequisitesReady = prerequisiteCheckpoints.every(
    (checkpoint) =>
      checkpoint.status === "complete" ||
      checkpoint.status === "not_required",
  );
  const releaseBlockers = prerequisiteCheckpoints
    .filter(
      (checkpoint) =>
        checkpoint.status !== "complete" &&
        checkpoint.status !== "not_required",
    )
    .map((checkpoint) => checkpoint.detail);
  const [rationale, setRationale] = useState("");
  const [resultValue, setResultValue] = useState("5.4");
  const [guardrailValue, setGuardrailValue] = useState("73.4");
  const [resultNotes, setResultNotes] = useState(
    "Candidate meets target without guardrail regression.",
  );
  const create = () =>
    dataset &&
    dispatch({
      type: "CREATE_EVALUATION_HANDOFF",
      projectId: id,
      handoff: {
        datasetId: dataset.id,
        owners: ["research", "ml"],
        targetMetrics: ["Unexpected vocal rate"],
        guardrails: ["Prompt adherence"],
        slices: ["ambient-en", "electronic-en"],
        dueDate: project.deadline,
        method: "Slice-aware quality evaluation",
        decisionRequest: "Confirm readiness for promotion.",
        delivery: "simulated_connector",
      },
    });
  const submit = () => {
    if (!handoff) return;
    const value = Number(resultValue);
    const results: EvaluationMetricResult[] = [
      {
        metric: "Unexpected vocal rate",
        value,
        threshold: 6,
        operator: "lte",
        guardrail: false,
        passed: value <= 6,
        notes: resultNotes,
      },
      {
        metric: "Prompt adherence",
        value: Number(guardrailValue),
        threshold: 72,
        operator: "gte",
        guardrail: true,
        passed: Number(guardrailValue) >= 72,
        notes: resultNotes,
      },
    ];
    dispatch({
      type: "SUBMIT_EVALUATION_RESULTS",
      handoffId: handoff.id,
      results,
      notes: resultNotes,
    });
  };
  return (
    <>
      <PageIntro
        eyebrow="Project / Release"
        title="Release & evaluation decision"
        description="Create a traceable dataset, complete the evaluation lifecycle, then promote or hold with rationale."
        actions={<ProjectBadge project={project} />}
      />
      <ReleaseCheckpointPanel checkpoints={checkpoints} />
      <div className="grid grid-2">
        <Card className="anchor-card" >
          <span className="anchor-target" id="dataset-release" />
          <div className="card-header">
            <div>
              <h3>Dataset release</h3>
              <p className="subtle">
                {scenario.release
                  ? scenario.release.version
                  : "No release built"}
              </p>
            </div>
            <Status value={dataset?.releaseState ?? "pending"} />
          </div>
          {dataset ? (
            <>
              <div className="grid grid-3 mini-stats">
                <div>
                  <span>Records</span>
                  <b>{dataset.recordCount}</b>
                </div>
                <div>
                  <span>Requirement</span>
                  <b>{dataset.requirementVersion}</b>
                </div>
                <div>
                  <span>QA</span>
                  <b>{dataset.qaStatus}</b>
                </div>
              </div>
              <button
                className="button"
                onClick={() => {
                  dispatch({
                    type: "RECORD_DATASET_DOWNLOAD",
                    datasetId: dataset.id,
                    format: "json",
                  });
                  downloadJson(
                    `${dataset.id}-record-manifest.json`,
                    buildDatasetExport(dataset),
                  );
                }}
              >
                <Download size={14} /> Download record manifest JSON
              </button>
              <button
                className="button"
                onClick={() =>
                  downloadCsv(
                    `${dataset.id}-records.csv`,
                    datasetExportRows(dataset),
                  )
                }
              >
                <Download size={14} /> Download record manifest CSV
              </button>
              <p className="source-note">
                The manifest contains one row per record plus source, lineage,
                requirement version, QA state, and a simulated object-storage
                URI. Raw audio is not embedded in this browser demo.
              </p>
            </>
          ) : (
            <EmptyState
              icon={<Database />}
              title="Release not built"
              text={
                releaseBlockers.join(" ") ||
                (eligibility.eligible
                  ? "All release prerequisites are satisfied."
                  : `${eligibility.vendorPassed ? "" : "Vendor QA must pass. "}${eligibility.internalComplete ? "" : "Internal review must complete."}`)
              }
              action={
                <div className="button-row">
                  <button
                    className="button primary"
                    disabled={
                      !eligibility.eligible || !releasePrerequisitesReady
                    }
                    onClick={() =>
                      dispatch({ type: "BUILD_RELEASE", projectId: id })
                    }
                  >
                    <PackageCheck size={14} /> Build release
                  </button>
                  {!eligibility.eligible || !releasePrerequisitesReady ? (
                    <Link
                      className="button"
                      href={`/projects/${id}/operations`}
                    >
                      Resolve prerequisites <ArrowRight size={13} />
                    </Link>
                  ) : null}
                </div>
              }
            />
          )}
        </Card>
        <Card className="anchor-card">
          <span className="anchor-target" id="evaluation-handoff" />
          <div className="card-header">
            <div>
              <h3>Evaluation handoff</h3>
              <p className="subtle">
                Send an immutable dataset plus metric instructions to Research,
                ML, or both. Connector execution remains simulated.
              </p>
            </div>
            <span className="sim-label">Simulated execution</span>
          </div>
          {!dataset ? (
            <EmptyState
              icon={<Send />}
              title="Dataset required"
              text="A handoff needs a record-level dataset manifest. Complete quality and in-house gates, then build the immutable release."
              action={
                <Link className="button" href={`/projects/${id}/operations`}>
                  Open prerequisite work
                </Link>
              }
            />
          ) : !handoff ? (
            <button
              className="button primary"
              disabled={dataset.releaseState !== "candidate"}
              onClick={create}
            >
              <Send size={14} /> Create handoff
            </button>
          ) : (
            <>
              <div className="handoff-route">
                <span>Record manifest</span>
                <ArrowRight size={13} />
                <span>
                  {handoff.delivery === "download"
                    ? "Downloaded package"
                    : "Evaluation API"}
                </span>
                <ArrowRight size={13} />
                <span>{handoff.owners.join(" + ")}</span>
                <ArrowRight size={13} />
                <span>Results callback</span>
              </div>
              <div className="connection-guide compact-guide">
                <div className="kv">
                  <span>Dataset records</span>
                  <b>{dataset.recordCount.toLocaleString()}</b>
                </div>
                <div className="kv">
                  <span>Data access</span>
                  <b>Record manifest + object URIs</b>
                </div>
                <div className="kv">
                  <span>Evaluation spec</span>
                  <b>
                    {handoff.targetMetrics.length} target ·{" "}
                    {handoff.guardrails.length} guardrail
                  </b>
                </div>
                <p>
                  Download mode gives the evaluation owner a self-contained
                  package. Connector mode posts the same package to the Registry
                  Evaluation API and expects structured results at the callback.
                </p>
              </div>
              <div className="evaluation-lifecycle">
                {[
                  "requested",
                  "accepted",
                  "running",
                  "results_submitted",
                  "decision_ready",
                ].map((s) => (
                  <span
                    className={s === handoff.status ? "active" : ""}
                    key={s}
                  >
                    {s.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
              <button
                className="button"
                onClick={() =>
                  downloadJson(
                    `${handoff.id}-evaluation-package.json`,
                    buildEvaluationHandoffPackage(dataset, handoff),
                  )
                }
              >
                <Download size={14} /> Download complete evaluation package
              </button>
              {["requested", "accepted"].includes(handoff.status) ? (
                <button
                  className="button primary"
                  onClick={() =>
                    dispatch({
                      type: "ADVANCE_EVALUATION",
                      handoffId: handoff.id,
                    })
                  }
                >
                  Advance to{" "}
                  {handoff.status === "requested" ? "accepted" : "running"}{" "}
                  <ArrowRight size={13} />
                </button>
              ) : null}
              {handoff.status === "running" ? (
                <div className="form-stack">
                  <label>
                    Primary metric result
                    <input
                      type="number"
                      step=".1"
                      value={resultValue}
                      onChange={(e) => setResultValue(e.target.value)}
                    />
                  </label>
                  <label>
                    Prompt-adherence guardrail
                    <input
                      type="number"
                      step=".1"
                      value={guardrailValue}
                      onChange={(e) => setGuardrailValue(e.target.value)}
                    />
                  </label>
                  <label>
                    Result notes
                    <textarea
                      value={resultNotes}
                      onChange={(e) => setResultNotes(e.target.value)}
                    />
                  </label>
                  <button className="button dark" onClick={submit}>
                    Submit simulated results
                  </button>
                </div>
              ) : null}
              {handoff.status === "results_submitted" ? (
                <button
                  className="button primary"
                  onClick={() =>
                    dispatch({
                      type: "ADVANCE_EVALUATION",
                      handoffId: handoff.id,
                    })
                  }
                >
                  Advance to decision ready
                </button>
              ) : null}
              {handoff.results.map((r) => (
                <div className="kv" key={r.metric}>
                  <span>
                    {r.metric} · {r.value}
                  </span>
                  <Status value={r.passed ? "passed" : "blocked"} />
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
      <Card className="route-section anchor-card">
        <span className="anchor-target" id="release-decision" />
        <div className="card-header">
          <div>
            <h3>Final decision</h3>
            <p className="subtle">
              A rationale is mandatory for both promotion and hold.
            </p>
          </div>
          {dataset?.releaseState === "candidate" ? (
            <Status
              value={
                canPromoteDataset(state, dataset.id) ? "complete" : "pending"
              }
            />
          ) : (
            <Status value={dataset?.releaseState ?? "pending"} />
          )}
        </div>
        {dataset?.releaseState === "candidate" ? (
          <>
            <label>
              Decision rationale
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Record the evidence behind this decision…"
              />
            </label>
            <div className="button-row">
              <button
                className="button dark"
                disabled={
                  !rationale.trim() || !canPromoteDataset(state, dataset.id)
                }
                onClick={() =>
                  dispatch({
                    type: "PROMOTE_DATASET",
                    datasetId: dataset.id,
                    rationale,
                  })
                }
              >
                <CheckCircle2 size={14} /> Promote
              </button>
              <button
                className="button danger"
                disabled={!rationale.trim()}
                onClick={() =>
                  dispatch({
                    type: "HOLD_DATASET",
                    datasetId: dataset.id,
                    rationale,
                  })
                }
              >
                <AlertTriangle size={14} /> Hold
              </button>
            </div>
          </>
        ) : dataset ? (
          <div className="notice">
            <strong>
              {dataset.releaseState === "promoted"
                ? "Dataset promoted"
                : "Dataset held"}
            </strong>
            <p>{dataset.latestDecision}</p>
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardCheck />}
            title="Decision not available"
            text="Build the immutable dataset and complete its required evaluation before recording a promote or hold decision."
            action={
              <Link className="button" href={`/projects/${id}/operations`}>
                Review prerequisites <ArrowRight size={13} />
              </Link>
            }
          />
        )}
      </Card>
    </>
  );
}

function Step({
  label,
  status,
  detail,
  source,
  href,
  action,
}: {
  label: string;
  status: ReturnType<typeof buildReleaseCheckpoints>["checkpoints"][number]["status"];
  detail: string;
  source: string;
  href: string;
  action: string;
}) {
  const done = status === "complete";
  return (
    <div className={`release-step ${status} ${done ? "done" : ""}`}>
      <span>
        {done ? <Check size={13} /> : status === "not_required" ? "—" : null}
      </span>
      <div className="release-step-copy">
        <b>{label}</b>
        <Status value={status} detail={source} />
        <small>{detail}</small>
        <small className="status-source">Source: {source}</small>
        <Link className="button small" href={href}>
          {action} <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
