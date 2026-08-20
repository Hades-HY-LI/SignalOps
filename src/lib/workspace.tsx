"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useSyncExternalStore,
} from "react";
import {
  createInitialState,
  DEMO_NOW,
  sourcePlan,
  vendors as baseVendors,
  workflowTemplates,
} from "./fixtures";
import { scenarioReducer, type ScenarioAction } from "./scenario";
import type {
  AuditEvent,
  DashboardWidget,
  DatasetVersion,
  EvaluationHandoff,
  EvaluationMetricResult,
  InternalOpsSnapshot,
  InternalWorkBatch,
  MissionControlConfig,
  Project,
  ProjectState,
  Reminder,
  RequirementAttachment,
  RequirementDraft,
  RequirementVersion,
  ScenarioState,
  SourcePlanItem,
  VendorEngagement,
  VendorPilot,
  VendorProfile,
  WorkspaceState,
} from "./types";
import {
  evaluationEvidenceComplete,
  getInternalBatchGateStatus,
  getProjectConfigurationGate,
} from "./status";

export { getInternalBatchGateStatus } from "./status";

export const WORKSPACE_STORAGE_KEY = "signalops-workspace-v2";
export const SCENARIO_V1_STORAGE_KEY = "signalops-scenario-v1";

const portfolioWidgets: DashboardWidget[] = [
  "project_health",
  "deadlines",
  "budgets",
  "capacity",
  "blockers",
  "source_mix",
].map((id) => ({ id: id as DashboardWidget["id"], visible: true }));
const projectWidgets: DashboardWidget[] = [
  "target_metric",
  "release_readiness",
  "source_status",
  "quality_status",
  "blockers",
  "owners",
].map((id) => ({ id: id as DashboardWidget["id"], visible: true }));

function requirementDraft(owner: string, dueDate: string): RequirementDraft {
  return {
    targetBehavior:
      "Reduce unexpected vocal content when instrumental output is requested.",
    scope: "Generated music clips with explicit instrumental intent.",
    slices: ["ambient-en", "electronic-en", "classical-es"],
    exclusions: ["Spoken-word requests", "Licensed reference recordings"],
    thresholds: {
      goldAccuracy: 0.92,
      maxDisagreement: 0.15,
      minimumSliceRecords: 2,
    },
    owner,
    dueDate,
  };
}

function initialRequirement(
  projectId: string,
  owner: string,
  dueDate: string,
  version = "v3",
) {
  const draft = requirementDraft(owner, dueDate);
  const published: RequirementVersion = {
    ...draft,
    version,
    publishedAt: DEMO_NOW,
    publishedBy: owner,
    changeReason: "Established the current quality and coverage contract.",
    changedFields: Object.keys(draft),
  };
  return {
    id: `requirement-${projectId}`,
    projectId,
    title: "Research requirement",
    currentVersion: version,
    draft: { ...draft },
    versions: [published],
    attachments: [],
    reminders: [],
  };
}

function emptyScenario(
  project: Project,
  requirementVersion: string,
  configured = false,
): ScenarioState {
  const scenario = createInitialState();
  return {
    ...scenario,
    program: {
      ...scenario.program,
      id: `program-${project.id}`,
      name: project.name,
      summary: project.summary,
      owner: project.owner,
      researchOwner: project.researchOwner,
      productOwner: project.productOwner,
      deadline: project.deadline,
      stage: "signal_detected",
      requirementVersion,
    },
    artifacts: scenario.artifacts.map((artifact) => ({
      ...artifact,
      version: requirementVersion,
      status:
        configured || artifact.id === "request" ? "aligned" : "pending",
    })),
    productSignals: [],
    vendorDecisions: {},
    internalTasks: [],
    qaReport: null,
    remediation: null,
    release: null,
    audit: [],
  };
}

function initialProjectState(
  project: Project,
  interactive = false,
): ProjectState {
  const naturalness = project.id === "vocal-naturalness";
  const requirementVersion = interactive
    ? "v3"
    : project.id === "vocal-naturalness"
      ? "v2"
      : "v1";
  const scenario = interactive
    ? createInitialState()
    : emptyScenario(project, requirementVersion, naturalness);
  return {
    projectId: project.id,
    missionConfig: {
      preset: "delivery_health",
      widgets: projectWidgets.map((widget) => ({ ...widget })),
    },
    requirements: initialRequirement(
      project.id,
      project.researchOwner,
      project.deadline,
      requirementVersion,
    ),
    sourcePlan: sourcePlan.map((item) =>
      interactive
        ? { ...item }
        : naturalness
          ? {
              ...item,
              targetRecords:
                item.source === "vendor"
                  ? 6800
                  : item.source === "internal"
                    ? 550
                    : 4650,
              share:
                item.source === "vendor"
                  ? 57
                  : item.source === "internal"
                    ? 5
                    : 38,
              estimatedCost:
                item.source === "vendor"
                  ? 4896
                  : item.source === "internal"
                    ? 1650
                    : 0,
              confidence: item.source === "product" ? "medium" : "high",
              turnaround:
                item.source === "vendor"
                  ? "6 days"
                  : item.source === "internal"
                    ? "2 days"
                    : "Continuous",
            }
          : {
              ...item,
              targetRecords: 0,
              share: 0,
              estimatedCost: 0,
              confidence: "low" as const,
              turnaround: "Not planned",
            },
    ),
    sourcePlanStatus:
      interactive || naturalness ? "aligned" : ("pending" as const),
    vendorEngagements: interactive
      ? [
          {
            id: "engagement-unexpected-northstar",
            projectId: project.id,
            vendorId: "northstar",
            status: "pilot",
            requirementVersion: "v3",
            workPackageVersion: "wp-v1",
            createdAt: DEMO_NOW,
          },
        ]
      : naturalness
        ? [
            {
              id: "engagement-naturalness-aural",
              projectId: project.id,
              vendorId: "aural",
              status: "production",
              requirementVersion: "v2",
              workPackageVersion: "wp-v2",
              createdAt: DEMO_NOW,
            },
          ]
        : [],
    internalWorkBatches: interactive
      ? [
          {
            id: "internal-batch-unexpected-v1",
            projectId: project.id,
            name: "Ambiguous clip review",
            team: "Audio Quality",
            status: "in_progress",
            totalTasks: 400,
            completedTasks: 286,
            requirementVersion: "v3",
            createdAt: DEMO_NOW,
            updatedAt: DEMO_NOW,
          },
        ]
      : naturalness
        ? [
            {
              id: "internal-batch-naturalness-v2",
              projectId: project.id,
              name: "Preference calibration review",
              team: "Music Preference",
              status: "completed",
              totalTasks: 550,
              completedTasks: 550,
              aggregateQA: 0.95,
              requirementVersion: "v2",
              createdAt: DEMO_NOW,
              updatedAt: DEMO_NOW,
            },
          ]
        : [],
    internalOpsSnapshots:
      interactive || naturalness ? [seedOpsSnapshot(project.id)] : [],
    workflowStages: naturalness
      ? [
          {
            id: `workflow-stage-${project.id}-1`,
            projectId: project.id,
            name: "Collection preparation",
            owner: project.owner,
            version: "workflow-v2",
            status: "complete",
            entryCriteria: ["Published requirement", "Source plan saved"],
            exitCriteria: ["Pilot accepted", "Data contract validated"],
            dependencies: ["requirement", "source-plan", "vendor-scorecard"],
            linkedArtifactIds: ["requirement-v2", "pilot-v1"],
          },
          {
            id: `workflow-stage-${project.id}-2`,
            projectId: project.id,
            name: "Pairwise preference collection",
            owner: "Aural Insights",
            version: "workflow-v2",
            status: "complete",
            entryCriteria: ["Pilot accepted", "Gold set calibrated"],
            exitCriteria: ["12,000 judgments collected", "SLA attained"],
            dependencies: ["annotation-platform", "object-storage"],
            linkedArtifactIds: ["work-package-v2", "rubric-v2"],
          },
          {
            id: `workflow-stage-${project.id}-3`,
            projectId: project.id,
            name: "Quality and evaluation handoff",
            owner: project.researchOwner,
            version: "workflow-v2",
            status: "active",
            entryCriteria: ["Aggregate QA passed", "Dataset manifest built"],
            exitCriteria: ["Research evaluation complete", "Decision recorded"],
            dependencies: ["quality-layer", "evaluation-api"],
            linkedArtifactIds: [
              "dataset-naturalness-v2",
              "evaluation-naturalness-v2",
            ],
          },
        ]
      : [
          {
            id: `workflow-stage-${project.id}-1`,
            projectId: project.id,
            name: "Rubric classification",
            owner: project.owner,
            version: interactive ? "workflow-v3" : "workflow-v1",
            status: interactive ? "active" : "pending",
            entryCriteria: ["Published requirement"],
            exitCriteria: ["Quality gates pass"],
            dependencies: ["requirement", "source-plan"],
            linkedArtifactIds: ["request", "guideline"],
          },
        ],
    scenario,
    releaseReferences: [],
    evaluationReferences: [],
  };
}

