import type {
  DatasetVersion,
  EvaluationHandoff,
  ProjectState,
  WorkspaceState,
} from "./types";

export type EvidenceStatus =
  | "not_required"
  | "pending"
  | "active"
  | "blocked"
  | "complete";

export interface ReleaseCheckpoint {
  id:
    | "configuration"
    | "quality"
    | "internal"
    | "dataset"
    | "evaluation"
    | "decision";
  label: string;
  status: EvidenceStatus;
  detail: string;
  source: string;
  href: string;
  action: string;
}

export function getInternalBatchGateStatus(projectState: ProjectState) {
  if (projectState.sourcePlanStatus !== "aligned") {
    return {
      status:
        projectState.sourcePlanStatus === "stale"
          ? ("blocked" as const)
          : ("pending" as const),
      ready: false,
      detail:
        projectState.sourcePlanStatus === "stale"
          ? "Review and save the source plan against the current requirement"
          : "Complete and save the source plan before evaluating in-house demand",
    };
  }
  const internalPlan = projectState.sourcePlan.find(
    (item) => item.source === "internal",
  );
  const required =
    (internalPlan?.targetRecords ?? 0) > 0 || (internalPlan?.share ?? 0) > 0;
  const batches = projectState.internalWorkBatches;

  if (!required) {
    return {
      status: "not_required" as const,
      ready: true,
      detail: "No in-house allocation in the saved source plan",
    };
  }
  if (!batches.length) {
    return {
      status: "pending" as const,
      ready: false,
      detail: "In-house work is planned, but no batch has been created",
    };
  }
  if (
    batches.some(
      (batch) =>
        batch.status === "qa_failed" ||
        (batch.status === "completed" &&
          typeof batch.aggregateQA === "number" &&
          batch.aggregateQA < 0.9),
    )
  ) {
    return {
      status: "blocked" as const,
      ready: false,
      detail: "At least one completed batch is below the 90% aggregate QA gate",
    };
  }
  if (
    batches.every(
      (batch) =>
        batch.status === "completed" &&
        typeof batch.aggregateQA === "number" &&
        batch.aggregateQA >= 0.9,
    )
  ) {
    return {
      status: "complete" as const,
      ready: true,
      detail: "Every required batch is complete with aggregate QA at or above 90%",
    };
  }
  return {
    status: "active" as const,
    ready: false,
    detail: "Batch collection, synchronization, or aggregate QA is still in progress",
  };
}

export function getProjectConfigurationGate(
  state: WorkspaceState,
  projectId: string,
) {
  const projectState = state.projectStates[projectId];
  if (!projectState) {
    return {
      status: "blocked" as const,
      ready: false,
      detail: "Project state is unavailable",
      href: "/portfolio",
    };
  }
  const version = projectState.requirements.currentVersion;
  const workflowAssigned = state.registryEntries.some(
    (entry) =>
      entry.kind === "workflow" && entry.assignedProjectIds.includes(projectId),
  );
  const versionAligned =
    projectState.scenario.program.requirementVersion === version &&
    projectState.scenario.artifacts.every(
      (artifact) =>
        artifact.status === "aligned" && artifact.version === version,
    ) &&
    projectState.vendorEngagements.every(
      (engagement) =>
        engagement.status !== "stale" &&
        engagement.requirementVersion === version,
    ) &&
    projectState.workflowStages.every((stage) => stage.status !== "stale") &&
    projectState.internalWorkBatches.every(
      (batch) => batch.requirementVersion === version,
    );
  const ready =
    projectState.sourcePlanStatus === "aligned" &&
    workflowAssigned &&
    versionAligned;
  if (ready) {
    return {
      status: "complete" as const,
      ready: true,
      detail: `Requirement ${version}, source plan, workflow, and linked work are aligned`,
      href: `/projects/${projectId}/requirements`,
    };
  }
  const pending =
    projectState.sourcePlanStatus === "pending" || !workflowAssigned;
  return {
    status: pending ? ("pending" as const) : ("blocked" as const),
    ready: false,
    detail: !workflowAssigned
      ? "Assign a workflow from the Registry before collection and release"
      : projectState.sourcePlanStatus !== "aligned"
        ? "Review and save the source plan against the current requirement"
        : "One or more linked artifacts reference stale configuration",
    href: !workflowAssigned
      ? "/registry"
      : `/projects/${projectId}/requirements`,
  };
}

export function evaluationEvidenceComplete(handoff: EvaluationHandoff) {
  const requiredMetrics = [...handoff.targetMetrics, ...handoff.guardrails];
  const submittedMetrics = new Set(
    handoff.results.map((result) => result.metric.trim().toLowerCase()),
  );
  return (
    requiredMetrics.length > 0 &&
    requiredMetrics.every((metric) =>
      submittedMetrics.has(metric.trim().toLowerCase()),
    )
  );
}

