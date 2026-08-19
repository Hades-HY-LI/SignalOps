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
import { buildLineageGraph, getReleaseEligibility } from "@/lib/domain";
import { DEMO_NOW } from "@/lib/fixtures";
import {
  canPromoteDataset,
  internalBatchesReleaseReady,
  useWorkspace,
} from "@/lib/workspace";
import type {
  EvaluationMetricResult,
  Project,
  RequirementAttachment,
} from "@/lib/types";
import { Card, downloadJson, EmptyState, Modal, PageIntro, Status } from "./ui";
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
        <span>Mission preset</span>
        {(
          ["delivery_health", "source_operations", "release_readiness"] as const
        ).map((p) => (
          <button
            className={ps.missionConfig.preset === p ? "active" : ""}
            key={p}
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
  const { project, ps, id, dispatch } = useProjectContext();
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
    if (file.size > 2 * 1024 * 1024 || !allowed.includes(inferredType)) {
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
          </Card>
          <Card>
            <div className="card-header">
              <h3>Attachments</h3>
              <span className="sim-label">Local only</span>
            </div>
            <label className="upload-control">
              <Upload size={16} /> Add document
              <input
                type="file"
                accept=".md,.txt,.json,.pdf"
                onChange={upload}
              />
            </label>
            {uploadError ? (
              <p className="error-text" role="alert">
                {uploadError}
              </p>
            ) : null}
            {req.attachments.length ? (
              req.attachments.map((a) => (
                <button
                  className="list-row"
                  key={a.id}
                  onClick={() => openAttachment(a)}
                >
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {a.mimeType} · {(a.size / 1024).toFixed(1)} KB
                    </small>
                  </span>
                  <span className="button small">
                    Preview <FileText size={14} />
                  </span>
                </button>
              ))
            ) : (
              <p className="subtle">No local attachments yet.</p>
            )}
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
        <Card>
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
                    <b>{Math.round(p.quality * 100)}% quality</b>
                    <Status value={p.decision} />
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
        <Card>
          <div className="card-header">
            <div>
              <h3>In-house management</h3>
              <p className="subtle">
                Aggregate workload, capacity, calibration, and QA.
              </p>
            </div>
            <Users size={17} />
          </div>
          {ps.internalOpsSnapshots.at(-1) ? (
            <>
              <div className="grid grid-3 mini-stats">
                <div>
                  <span>Backlog</span>
                  <b>{ps.internalOpsSnapshots.at(-1)!.backlog}</b>
                </div>
                <div>
                  <span>Completed</span>
                  <b>{ps.internalOpsSnapshots.at(-1)!.completedTasks}</b>
                </div>
                <div>
                  <span>Daily throughput</span>
                  <b>{ps.internalOpsSnapshots.at(-1)!.dailyThroughput}</b>
                </div>
                <div>
                  <span>Median cycle</span>
                  <b>{ps.internalOpsSnapshots.at(-1)!.medianCycleHours}h</b>
                </div>
                <div>
                  <span>SLA</span>
                  <b>
                    {Math.round(
                      ps.internalOpsSnapshots.at(-1)!.slaAttainment * 100,
                    )}
                    %
                  </b>
                </div>
                <div>
                  <span>Capacity</span>
                  <b>{ps.internalOpsSnapshots.at(-1)!.availableCapacity}</b>
                </div>
                <div>
                  <span>Calibration</span>
                  <b>
                    {Math.round(
                      ps.internalOpsSnapshots.at(-1)!.calibrationAgreement *
                        100,
                    )}
                    %
                  </b>
                </div>
                <div>
                  <span>Escalation</span>
                  <b>
                    {Math.round(
                      ps.internalOpsSnapshots.at(-1)!.escalationRate * 100,
                    )}
                    %
                  </b>
                </div>
                <div>
                  <span>QC failure</span>
                  <b>
                    {Math.round(
                      ps.internalOpsSnapshots.at(-1)!.qcFailureRate * 100,
                    )}
                    %
                  </b>
                </div>
              </div>
              <div className="grid grid-2 ops-breakdown">
                <div>
                  <h4>Team allocation</h4>
                  {ps.internalOpsSnapshots
                    .at(-1)!
                    .teamAllocation.map((item) => (
                      <div className="kv" key={item.team}>
                        <span>{item.team}</span>
                        <b>{item.tasks} tasks</b>
                      </div>
                    ))}
                </div>
                <div>
                  <h4>Defect taxonomy</h4>
                  {ps.internalOpsSnapshots
                    .at(-1)!
                    .defectTaxonomy.map((item) => (
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
      <Card className="route-section">
        <div className="card-header">
          <div>
            <h3>Unexpected Vocals quality workflow</h3>
            <p className="subtle">
              Scoped automated QA, adjudication, and remediation controls.
            </p>
          </div>
          <Status value={scenario.program.stage} />
        </div>
        {id !== "unexpected-vocals" ? (
          <EmptyState
            icon={<ShieldCheck />}
            title="No delivery attached"
            text="This project is still in planning. Select sources and create a pilot to begin QA."
          />
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

function Workflow() {
  const { ps, project } = useProjectContext();
  return (
    <>
      <PageIntro
        eyebrow="Project / Workflow"
        title="Lifecycle definition"
        description="Versioned stages, owners, dependencies, and artifact links for this project."
        actions={<ProjectBadge project={project} />}
      />
      {ps.workflowStages.length ? (
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
                <Status value={stage.status} />
              </div>
              <div className="grid grid-2">
                <div>
                  <div className="eyebrow">Entry criteria</div>
                  <ul>
                    {stage.entryCriteria.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="eyebrow">Exit criteria</div>
                  <ul>
                    {stage.exitCriteria.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="tag-row">
                {stage.dependencies.map((x) => (
                  <span className="tag" key={x}>
                    Depends on {x}
                  </span>
                ))}
                {stage.linkedArtifactIds.map((x) => (
                  <span className="tag" key={x}>
                    Artifact · {x}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Layers3 />}
          title="No workflow configured"
          text="Publish a requirement, then assign a registry workflow."
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
  const batchesReady = internalBatchesReleaseReady(ps);
  const dataset =
    state.datasets.find(
      (d) => d.projectId === id && d.id === scenario.release?.id,
    ) ??
    state.datasets.find(
      (d) =>
        d.projectId === id &&
        d.requirementVersion === ps.requirements.currentVersion,
    );
  const handoff = state.evaluationHandoffs.find(
    (h) => h.datasetId === dataset?.id,
  );
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
      <div className="release-steps">
        <Step label="Quality" done={!!scenario.qaReport?.passed} />
        <Step label="In-house batches" done={batchesReady} />
        <Step label="Dataset" done={!!dataset} />
        <Step label="Evaluation" done={handoff?.status === "decision_ready"} />
        <Step
          label="Decision"
          done={
            dataset?.releaseState === "promoted" ||
            dataset?.releaseState === "held"
          }
        />
      </div>
      <div className="grid grid-2">
        <Card>
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
                  downloadJson(`${dataset.id}.json`, dataset);
                }}
              >
                <Download size={14} /> Download manifest
              </button>
            </>
          ) : (
            <EmptyState
              icon={<Database />}
              title="Release not built"
              text={`${eligibility.eligible ? "Scenario is eligible" : `${eligibility.vendorPassed ? "" : "Vendor QA must pass. "} ${eligibility.internalComplete ? "" : "Internal review must complete."}`}${!batchesReady ? " · Aggregate in-house batch QA is required." : ""}`}
              action={
                <button
                  className="button primary"
                  disabled={!eligibility.eligible || !batchesReady}
                  onClick={() =>
                    dispatch({ type: "BUILD_RELEASE", projectId: id })
                  }
                >
                  <PackageCheck size={14} /> Build release
                </button>
              }
            />
          )}
        </Card>
        <Card>
          <div className="card-header">
            <div>
              <h3>Evaluation handoff</h3>
              <p className="subtle">
                Connector execution and results are simulated.
              </p>
            </div>
            <span className="sim-label">Simulated execution</span>
          </div>
          {!dataset ? (
            <EmptyState
              icon={<Send />}
              title="Dataset required"
              text="Build a passing candidate before evaluation handoff."
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
                onClick={() => downloadJson(`${handoff.id}.json`, handoff)}
              >
                <Download size={14} /> Download handoff package
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
      {dataset && dataset.releaseState === "candidate" ? (
        <Card className="route-section">
          <div className="card-header">
            <div>
              <h3>Final decision</h3>
              <p className="subtle">
                A rationale is mandatory for both promotion and hold.
              </p>
            </div>
            <Status
              value={
                canPromoteDataset(state, dataset.id) ? "complete" : "pending"
              }
            />
          </div>
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
        </Card>
      ) : null}
    </>
  );
}

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={done ? "done" : ""}>
      <span>{done ? <Check size={13} /> : null}</span>
      <b>{label}</b>
    </div>
  );
}