function seedOpsSnapshot(projectId: string): InternalOpsSnapshot {
  if (projectId === "vocal-naturalness") {
    return {
      id: `ops-${projectId}-1`,
      projectId,
      capturedAt: DEMO_NOW,
      backlog: 4650,
      completedTasks: 7350,
      dailyThroughput: 910,
      medianCycleHours: 11.2,
      slaAttainment: 0.96,
      calibrationAgreement: 0.95,
      escalationRate: 0.03,
      qcFailureRate: 0.025,
      availableCapacity: 2400,
      teamAllocation: [
        { team: "Aural vendor collection", tasks: 6800 },
        { team: "Music Preference calibration", tasks: 550 },
      ],
      defectTaxonomy: [
        { label: "Low-confidence pair", count: 118 },
        { label: "Locale mismatch", count: 34 },
      ],
      simulated: true,
    };
  }
  return {
    id: `ops-${projectId}-1`,
    projectId,
    capturedAt: DEMO_NOW,
    backlog: 114,
    completedTasks: 286,
    dailyThroughput: 72,
    medianCycleHours: 8.4,
    slaAttainment: 0.94,
    calibrationAgreement: 0.91,
    escalationRate: 0.07,
    qcFailureRate: 0.04,
    availableCapacity: 180,
    teamAllocation: [
      { team: "Audio Quality", tasks: 286 },
      { team: "Research Review", tasks: 38 },
    ],
    defectTaxonomy: [
      { label: "Ambiguous vocals", count: 21 },
      { label: "Rubric boundary", count: 9 },
    ],
    simulated: true,
  };
}

function seedProjects(): Project[] {
  return [
    {
      id: "unexpected-vocals",
      name: "Unexpected Vocals",
      summary: "Reduce vocal leakage when instrumental music is requested.",
      owner: "Maya Chen",
      researchOwner: "Eli Morgan",
      productOwner: "Nora Singh",
      health: "blocked",
      stage: "quality_review",
      modality: "music",
      deadline: "2026-08-23",
      budget: 2152,
      targetVolume: 4000,
      recordVolume: 1648,
      blockers: ["Pilot delivery failed critical QA"],
      nextDecision: "Approve vendor remediation",
      releaseReadiness: 42,
      evaluationStatus: "not_requested",
      createdAt: DEMO_NOW,
      simulated: true,
    },
    {
      id: "vocal-naturalness",
      name: "Vocal Naturalness Preference",
      summary: "Collect comparative judgments for vocal naturalness.",
      owner: "Leah Park",
      researchOwner: "Jon Bell",
      productOwner: "Ari Shah",
      health: "healthy",
      stage: "collecting",
      modality: "music preference",
      deadline: "2026-09-05",
      budget: 6800,
      targetVolume: 12000,
      recordVolume: 7350,
      blockers: [],
      nextDecision: "Expand collection to two locales",
      releaseReadiness: 61,
      evaluationStatus: "requested",
      createdAt: DEMO_NOW,
      simulated: true,
    },
    {
      id: "multilingual-prompt-adherence",
      name: "Multilingual Prompt Adherence",
      summary: "Measure prompt adherence across priority languages.",
      owner: "Noah Kim",
      researchOwner: "Inez Diaz",
      productOwner: "Kai Brooks",
      health: "at_risk",
      stage: "planning",
      modality: "multilingual audio",
      deadline: "2026-09-12",
      budget: 9400,
      targetVolume: 18000,
      recordVolume: 0,
      blockers: ["Locale rubric awaiting alignment"],
      nextDecision: "Publish requirement v1",
      releaseReadiness: 18,
      evaluationStatus: "not_requested",
      createdAt: DEMO_NOW,
      simulated: true,
    },
  ];
}

function seedVendors(): VendorProfile[] {
  const enrichments: Record<
    string,
    Pick<
      VendorProfile,
      | "capabilities"
      | "modalities"
      | "locales"
      | "availability"
      | "utilization"
      | "rateBand"
    >
  > = {
    northstar: {
      capabilities: [
        "vocals",
        "music_preference",
        "instrumental_sound",
        "expert_review",
      ],
      modalities: ["music", "audio"],
      locales: ["en", "es", "fr"],
      availability: "available",
      utilization: 0.72,
      rateBand: "standard",
    },
    tempo: {
      capabilities: ["speech", "sound_effects", "multilingual", "ranking"],
      modalities: ["audio", "text"],
      locales: ["en", "es", "de", "ja"],
      availability: "available",
      utilization: 0.84,
      rateBand: "budget",
    },
    aural: {
      capabilities: [
        "vocals",
        "music_preference",
        "instrumental_sound",
        "expert_review",
        "ai_agent_review",
      ],
      modalities: ["music", "audio"],
      locales: ["en", "es"],
      availability: "limited",
      utilization: 0.91,
      rateBand: "premium",
    },
  };
  return baseVendors.map((vendor) => ({
    ...vendor,
    metrics: { ...vendor.metrics },
    history: vendor.history.map((point) => ({ ...point })),
    ...enrichments[vendor.id],
  }));
}

function seedPilots(): VendorPilot[] {
  return [
    {
      id: "pilot-unexpected-northstar-v1",
      projectId: "unexpected-vocals",
      vendorId: "northstar",
      version: "pilot-v1",
      workPackageVersion: "wp-v1",
      taskCount: 48,
      unitCost: 0.48,
      totalCost: 23.04,
      startDate: "2026-08-14",
      endDate: "2026-08-16",
      turnaroundHours: 42,
      throughputPerDay: 27,
      quality: 0.83,
      goldAccuracy: 0.8,
      remediationCount: 1,
      decision: "hold",
    },
    {
      id: "pilot-unexpected-northstar-v2",
      projectId: "unexpected-vocals",
      vendorId: "northstar",
      version: "pilot-v2",
      workPackageVersion: "wp-v2",
      taskCount: 48,
      unitCost: 0.48,
      totalCost: 23.04,
      startDate: "2026-08-17",
      endDate: "2026-08-18",
      turnaroundHours: 26,
      throughputPerDay: 44,
      quality: 0.96,
      goldAccuracy: 1,
      remediationCount: 0,
      decision: "proceed",
    },
    {
      id: "pilot-naturalness-aural-v1",
      projectId: "vocal-naturalness",
      vendorId: "aural",
      version: "pilot-v1",
      workPackageVersion: "wp-v1",
      taskCount: 120,
      unitCost: 0.72,
      totalCost: 86.4,
      startDate: "2026-08-08",
      endDate: "2026-08-11",
      turnaroundHours: 68,
      throughputPerDay: 42,
      quality: 0.97,
      goldAccuracy: 0.96,
      remediationCount: 0,
      decision: "proceed",
    },
  ];
}