function currentDataset(
  state: WorkspaceState,
  projectState: ProjectState,
): DatasetVersion | undefined {
  return (
    state.datasets.find(
      (dataset) =>
        dataset.projectId === projectState.projectId &&
        dataset.id === projectState.scenario.release?.id,
    ) ??
    state.datasets.find(
      (dataset) =>
        dataset.projectId === projectState.projectId &&
        dataset.requirementVersion ===
          projectState.requirements.currentVersion,
    )
  );
}

function currentHandoff(
  state: WorkspaceState,
  dataset: DatasetVersion | undefined,
): EvaluationHandoff | undefined {
  return state.evaluationHandoffs.find(
    (handoff) => handoff.datasetId === dataset?.id,
  );
}

export function buildReleaseCheckpoints(
  state: WorkspaceState,
  projectId: string,
): {
  checkpoints: ReleaseCheckpoint[];
  dataset?: DatasetVersion;
  handoff?: EvaluationHandoff;
} {
  const projectState = state.projectStates[projectId];
  if (!projectState) return { checkpoints: [] };
  const dataset = currentDataset(state, projectState);
  const handoff = currentHandoff(state, dataset);
  const configuration = getProjectConfigurationGate(state, projectId);
  const qa = projectState.scenario.qaReport;
  const qualityPassed = !!qa?.passed || dataset?.qaStatus === "passed";
  const qualityStatus: EvidenceStatus = qualityPassed
    ? "complete"
    : qa
      ? "blocked"
      : ["sources_active", "corrected_received"].includes(
            projectState.scenario.program.stage,
          )
        ? "active"
        : "pending";
  const internal = getInternalBatchGateStatus(projectState);
  const failedEvaluation = !!handoff?.results.some((result) => !result.passed);
  const evaluationStatus: EvidenceStatus =
    handoff?.status === "decision_ready" &&
    evaluationEvidenceComplete(handoff) &&
    !failedEvaluation
      ? "complete"
      : failedEvaluation
        ? "blocked"
        : handoff
          ? "active"
          : "pending";
  const decisionRecorded =
    dataset?.releaseState === "promoted" || dataset?.releaseState === "held";

  return {
    dataset,
    handoff,
    checkpoints: [
      {
        id: "configuration",
        label: "Configuration",
        status: configuration.status,
        detail: configuration.detail,
        source:
          "Calculated from requirement, source-plan, workflow, engagement, and batch versions",
        href: configuration.href,
        action: configuration.ready ? "Inspect contract" : "Resolve setup",
      },
      {
        id: "quality",
        label: "Delivery quality",
        status: qualityStatus,
        detail: qualityPassed
          ? "Required delivery QA evidence passed"
          : qa
            ? "One or more delivery QA gates failed"
            : "No delivery QA report exists",
        source: "Calculated from the current QA report and dataset QA evidence",
        href: `/projects/${projectId}/operations#quality-control`,
        action: qualityPassed ? "Inspect evidence" : "Review QA",
      },
      {
        id: "internal",
        label: "In-house batches",
        status: internal.status,
        detail: internal.detail,
        source: "Calculated from the source plan, batch completion, and aggregate QA",
        href:
          internal.status === "not_required"
            ? `/projects/${projectId}/requirements`
            : `/projects/${projectId}/operations#in-house`,
        action:
          internal.status === "not_required" ? "Review source plan" : "Review batches",
      },
      {
        id: "dataset",
        label: "Dataset",
        status: dataset
          ? "complete"
          : configuration.status === "blocked" ||
              qualityStatus === "blocked" ||
              internal.status === "blocked"
            ? "blocked"
            : "pending",
        detail: dataset
          ? `${dataset.version} is an immutable candidate`
          : "Build an immutable release after required quality evidence passes",
        source: "Calculated from the dataset registry for the current requirement version",
        href: `/projects/${projectId}/release#dataset-release`,
        action: dataset ? "Inspect dataset" : "Build dataset",
      },
      {
        id: "evaluation",
        label: "Evaluation",
        status: evaluationStatus,
        detail: handoff
          ? `Handoff is ${handoff.status.replaceAll("_", " ")}`
          : "No evaluation handoff exists for this dataset",
        source: "Calculated from the handoff lifecycle and submitted metric results",
        href: `/projects/${projectId}/release#evaluation-handoff`,
        action: handoff ? "Review handoff" : "Create handoff",
      },
      {
        id: "decision",
        label: "Decision",
        status: decisionRecorded
          ? "complete"
          : configuration.status === "blocked" || evaluationStatus === "blocked"
            ? "blocked"
            : handoff?.status === "decision_ready"
              ? "active"
              : "pending",
        detail: decisionRecorded
          ? `${dataset?.releaseState} decision recorded with rationale`
          : "Promote or hold after all required evaluation evidence passes",
        source: "Calculated from the immutable dataset decision record",
        href: `/projects/${projectId}/release#release-decision`,
        action: decisionRecorded ? "Inspect decision" : "Review decision",
      },
    ],
  };
}