export function createInitialWorkspaceState(): WorkspaceState {
  const projects = seedProjects();
  const projectStates = Object.fromEntries(
    projects.map((project, index) => [
      project.id,
      initialProjectState(project, index === 0),
    ]),
  );
  const naturalnessDataset: DatasetVersion = {
    id: "dataset-naturalness-v2",
    projectId: "vocal-naturalness",
    name: "Vocal Naturalness Preference",
    owner: "Leah Park",
    version: "v2",
    sources: ["vendor", "internal"],
    sourceCounts: { vendor: 6800, internal: 550, product: 0 },
    recordCount: 7350,
    requirementVersion: "v2",
    qaStatus: "passed",
    releaseState: "candidate",
    evaluationStatus: "requested",
    latestDecision: "Awaiting research evaluation",
    manifest: null,
    exclusions: [],
    downloadHistory: [],
    createdAt: DEMO_NOW,
  };
  return {
    schemaVersion: 2,
    fixtureRevision: 2,
    projects,
    activeProjectId: "unexpected-vocals",
    projectStates,
    portfolioConfig: {
      preset: "executive",
      widgets: portfolioWidgets.map((widget) => ({ ...widget })),
    },
    vendors: seedVendors(),
    vendorPilots: seedPilots(),
    datasets: [naturalnessDataset],
    evaluationHandoffs: [
      {
        id: "evaluation-naturalness-v2",
        projectId: "vocal-naturalness",
        datasetId: naturalnessDataset.id,
        owners: ["research"],
        targetMetrics: ["Vocal naturalness preference"],
        guardrails: ["Prompt adherence"],
        slices: ["pop-en", "rnb-en"],
        dueDate: "2026-08-25",
        method: "Pairwise preference analysis",
        decisionRequest: "Confirm the collection is ready for model iteration.",
        status: "requested",
        delivery: "simulated_connector",
        results: [],
        notes: "",
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      },
    ],
    registryEntries: [
      ...workflowTemplates.map((item) => ({
        id: item.id,
        name: item.name,
        kind: "workflow" as const,
        version: item.version,
        status: item.status,
        capabilities: [item.type],
        assignedProjectIds:
          item.id === "workflow-rubric-classification"
            ? ["unexpected-vocals"]
            : item.id === "workflow-pairwise"
              ? ["vocal-naturalness"]
              : [],
        description: item.description,
      })),
      {
        id: "registry-annotation-platform",
        name: "Internal annotation platform",
        kind: "annotation_platform",
        version: "adapter-v1",
        status: "simulated",
        capabilities: ["batch handoff", "result import"],
        assignedProjectIds: ["unexpected-vocals", "vocal-naturalness"],
        description:
          "Browser-local representation of an external annotation platform connection.",
      },
      {
        id: "registry-evaluation-api",
        name: "Evaluation API",
        kind: "api",
        version: "adapter-v1",
        status: "template",
        capabilities: ["evaluation handoff", "result callback"],
        assignedProjectIds: ["vocal-naturalness"],
        description:
          "Reusable contract for evaluation requests and structured metric results.",
      },
      {
        id: "registry-delivery-webhook",
        name: "Delivery webhook",
        kind: "webhook",
        version: "adapter-v1",
        status: "template",
        capabilities: ["delivery receipt", "status notification"],
        assignedProjectIds: ["vocal-naturalness"],
        description:
          "Versioned webhook contract for vendor delivery and remediation events.",
      },
      {
        id: "registry-object-storage",
        name: "Object storage batch",
        kind: "object_storage",
        version: "adapter-v1",
        status: "template",
        capabilities: ["manifest export", "result import"],
        assignedProjectIds: ["vocal-naturalness"],
        description: "Reusable batch exchange definition.",
      },
      {
        id: "registry-product-events",
        name: "Product events",
        kind: "product_event",
        version: "adapter-v1",
        status: "simulated",
        capabilities: ["explicit feedback", "implicit signals"],
        assignedProjectIds: ["unexpected-vocals"],
        description: "Normalizes product signals into dataset candidates.",
      },
    ],
    audit: [
      {
        id: "workspace-audit-1",
        action: "Workspace initialized",
        detail: "Three programs and shared operating resources were loaded.",
        actor: "System",
        createdAt: DEMO_NOW,
      },
    ],
  };
}

type ScopedScenarioAction = Exclude<
  ScenarioAction,
  { type: "HYDRATE" } | { type: "RESET" }
> & { projectId?: string };

export type WorkspaceAction =
  | { type: "HYDRATE"; state: WorkspaceState }
  | { type: "RESET" }
  | { type: "RESET_PROJECT"; projectId?: string }
  | { type: "SWITCH_PROJECT"; projectId: string }
  | {
      type: "ADD_PROJECT";
      project: Omit<
        Project,
        | "id"
        | "recordVolume"
        | "releaseReadiness"
        | "evaluationStatus"
        | "createdAt"
        | "simulated"
      > & { id?: string };
    }
  | {
      type: "EDIT_PROJECT";
      projectId: string;
      changes: Partial<Omit<Project, "id" | "createdAt" | "simulated">>;
    }
  | {
      type: "SET_DASHBOARD_PRESET";
      scope: "portfolio" | "project";
      preset: MissionControlConfig["preset"];
      projectId?: string;
    }
  | {
      type: "TOGGLE_WIDGET";
      scope: "portfolio" | "project";
      widgetId: DashboardWidget["id"];
      projectId?: string;
    }
  | {
      type: "MOVE_WIDGET";
      scope: "portfolio" | "project";
      widgetId: DashboardWidget["id"];
      direction: "up" | "down";
      projectId?: string;
    }
  | {
      type: "EDIT_REQUIREMENT_DRAFT";
      projectId?: string;
      changes: Partial<RequirementDraft>;
    }
  | {
      type: "EDIT_SOURCE_PLAN_ITEM";
      projectId?: string;
      source: SourcePlanItem["source"];
      changes: Partial<Omit<SourcePlanItem, "source">>;
    }
  | { type: "SAVE_SOURCE_PLAN"; projectId?: string }
  | {
      type: "PUBLISH_REQUIREMENT";
      projectId?: string;
      reason: string;
      actor?: string;
    }
  | {
      type: "ADD_ATTACHMENT";
      projectId?: string;
      attachment: RequirementAttachment;
    }
  | {
      type: "ADD_REMINDER";
      projectId?: string;
      reminder: Omit<Reminder, "id" | "status" | "createdAt" | "simulated">;
    }
  | { type: "RESOLVE_REMINDER"; projectId?: string; reminderId: string }
  | { type: "ADD_VENDOR"; vendor: VendorProfile }
  | {
      type: "EDIT_VENDOR";
      vendorId: string;
      changes: Partial<Omit<VendorProfile, "id">>;
    }
  | { type: "ASSIGN_REGISTRY_ENTRY"; projectId: string; entryId: string }
  | { type: "SELECT_VENDOR"; projectId?: string; vendorId: string }
  | {
      type: "CREATE_INTERNAL_BATCH";
      projectId?: string;
      batch: Omit<
        InternalWorkBatch,
        | "id"
        | "projectId"
        | "status"
        | "completedTasks"
        | "createdAt"
        | "updatedAt"
      >;
    }
  | {
      type: "SYNC_INTERNAL_BATCH";
      projectId?: string;
      batchId: string;
      completedTasks: number;
    }
  | {
      type: "IMPORT_INTERNAL_RESULT";
      projectId?: string;
      batchId: string;
      aggregateQA: number;
    }
  | {
      type: "CREATE_EVALUATION_HANDOFF";
      projectId?: string;
      handoff: Omit<
        EvaluationHandoff,
        | "id"
        | "projectId"
        | "status"
        | "results"
        | "notes"
        | "createdAt"
        | "updatedAt"
      >;
    }
  | { type: "ADVANCE_EVALUATION"; handoffId: string }
  | {
      type: "SUBMIT_EVALUATION_RESULTS";
      handoffId: string;
      results: EvaluationMetricResult[];
      notes: string;
    }
  | {
      type: "RECORD_DATASET_DOWNLOAD";
      datasetId: string;
      format: "json" | "csv";
    }
  | { type: "PROMOTE_DATASET"; datasetId: string; rationale: string }
  | { type: "HOLD_DATASET"; datasetId: string; rationale: string }
  | {
      type: "PROJECT_SCENARIO_ACTION";
      projectId?: string;
      action: Exclude<ScenarioAction, { type: "HYDRATE" } | { type: "RESET" }>;
    }
  | ScopedScenarioAction;

function workspaceAudit(
  state: WorkspaceState,
  action: string,
  detail: string,
  actor = "Maya Chen",
  projectId?: string,
): AuditEvent[] {
  return [
    ...state.audit,
    {
      id: `workspace-audit-${state.audit.length + 1}`,
      projectId,
      action,
      detail,
      actor,
      createdAt: DEMO_NOW,
    },
  ];
}

function projectIdFor(state: WorkspaceState, requested?: string) {
  return requested && state.projectStates[requested]
    ? requested
    : state.activeProjectId;
}

function withProjectState(
  state: WorkspaceState,
  projectId: string,
  projectState: ProjectState,
): WorkspaceState {
  return {
    ...state,
    projectStates: { ...state.projectStates, [projectId]: projectState },
  };
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  );
}

function nextVersion(current: string) {
  const value = Number(current.replace(/\D/g, ""));
  return `v${Number.isFinite(value) ? value + 1 : 1}`;
}

function changedDraftFields(a: RequirementDraft, b: RequirementDraft) {
  return (Object.keys(a) as Array<keyof RequirementDraft>).filter(
    (key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]),
  );
}

function updateWidgets(
  config: MissionControlConfig,
  widgetId: DashboardWidget["id"],
  operation: "toggle" | "up" | "down",
) {
  const widgets = config.widgets.map((item) => ({ ...item }));
  const index = widgets.findIndex((item) => item.id === widgetId);
  if (index < 0) return config;
  if (operation === "toggle") widgets[index].visible = !widgets[index].visible;
  else {
    const target = operation === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= widgets.length) return config;
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
  }
  return { ...config, widgets };
}

function presetWidgets(
  scope: "portfolio" | "project",
  preset: MissionControlConfig["preset"],
) {
  const definitions: Record<string, DashboardWidget["id"][]> = {
    executive: ["project_health", "deadlines", "budgets", "blockers"],
    operations: [
      "capacity",
      "blockers",
      "source_mix",
      "deadlines",
      "project_health",
    ],
    delivery_health: [
      "target_metric",
      "quality_status",
      "blockers",
      "release_readiness",
    ],
    source_operations: [
      "source_status",
      "quality_status",
      "owners",
      "blockers",
    ],
    release_readiness: [
      "release_readiness",
      "quality_status",
      "target_metric",
      "blockers",
    ],
  };
  const catalog = scope === "portfolio" ? portfolioWidgets : projectWidgets;
  const selected = definitions[preset] ?? catalog.map((widget) => widget.id);
  return [
    ...selected.map((id) => ({ id, visible: true })),
    ...catalog
      .filter((widget) => !selected.includes(widget.id))
      .map((widget) => ({ id: widget.id, visible: false })),
  ];
}

function portfolioChangesForScenario(
  scenario: ScenarioState,
): Partial<Project> {
  switch (scenario.program.stage) {
    case "qa_blocked":
      return {
        health: "blocked",
        stage: "quality_review",
        releaseReadiness: 42,
        blockers: ["Delivery failed critical QA"],
        nextDecision: "Approve vendor remediation",
      };
    case "remediation_requested":
      return {
        health: "at_risk",
        stage: "quality_review",
        releaseReadiness: 50,
        blockers: ["Vendor remediation in progress"],
        nextDecision: "Review corrected delivery",
      };
    case "corrected_received":
      return {
        health: "healthy",
        stage: "quality_review",
        releaseReadiness: 68,
        blockers: [],
        nextDecision: "Complete in-house batch QA",
      };
    case "internal_review_complete":
      return {
        health: "healthy",
        stage: "quality_review",
        releaseReadiness: 82,
        blockers: [],
        nextDecision: "Build dataset release",
      };
    case "release_ready":
      return {
        health: "healthy",
        stage: "release_ready",
        releaseReadiness: 92,
        blockers: [],
        nextDecision: "Complete required evaluation",
      };
    default:
      return {};
  }
}

const scenarioActionTypes = new Set([
  "ALIGN_REQUIREMENTS",
  "CAPTURE_SIGNAL",
  "ACTIVATE_SOURCES",
  "RUN_QA",
  "REVIEW_VENDOR",
  "REQUEST_REMEDIATION",
  "LOAD_CORRECTED",
  "COMPLETE_INTERNAL",
  "RESOLVE_INTERNAL",
  "BUILD_RELEASE",
  "PROMOTE",
  "HOLD",
]);

function applyScenarioAction(
  state: WorkspaceState,
  projectId: string,
  action: Exclude<ScenarioAction, { type: "HYDRATE" } | { type: "RESET" }>,
) {
  const projectState = state.projectStates[projectId];
  if (!projectState) return state;
  if (action.type === "PROMOTE") return state;
  if (
    action.type === "BUILD_RELEASE" &&
    (!internalBatchesReleaseReady(projectState) ||
      !getProjectConfigurationGate(state, projectId).ready)
  )
    return state;
  const scenario = scenarioReducer(projectState.scenario, action);
  if (scenario === projectState.scenario) return state;
  const alignedProjectState =
    action.type === "ALIGN_REQUIREMENTS"
      ? {
          ...projectState,
          vendorEngagements: projectState.vendorEngagements.map(
            (engagement) => ({
              ...engagement,
              requirementVersion: projectState.requirements.currentVersion,
              status:
                engagement.status === "stale"
                  ? ("pilot" as const)
                  : engagement.status,
            }),
          ),
          workflowStages: projectState.workflowStages.map((stage) => ({
            ...stage,
            status:
              stage.status === "stale" ? ("active" as const) : stage.status,
          })),
          scenario,
        }
      : { ...projectState, scenario };
  let next = withProjectState(state, projectId, alignedProjectState);
  const portfolioChanges = portfolioChangesForScenario(scenario);
  if (Object.keys(portfolioChanges).length) {
    next = {
      ...next,
      projects: next.projects.map((project) =>
        project.id === projectId
          ? { ...project, ...portfolioChanges }
          : project,
      ),
    };
  }
  if (
    action.type === "BUILD_RELEASE" &&
    scenario.release &&
    !state.datasets.some((dataset) => dataset.id === scenario.release!.id)
  ) {
    const release = scenario.release;
    const project = state.projects.find((item) => item.id === projectId)!;
    const dataset: DatasetVersion = {
      id: release.id,
      projectId,
      name: project.name,
      owner: project.owner,
      version: release.version,
      sources: (["vendor", "internal", "product"] as const).filter(
        (source) => release.counts[source] > 0,
      ),
      sourceCounts: { ...release.counts },
      recordCount: release.includedRecordIds.length,
      requirementVersion: release.requirementVersion,
      qaStatus: "passed",
      releaseState: "candidate",
      evaluationStatus: "not_requested",
      latestDecision: "Awaiting evaluation handoff",
      manifest: release,
      exclusions: [...release.excludedRecordIds],
      downloadHistory: [],
      createdAt: release.createdAt,
    };
    next = {
      ...next,
      datasets: [...next.datasets, dataset],
      projectStates: {
        ...next.projectStates,
        [projectId]: {
          ...next.projectStates[projectId],
          releaseReferences: [
            ...next.projectStates[projectId].releaseReferences,
            dataset.id,
          ],
        },
      },
    };
  }
  return next;
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  if (
    "projectId" in action &&
    typeof action.projectId === "string" &&
    !state.projectStates[action.projectId]
  )
    return state;
  if (scenarioActionTypes.has(action.type)) {
    const scoped = action as ScopedScenarioAction;
    return applyScenarioAction(
      state,
      projectIdFor(state, scoped.projectId),
      scoped as Exclude<
        ScenarioAction,
        { type: "HYDRATE" } | { type: "RESET" }
      >,
    );
  }
  switch (action.type) {
    case "HYDRATE":
      return isWorkspaceState(action.state) ? action.state : state;
    case "RESET":
      return createInitialWorkspaceState();
    case "RESET_PROJECT": {
      const id = projectIdFor(state, action.projectId);
      const seed = createInitialWorkspaceState();
      const project = state.projects.find((item) => item.id === id)!;
      const fresh =
        seed.projectStates[id] ?? initialProjectState(project, false);
      const seededProject = seed.projects.find((item) => item.id === id);
      return {
        ...state,
        projects: state.projects.map((item) =>
          item.id === id && seededProject ? seededProject : item,
        ),
        projectStates: { ...state.projectStates, [id]: fresh },
        datasets: [
          ...state.datasets.filter((dataset) => dataset.projectId !== id),
          ...seed.datasets.filter((dataset) => dataset.projectId === id),
        ],
        evaluationHandoffs: [
          ...state.evaluationHandoffs.filter(
            (handoff) => handoff.projectId !== id,
          ),
          ...seed.evaluationHandoffs.filter(
            (handoff) => handoff.projectId === id,
          ),
        ],
        audit: workspaceAudit(
          state,
          "Project reset",
          `${id} returned to its deterministic project state.`,
          "Maya Chen",
          id,
        ),
      };
    }
    case "SWITCH_PROJECT":
      return state.projectStates[action.projectId]
        ? { ...state, activeProjectId: action.projectId }
        : state;
    case "ADD_PROJECT": {
      const baseId = action.project.id ?? slug(action.project.name);
      let id = baseId;
      let suffix = 2;
      while (state.projectStates[id]) id = `${baseId}-${suffix++}`;
      const project: Project = {
        ...action.project,
        id,
        recordVolume: 0,
        releaseReadiness: 0,
        evaluationStatus: "not_requested",
        createdAt: DEMO_NOW,
        simulated: true,
      };
      return {
        ...state,
        projects: [...state.projects, project],
        activeProjectId: id,
        projectStates: {
          ...state.projectStates,
          [id]: initialProjectState(project),
        },
        audit: workspaceAudit(
          state,
          "Project created",
          `${project.name} was added in planning state.`,
          "Maya Chen",
          project.id,
        ),
      };
    }
    case "EDIT_PROJECT":
      return {
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.projectId
            ? { ...project, ...action.changes }
            : project,
        ),
        audit: workspaceAudit(
          state,
          "Project updated",
          `${action.projectId} portfolio fields were updated.`,
          "Maya Chen",
          action.projectId,
        ),
      };
    case "SET_DASHBOARD_PRESET": {
      if (action.scope === "portfolio")
        return {
          ...state,
          portfolioConfig: {
            preset: action.preset,
            widgets: presetWidgets("portfolio", action.preset),
          },
        };
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      return withProjectState(state, id, {
        ...ps,
        missionConfig: {
          preset: action.preset,
          widgets: presetWidgets("project", action.preset),
        },
      });
    }
    case "TOGGLE_WIDGET":
    case "MOVE_WIDGET": {
      const op = action.type === "TOGGLE_WIDGET" ? "toggle" : action.direction;
      if (action.scope === "portfolio")
        return {
          ...state,
          portfolioConfig: updateWidgets(
            state.portfolioConfig,
            action.widgetId,
            op,
          ),
        };
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      return withProjectState(state, id, {
        ...ps,
        missionConfig: updateWidgets(ps.missionConfig, action.widgetId, op),
      });
    }
    case "EDIT_REQUIREMENT_DRAFT": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      return withProjectState(state, id, {
        ...ps,
        requirements: {
          ...ps.requirements,
          draft: {
            ...ps.requirements.draft,
            ...action.changes,
            thresholds: {
              ...ps.requirements.draft.thresholds,
              ...action.changes.thresholds,
            },
          },
        },
      });
    }
    case "EDIT_SOURCE_PLAN_ITEM": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      const sourcePlan = ps.sourcePlan.map((item) =>
        item.source === action.source
          ? {
              ...item,
              ...action.changes,
              targetRecords:
                action.changes.targetRecords === undefined
                  ? item.targetRecords
                  : Math.max(0, action.changes.targetRecords),
              share:
                action.changes.share === undefined
                  ? item.share
                  : Math.min(100, Math.max(0, action.changes.share)),
              estimatedCost:
                action.changes.estimatedCost === undefined
                  ? item.estimatedCost
                  : Math.max(0, action.changes.estimatedCost),
            }
          : item,
      );
      return withProjectState(state, id, {
        ...ps,
        sourcePlan,
        sourcePlanStatus: "stale",
      });
    }
    case "SAVE_SOURCE_PLAN": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      const totalShare = ps.sourcePlan.reduce(
        (sum, item) => sum + item.share,
        0,
      );
      if (totalShare !== 100) return state;
      return {
        ...withProjectState(state, id, { ...ps, sourcePlanStatus: "aligned" }),
        audit: workspaceAudit(
          state,
          "Source plan saved",
          `${id} saved a 100% sourcing allocation for ${ps.requirements.currentVersion}.`,
          "Maya Chen",
          id,
        ),
      };
    }
    case "PUBLISH_REQUIREMENT": {
      if (!action.reason.trim()) return state;
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      const previous = ps.requirements.versions.at(-1)!;
      const version = nextVersion(ps.requirements.currentVersion);
      const published: RequirementVersion = {
        ...ps.requirements.draft,
        thresholds: { ...ps.requirements.draft.thresholds },
        slices: [...ps.requirements.draft.slices],
        exclusions: [...ps.requirements.draft.exclusions],
        version,
        publishedAt: DEMO_NOW,
        publishedBy: action.actor ?? "Maya Chen",
        changeReason: action.reason,
        changedFields: changedDraftFields(previous, ps.requirements.draft),
      };
      const scenario: ScenarioState = {
        ...ps.scenario,
        program: {
          ...ps.scenario.program,
          requirementVersion: version,
          stage: "signal_detected",
        },
        artifacts: ps.scenario.artifacts.map((artifact) => ({
          ...artifact,
          status: "stale",
        })),
        workflow: { ...ps.scenario.workflow },
        activeDelivery: "defective",
        vendorDecisions: {},
        internalTasks: ps.scenario.internalTasks.map((task) => ({
          ...task,
          requirementVersion: version,
          status: "pending",
          decision: undefined,
        })),
        qaReport: null,
        remediation: null,
        release: null,
      };
      const updated: ProjectState = {
        ...ps,
        requirements: {
          ...ps.requirements,
          currentVersion: version,
          versions: [...ps.requirements.versions, published],
        },
        sourcePlanStatus: "stale",
        vendorEngagements: ps.vendorEngagements.map((engagement) => ({
          ...engagement,
          status: "stale",
        })),
        workflowStages: ps.workflowStages.map((stage) => ({
          ...stage,
          status: "stale",
        })),
        internalWorkBatches: ps.internalWorkBatches.map((batch) => ({
          ...batch,
          status: "planned",
          completedTasks: 0,
          requirementVersion: version,
          aggregateQA: undefined,
          updatedAt: DEMO_NOW,
        })),
        releaseReferences: [],
        evaluationReferences: [],
        scenario,
      };
      return {
        ...withProjectState(state, id, updated),
        audit: workspaceAudit(
          state,
          "Requirement published",
          `${id} published ${version}; linked artifacts were marked stale.`,
          action.actor,
          id,
        ),
      };
    }
    case "ADD_ATTACHMENT": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      if (
        action.attachment.size > 2 * 1024 * 1024 ||
        ![
          "text/markdown",
          "text/plain",
          "application/json",
          "application/pdf",
        ].includes(action.attachment.mimeType)
      )
        return state;
      return withProjectState(state, id, {
        ...ps,
        requirements: {
          ...ps.requirements,
          attachments: [
            ...ps.requirements.attachments.filter(
              (item) => item.id !== action.attachment.id,
            ),
            action.attachment,
          ],
        },
      });
    }
    case "ADD_REMINDER": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      if (!action.reminder.recipient.trim() || !action.reminder.message.trim())
        return state;
      const reminder: Reminder = {
        ...action.reminder,
        id: `reminder-${id}-${ps.requirements.reminders.length + 1}`,
        status: "open",
        createdAt: DEMO_NOW,
        simulated: true,
      };
      return {
        ...withProjectState(state, id, {
          ...ps,
          requirements: {
            ...ps.requirements,
            reminders: [...ps.requirements.reminders, reminder],
          },
        }),
        audit: workspaceAudit(
          state,
          "Reminder created",
          `${id}: alignment reminder assigned to ${reminder.recipient}.`,
          "Maya Chen",
          id,
        ),
      };
    }
    case "RESOLVE_REMINDER": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      return withProjectState(state, id, {
        ...ps,
        requirements: {
          ...ps.requirements,
          reminders: ps.requirements.reminders.map((item) =>
            item.id === action.reminderId
              ? { ...item, status: "resolved", resolvedAt: DEMO_NOW }
              : item,
          ),
        },
      });
    }
    case "ADD_VENDOR":
      return state.vendors.some((vendor) => vendor.id === action.vendor.id)
        ? state
        : {
            ...state,
            vendors: [...state.vendors, action.vendor],
            audit: workspaceAudit(
              state,
              "Vendor added",
              `${action.vendor.name} was added to the directory.`,
            ),
          };
    case "EDIT_VENDOR":
      return {
        ...state,
        vendors: state.vendors.map((vendor) =>
          vendor.id === action.vendorId
            ? {
                ...vendor,
                ...action.changes,
                metrics: action.changes.metrics
                  ? { ...action.changes.metrics }
                  : vendor.metrics,
              }
            : vendor,
        ),
      };
    case "ASSIGN_REGISTRY_ENTRY": {
      if (!state.registryEntries.some((entry) => entry.id === action.entryId))
        return state;
      return {
        ...state,
        registryEntries: state.registryEntries.map((entry) =>
          entry.id === action.entryId &&
          !entry.assignedProjectIds.includes(action.projectId)
            ? {
                ...entry,
                assignedProjectIds: [
                  ...entry.assignedProjectIds,
                  action.projectId,
                ],
              }
            : entry,
        ),
        audit: workspaceAudit(
          state,
          "Registry resource assigned",
          `${action.entryId} was assigned to ${action.projectId}.`,
          "Maya Chen",
          action.projectId,
        ),
      };
    }
    case "SELECT_VENDOR": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      if (
        !state.vendors.some((vendor) => vendor.id === action.vendorId) ||
        ps.vendorEngagements.some(
          (item) =>
            item.vendorId === action.vendorId && item.status !== "paused",
        )
      )
        return state;
      const engagement: VendorEngagement = {
        id: `engagement-${id}-${action.vendorId}-${ps.vendorEngagements.length + 1}`,
        projectId: id,
        vendorId: action.vendorId,
        status: "planned",
        requirementVersion: ps.requirements.currentVersion,
        workPackageVersion: "wp-v1",
        createdAt: DEMO_NOW,
      };
      return withProjectState(state, id, {
        ...ps,
        vendorEngagements: [...ps.vendorEngagements, engagement],
      });
    }
    case "CREATE_INTERNAL_BATCH": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      const batch: InternalWorkBatch = {
        ...action.batch,
        id: `internal-batch-${id}-${ps.internalWorkBatches.length + 1}`,
        projectId: id,
        status: "planned",
        completedTasks: 0,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      };
      return withProjectState(state, id, {
        ...ps,
        internalWorkBatches: [...ps.internalWorkBatches, batch],
      });
    }
    case "SYNC_INTERNAL_BATCH": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      return withProjectState(state, id, {
        ...ps,
        internalWorkBatches: ps.internalWorkBatches.map((batch) =>
          batch.id === action.batchId
            ? {
                ...batch,
                completedTasks: Math.min(
                  batch.totalTasks,
                  Math.max(0, action.completedTasks),
                ),
                status:
                  action.completedTasks >= batch.totalTasks
                    ? "completed"
                    : "in_progress",
                updatedAt: DEMO_NOW,
              }
            : batch,
        ),
      });
    }
    case "IMPORT_INTERNAL_RESULT": {
      const id = projectIdFor(state, action.projectId);
      const ps = state.projectStates[id];
      const batch = ps.internalWorkBatches.find(
        (item) => item.id === action.batchId,
      );
      if (!batch || batch.completedTasks !== batch.totalTasks) return state;
      const passed = action.aggregateQA >= 0.9;
      const internalTasks = passed
        ? ps.scenario.internalTasks.map((task) => ({
            ...task,
            status: "complete" as const,
            decision: task.decision ?? {
              recordId: task.recordId,
              assetId: task.assetId,
              action: "accept" as const,
              rationale: `Accepted through aggregate QA import from ${batch.name}.`,
              reviewer: batch.team,
              label: task.referenceAnswer,
              confidence: action.aggregateQA,
              createdAt: DEMO_NOW,
            },
          }))
        : ps.scenario.internalTasks;
      const scenario = {
        ...ps.scenario,
        internalTasks,
        program: {
          ...ps.scenario.program,
          stage:
            passed && ps.scenario.qaReport?.passed
              ? ("internal_review_complete" as const)
              : ps.scenario.program.stage,
        },
      };
      return withProjectState(state, id, {
        ...ps,
        scenario,
        internalWorkBatches: ps.internalWorkBatches.map((item) =>
          item.id === action.batchId
            ? {
                ...item,
                aggregateQA: action.aggregateQA,
                status: passed ? "completed" : "qa_failed",
                updatedAt: DEMO_NOW,
              }
            : item,
        ),
      });
    }
    case "PROJECT_SCENARIO_ACTION":
      return applyScenarioAction(
        state,
        projectIdFor(state, action.projectId),
        action.action,
      );
    case "CREATE_EVALUATION_HANDOFF": {
      const id = projectIdFor(state, action.projectId);
      const dataset = state.datasets.find(
        (item) => item.id === action.handoff.datasetId && item.projectId === id,
      );
      if (
        !dataset ||
        dataset.qaStatus !== "passed" ||
        dataset.releaseState !== "candidate" ||
        dataset.requirementVersion !==
          state.projectStates[id].requirements.currentVersion ||
        !getProjectConfigurationGate(state, id).ready ||
        state.evaluationHandoffs.some(
          (item) =>
            item.datasetId === dataset.id && item.status !== "decision_ready",
        )
      )
        return state;
      const handoff: EvaluationHandoff = {
        ...action.handoff,
        id: `evaluation-${dataset.id}-${state.evaluationHandoffs.length + 1}`,
        projectId: id,
        status: "requested",
        results: [],
        notes: "",
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      };
      return {
        ...state,
        datasets: state.datasets.map((item) =>
          item.id === dataset.id
            ? {
                ...item,
                evaluationStatus: "requested",
                latestDecision: "Evaluation requested",
              }
            : item,
        ),
        evaluationHandoffs: [...state.evaluationHandoffs, handoff],
        projectStates: {
          ...state.projectStates,
          [id]: {
            ...state.projectStates[id],
            evaluationReferences: [
              ...state.projectStates[id].evaluationReferences,
              handoff.id,
            ],
          },
        },
        audit: workspaceAudit(
          state,
          "Evaluation requested",
          `${dataset.name} ${dataset.version} was handed off.`,
          "Maya Chen",
          id,
        ),
      };
    }
    case "ADVANCE_EVALUATION": {
      const order: EvaluationHandoff["status"][] = [
        "requested",
        "accepted",
        "running",
        "results_submitted",
        "decision_ready",
      ];
      const handoff = state.evaluationHandoffs.find(
        (item) => item.id === action.handoffId,
      );
      if (!handoff) return state;
      const index = order.indexOf(handoff.status);
      const next = order[index + 1];
      if (
        !next ||
        (next === "results_submitted" && handoff.results.length === 0) ||
        (next === "decision_ready" && !evaluationEvidenceComplete(handoff))
      )
        return state;
      return {
        ...state,
        evaluationHandoffs: state.evaluationHandoffs.map((item) =>
          item.id === handoff.id
            ? { ...item, status: next, updatedAt: DEMO_NOW }
            : item,
        ),
        datasets: state.datasets.map((item) =>
          item.id === handoff.datasetId
            ? { ...item, evaluationStatus: next }
            : item,
        ),
      };
    }
    case "SUBMIT_EVALUATION_RESULTS": {
      const handoff = state.evaluationHandoffs.find(
        (item) => item.id === action.handoffId,
      );
      if (
        !handoff ||
        handoff.status !== "running" ||
        action.results.length === 0
      )
        return state;
      const guardrailNames = new Set(
        handoff.guardrails.map((metric) => metric.trim().toLowerCase()),
      );
      const results = action.results.map((result) => ({
        ...result,
        guardrail: guardrailNames.has(result.metric.trim().toLowerCase()),
        passed:
          result.operator === "gte"
            ? result.value >= result.threshold
            : result.value <= result.threshold,
      }));
      return {
        ...state,
        evaluationHandoffs: state.evaluationHandoffs.map((item) =>
          item.id === handoff.id
            ? {
                ...item,
                results,
                notes: action.notes,
                status: "results_submitted",
                updatedAt: DEMO_NOW,
              }
            : item,
        ),
        datasets: state.datasets.map((item) =>
          item.id === handoff.datasetId
            ? {
                ...item,
                evaluationStatus: "results_submitted",
                latestDecision: "Evaluation results received",
              }
            : item,
        ),
      };
    }
    case "RECORD_DATASET_DOWNLOAD": {
      if (!state.datasets.some((dataset) => dataset.id === action.datasetId))
        return state;
      return {
        ...state,
        datasets: state.datasets.map((dataset) =>
          dataset.id === action.datasetId
            ? {
                ...dataset,
                downloadHistory: [
                  ...dataset.downloadHistory,
                  { format: action.format, downloadedAt: DEMO_NOW },
                ],
              }
            : dataset,
        ),
        audit: workspaceAudit(
          state,
          "Dataset downloaded",
          `${action.datasetId} manifest downloaded as ${action.format.toUpperCase()}.`,
          "Maya Chen",
          state.datasets.find((dataset) => dataset.id === action.datasetId)
            ?.projectId,
        ),
      };
    }
    case "PROMOTE_DATASET": {
      if (
        !action.rationale.trim() ||
        !canPromoteDataset(state, action.datasetId)
      )
        return state;
      const dataset = state.datasets.find(
        (item) => item.id === action.datasetId,
      )!;
      const ps = state.projectStates[dataset.projectId];
      const scenario =
        ps.scenario.release?.id === dataset.id
          ? scenarioReducer(ps.scenario, {
              type: "PROMOTE",
              rationale: action.rationale,
            })
          : ps.scenario;
      return {
        ...state,
        datasets: state.datasets.map((item) =>
          item.id === dataset.id
            ? {
                ...item,
                releaseState: "promoted",
                latestDecision: action.rationale,
              }
            : item,
        ),
        projects: state.projects.map((project) =>
          project.id === dataset.projectId
            ? {
                ...project,
                stage: "promoted",
                health: "healthy",
                releaseReadiness: 100,
                evaluationStatus: "decision_ready",
              }
            : project,
        ),
        projectStates: {
          ...state.projectStates,
          [dataset.projectId]: { ...ps, scenario },
        },
        audit: workspaceAudit(
          state,
          "Dataset promoted",
          action.rationale,
          "Maya Chen",
          dataset.projectId,
        ),
      };
    }
    case "HOLD_DATASET": {
      if (!action.rationale.trim()) return state;
      const dataset = state.datasets.find(
        (item) => item.id === action.datasetId,
      );
      if (!dataset || dataset.releaseState !== "candidate") return state;
      const projectState = state.projectStates[dataset.projectId];
      const scenario =
        projectState.scenario.release?.id === dataset.id
          ? scenarioReducer(projectState.scenario, {
              type: "HOLD",
              rationale: action.rationale,
            })
          : projectState.scenario;
      return {
        ...state,
        datasets: state.datasets.map((item) =>
          item.id === dataset.id
            ? {
                ...item,
                releaseState: "held",
                latestDecision: action.rationale,
              }
            : item,
        ),
        projects: state.projects.map((project) =>
          project.id === dataset.projectId
            ? { ...project, stage: "held" }
            : project,
        ),
        projectStates: {
          ...state.projectStates,
          [dataset.projectId]: { ...projectState, scenario },
        },
        audit: workspaceAudit(
          state,
          "Dataset held",
          action.rationale,
          "Maya Chen",
          dataset.projectId,
        ),
      };
    }
    default:
      return state;
  }
}

export function canPromoteDataset(state: WorkspaceState, datasetId: string) {
  const dataset = state.datasets.find((item) => item.id === datasetId);
  if (
    !dataset ||
    dataset.releaseState !== "candidate" ||
    dataset.qaStatus !== "passed"
  )
    return false;
  const projectState = state.projectStates[dataset.projectId];
  if (
    !projectState ||
    dataset.requirementVersion !== projectState.requirements.currentVersion ||
    !getProjectConfigurationGate(state, dataset.projectId).ready
  )
    return false;
  const evaluations = state.evaluationHandoffs.filter(
    (item) => item.datasetId === datasetId,
  );
  return (
    evaluations.length > 0 &&
    evaluations.every(
      (item) =>
        item.status === "decision_ready" &&
        evaluationEvidenceComplete(item) &&
        item.results.every((result) => result.passed),
    )
  );
}

export function internalBatchesReleaseReady(projectState: ProjectState) {
  return getInternalBatchGateStatus(projectState).ready;
}

export function migrateScenarioV1(scenario: ScenarioState): WorkspaceState {
  const workspace = createInitialWorkspaceState();
  if (!isScenarioStateDeep(scenario)) return workspace;
  const id = "unexpected-vocals";
  const upgradedScenario: ScenarioState = {
    ...scenario,
    vendors: scenario.vendors.map((vendor) => ({
      ...vendor,
      metrics: {
        ...vendor.metrics,
        scaling:
          vendor.metrics.scaling ??
          workspace.vendors.find((item) => item.id === vendor.id)?.metrics
            .scaling ??
          75,
      },
    })),
  };
  return {
    ...workspace,
    projectStates: {
      ...workspace.projectStates,
      [id]: {
        ...workspace.projectStates[id],
        scenario: upgradedScenario,
        sourcePlan: scenario.sourcePlan.map((item) => ({ ...item })),
      },
    },
    audit: [
      ...workspace.audit,
      {
        id: `workspace-audit-${workspace.audit.length + 1}`,
        action: "Local state migrated",
        detail:
          "The previous single-program workspace was preserved under Unexpected Vocals.",
        actor: "System",
        createdAt: DEMO_NOW,
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
function records(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}
function required(
  value: Record<string, unknown>,
  names: string[],
  kind: "string" | "number" | "boolean",
) {
  return names.every(
    (name) =>
      typeof value[name] === kind &&
      (kind !== "number" || Number.isFinite(value[name])),
  );
}

function requirementDraftRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(
      value,
      ["targetBehavior", "scope", "owner", "dueDate"],
      "string",
    ) &&
    strings(value.slices) &&
    strings(value.exclusions) &&
    isRecord(value.thresholds) &&
    required(
      value.thresholds,
      ["goldAccuracy", "maxDisagreement", "minimumSliceRecords"],
      "number",
    )
  );
}

function sourcePlanRecord(value: unknown) {
  return (
    isRecord(value) &&
    ["product", "vendor", "internal"].includes(String(value.source)) &&
    required(value, ["targetRecords", "share", "estimatedCost"], "number") &&
    required(value, ["confidence", "turnaround"], "string")
  );
}

function vendorRecord(value: unknown, requireScaling = true) {
  if (
    !isRecord(value) ||
    !required(value, ["id", "name", "specialty"], "string") ||
    !required(value, ["rate", "weeklyCapacity"], "number") ||
    !isRecord(value.metrics)
  )
    return false;
  const metricNames = [
    "quality",
    "expertise",
    "responsiveness",
    "improvement",
    "reliability",
    "costEfficiency",
    "throughput",
    ...(requireScaling ? ["scaling"] : []),
  ];
  return (
    required(value.metrics, metricNames, "number") &&
    records(value.history) &&
    value.history.every(
      (point) =>
        required(point, ["period"], "string") &&
        required(point, ["quality"], "number"),
    )
  );
}

function annotationDecisionRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(
      value,
      ["recordId", "assetId", "action", "rationale", "reviewer", "createdAt"],
      "string",
    ) &&
    (value.label === undefined || typeof value.label === "string") &&
    (value.confidence === undefined ||
      (typeof value.confidence === "number" &&
        Number.isFinite(value.confidence)))
  );
}

function qaReportRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(value, ["delivery", "generatedAt"], "string") &&
    required(value, ["passed"], "boolean") &&
    required(value, ["acceptedCount", "blockedCount"], "number") &&
    records(value.gates) &&
    value.gates.every(
      (gate) =>
        required(
          gate,
          ["id", "label", "displayValue", "threshold"],
          "string",
        ) &&
        required(gate, ["value"], "number") &&
        required(gate, ["passed", "critical"], "boolean") &&
        strings(gate.recordIds) &&
        (gate.subjects === undefined || strings(gate.subjects)),
    )
  );
}

function remediationRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(value, ["id", "vendorId", "status"], "string") &&
    required(value, ["retestSize"], "number") &&
    strings(value.defectCategories) &&
    strings(value.actions)
  );
}

function datasetReleaseRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(
      value,
      [
        "id",
        "version",
        "requirementVersion",
        "rubricVersion",
        "workflowVersion",
        "adapterVersion",
        "deliveryVersion",
        "createdAt",
        "decision",
      ],
      "string",
    ) &&
    isRecord(value.counts) &&
    required(value.counts, ["vendor", "internal", "product"], "number") &&
    strings(value.includedRecordIds) &&
    strings(value.excludedRecordIds) &&
    records(value.lineage) &&
    value.lineage.every(
      (item) =>
        required(
          item,
          [
            "recordId",
            "source",
            "originId",
            "requirementVersion",
            "rubricVersion",
            "workflowVersion",
          ],
          "string",
        ) &&
        (item.decision === undefined ||
          annotationDecisionRecord(item.decision)),
    ) &&
    (value.rationale === undefined || typeof value.rationale === "string")
  );
}

function workflowRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(value, ["id", "name", "version", "type", "status"], "string") &&
    required(
      value,
      ["goldAccuracyThreshold", "minSliceRecords", "maxDisagreement"],
      "number",
    ) &&
    required(
      value,
      ["rubricVersion", "humanReviewRule", "description"],
      "string",
    ) &&
    strings(value.inputFields) &&
    strings(value.outputFields) &&
    strings(value.requiredSlices) &&
    (value.agentConfig === undefined ||
      (isRecord(value.agentConfig) &&
        required(value.agentConfig, ["model", "promptVersion"], "string") &&
        required(value.agentConfig, ["confidenceThreshold"], "number") &&
        strings(value.agentConfig.knownFailures)))
  );
}

function datasetRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(
      value,
      [
        "id",
        "projectId",
        "name",
        "owner",
        "version",
        "requirementVersion",
        "qaStatus",
        "releaseState",
        "evaluationStatus",
        "latestDecision",
        "createdAt",
      ],
      "string",
    ) &&
    required(value, ["recordCount"], "number") &&
    strings(value.sources) &&
    isRecord(value.sourceCounts) &&
    required(value.sourceCounts, ["vendor", "internal", "product"], "number") &&
    strings(value.exclusions) &&
    records(value.downloadHistory) &&
    value.downloadHistory.every((download) =>
      required(download, ["format", "downloadedAt"], "string"),
    ) &&
    (value.manifest === null || datasetReleaseRecord(value.manifest))
  );
}

function evaluationHandoffRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(
      value,
      [
        "id",
        "projectId",
        "datasetId",
        "dueDate",
        "method",
        "decisionRequest",
        "status",
        "delivery",
        "notes",
        "createdAt",
        "updatedAt",
      ],
      "string",
    ) &&
    strings(value.owners) &&
    strings(value.targetMetrics) &&
    strings(value.guardrails) &&
    strings(value.slices) &&
    records(value.results) &&
    value.results.every(
      (result) =>
        required(result, ["metric", "operator"], "string") &&
        required(result, ["value", "threshold"], "number") &&
        required(result, ["guardrail", "passed"], "boolean"),
    )
  );
}

function auditRecord(value: unknown) {
  return (
    isRecord(value) &&
    required(
      value,
      ["id", "action", "detail", "actor", "createdAt"],
      "string",
    ) &&
    (value.projectId === undefined || typeof value.projectId === "string")
  );
}

function isScenarioStateDeep(value: unknown): value is ScenarioState {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.program) ||
    !required(
      value.program,
      [
        "id",
        "name",
        "summary",
        "owner",
        "researchOwner",
        "productOwner",
        "requirementVersion",
        "rubricVersion",
        "deadline",
        "stage",
      ],
      "string",
    ) ||
    !required(value.program, ["baseline", "target", "guardrail"], "number")
  )
    return false;
  return (
    records(value.artifacts) &&
    value.artifacts.every((artifact) =>
      required(
        artifact,
        ["id", "name", "version", "owner", "status"],
        "string",
      ),
    ) &&
    records(value.sourcePlan) &&
    value.sourcePlan.every(sourcePlanRecord) &&
    workflowRecord(value.workflow) &&
    records(value.productSignals) &&
    value.productSignals.every(
      (signal) =>
        required(
          signal,
          ["id", "kind", "label", "slice", "createdAt"],
          "string",
        ) &&
        required(signal, ["confidence"], "number") &&
        signal.simulated === true,
    ) &&
    records(value.vendors) &&
    value.vendors.every((vendor) => vendorRecord(vendor, false)) &&
    isRecord(value.vendorDecisions) &&
    Object.values(value.vendorDecisions).every(annotationDecisionRecord) &&
    (value.activeDelivery === "defective" ||
      value.activeDelivery === "corrected") &&
    records(value.internalTasks) &&
    value.internalTasks.every(
      (task) =>
        required(
          task,
          [
            "id",
            "recordId",
            "assetId",
            "prompt",
            "genre",
            "assignedTo",
            "requirementVersion",
            "rubricVersion",
            "referenceAnswer",
            "status",
          ],
          "string",
        ) &&
        required(task, ["calibration"], "boolean") &&
        (task.decision === undefined ||
          annotationDecisionRecord(task.decision)),
    ) &&
    (value.qaReport === null || qaReportRecord(value.qaReport)) &&
    (value.remediation === null || remediationRecord(value.remediation)) &&
    (value.release === null || datasetReleaseRecord(value.release)) &&
    records(value.audit) &&
    value.audit.every(auditRecord)
  );
}

export function isWorkspaceState(value: unknown): value is WorkspaceState {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.fixtureRevision !== 2 ||
    !required(value, ["activeProjectId"], "string")
  )
    return false;
  if (
    !records(value.projects) ||
    value.projects.length === 0 ||
    !value.projects.every(
      (project) =>
        required(
          project,
          [
            "id",
            "name",
            "summary",
            "owner",
            "researchOwner",
            "productOwner",
            "health",
            "stage",
            "modality",
            "deadline",
            "nextDecision",
            "evaluationStatus",
            "createdAt",
          ],
          "string",
        ) &&
        required(
          project,
          ["budget", "targetVolume", "recordVolume", "releaseReadiness"],
          "number",
        ) &&
        strings(project.blockers),
    )
  )
    return false;
  if (!isRecord(value.projectStates)) return false;
  const projectStates = value.projectStates;
  if (
    !value.projects.every((project) => {
      const ps = projectStates[project.id as string];
      return (
        isRecord(ps) &&
        ps.projectId === project.id &&
        (ps.sourcePlanStatus === "pending" ||
          ps.sourcePlanStatus === "aligned" ||
          ps.sourcePlanStatus === "stale") &&
        isRecord(ps.missionConfig) &&
        required(ps.missionConfig, ["preset"], "string") &&
        records(ps.missionConfig.widgets) &&
        ps.missionConfig.widgets.every(
          (widget) =>
            required(widget, ["id"], "string") &&
            required(widget, ["visible"], "boolean"),
        ) &&
        isRecord(ps.requirements) &&
        required(
          ps.requirements,
          ["id", "projectId", "title", "currentVersion"],
          "string",
        ) &&
        isRecord(ps.requirements.draft) &&
        required(
          ps.requirements.draft,
          ["targetBehavior", "scope", "owner", "dueDate"],
          "string",
        ) &&
        strings(ps.requirements.draft.slices) &&
        strings(ps.requirements.draft.exclusions) &&
        isRecord(ps.requirements.draft.thresholds) &&
        required(
          ps.requirements.draft.thresholds,
          ["goldAccuracy", "maxDisagreement", "minimumSliceRecords"],
          "number",
        ) &&
        records(ps.requirements.versions) &&
        ps.requirements.versions.every(
          (version) =>
            requirementDraftRecord(version) &&
            required(
              version,
              ["version", "publishedAt", "publishedBy", "changeReason"],
              "string",
            ) &&
            strings(version.changedFields),
        ) &&
        records(ps.requirements.attachments) &&
        ps.requirements.attachments.every(
          (attachment) =>
            required(
              attachment,
              [
                "id",
                "name",
                "mimeType",
                "storageKey",
                "uploadedAt",
                "uploadedBy",
              ],
              "string",
            ) && required(attachment, ["size"], "number"),
        ) &&
        records(ps.requirements.reminders) &&
        ps.requirements.reminders.every(
          (reminder) =>
            required(
              reminder,
              ["id", "recipient", "dueDate", "message", "status", "createdAt"],
              "string",
            ) && reminder.simulated === true,
        ) &&
        records(ps.sourcePlan) &&
        ps.sourcePlan.every(sourcePlanRecord) &&
        records(ps.vendorEngagements) &&
        ps.vendorEngagements.every((engagement) =>
          required(
            engagement,
            [
              "id",
              "projectId",
              "vendorId",
              "status",
              "requirementVersion",
              "workPackageVersion",
              "createdAt",
            ],
            "string",
          ),
        ) &&
        records(ps.internalWorkBatches) &&
        ps.internalWorkBatches.every(
          (batch) =>
            required(
              batch,
              [
                "id",
                "projectId",
                "name",
                "team",
                "status",
                "requirementVersion",
                "createdAt",
                "updatedAt",
              ],
              "string",
            ) && required(batch, ["totalTasks", "completedTasks"], "number"),
        ) &&
        records(ps.internalOpsSnapshots) &&
        ps.internalOpsSnapshots.every(
          (snapshot) =>
            required(snapshot, ["id", "projectId", "capturedAt"], "string") &&
            required(
              snapshot,
              [
                "backlog",
                "completedTasks",
                "dailyThroughput",
                "medianCycleHours",
                "slaAttainment",
                "calibrationAgreement",
                "escalationRate",
                "qcFailureRate",
                "availableCapacity",
              ],
              "number",
            ) &&
            records(snapshot.teamAllocation) &&
            records(snapshot.defectTaxonomy),
        ) &&
        records(ps.workflowStages) &&
        ps.workflowStages.every(
          (stage) =>
            required(
              stage,
              ["id", "projectId", "name", "owner", "version", "status"],
              "string",
            ) &&
            strings(stage.entryCriteria) &&
            strings(stage.exitCriteria) &&
            strings(stage.dependencies) &&
            strings(stage.linkedArtifactIds),
        ) &&
        isScenarioStateDeep(ps.scenario) &&
        strings(ps.releaseReferences) &&
        strings(ps.evaluationReferences)
      );
    })
  )
    return false;
  if (!value.projectStates[value.activeProjectId as string]) return false;
  if (
    !isRecord(value.portfolioConfig) ||
    !required(value.portfolioConfig, ["preset"], "string") ||
    !records(value.portfolioConfig.widgets)
  )
    return false;
  if (
    !records(value.vendors) ||
    !value.vendors.every((vendor) => vendorRecord(vendor))
  )
    return false;
  if (
    !records(value.vendorPilots) ||
    !records(value.datasets) ||
    !records(value.evaluationHandoffs) ||
    !records(value.registryEntries) ||
    !records(value.audit)
  )
    return false;
  if (
    !value.vendorPilots.every(
      (pilot) =>
        required(
          pilot,
          [
            "id",
            "projectId",
            "vendorId",
            "version",
            "workPackageVersion",
            "startDate",
            "endDate",
            "decision",
          ],
          "string",
        ) &&
        required(
          pilot,
          [
            "taskCount",
            "unitCost",
            "totalCost",
            "turnaroundHours",
            "throughputPerDay",
            "quality",
            "goldAccuracy",
            "remediationCount",
          ],
          "number",
        ),
    ) ||
    !value.datasets.every(datasetRecord) ||
    !value.evaluationHandoffs.every(evaluationHandoffRecord) ||
    !value.registryEntries.every(
      (entry) =>
        required(
          entry,
          ["id", "name", "kind", "version", "status", "description"],
          "string",
        ) &&
        strings(entry.capabilities) &&
        strings(entry.assignedProjectIds),
    ) ||
    !value.audit.every(auditRecord)
  )
    return false;
  const datasetIds = value.datasets.map((dataset) => dataset.id);
  if (
    !datasetIds.every((id) => typeof id === "string") ||
    new Set(datasetIds).size !== datasetIds.length
  )
    return false;
  const projectIds = new Set(value.projects.map((project) => project.id));
  const vendorIds = new Set(value.vendors.map((vendor) => vendor.id));
  if (
    value.vendorPilots.some(
      (pilot) =>
        !projectIds.has(pilot.projectId) || !vendorIds.has(pilot.vendorId),
    ) ||
    value.datasets.some((dataset) => !projectIds.has(dataset.projectId)) ||
    value.evaluationHandoffs.some(
      (handoff) =>
        !projectIds.has(handoff.projectId) ||
        !datasetIds.includes(String(handoff.datasetId)),
    )
  )
    return false;
  return true;
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  hydrated: boolean;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const subscribeToHydration = () => () => undefined;

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    undefined,
    createInitialWorkspaceState,
  );
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isWorkspaceState(parsed))
          dispatch({ type: "HYDRATE", state: parsed });
        else
          window.localStorage.setItem(
            WORKSPACE_STORAGE_KEY,
            JSON.stringify(createInitialWorkspaceState()),
          );
        return;
      }
      const legacy = window.localStorage.getItem(SCENARIO_V1_STORAGE_KEY);
      if (legacy) {
        const parsed: unknown = JSON.parse(legacy);
        const migrated = isScenarioStateDeep(parsed)
          ? migrateScenarioV1(parsed)
          : createInitialWorkspaceState();
        dispatch({ type: "HYDRATE", state: migrated });
        window.localStorage.setItem(
          WORKSPACE_STORAGE_KEY,
          JSON.stringify(migrated),
        );
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    if (hydrated)
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);
  const value = useMemo(
    () => ({ state, dispatch, hydrated }),
    [state, hydrated],
  );
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
