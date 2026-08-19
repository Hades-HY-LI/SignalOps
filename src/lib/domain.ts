import { correctedRecords, defectiveRecords, DEMO_NOW } from "./fixtures";
import type {
  AnnotationDecision,
  DataProgram,
  DatasetRelease,
  DeliveryRecord,
  InternalAnnotationTask,
  LineageEdge,
  LineageNode,
  QAReport,
  RequirementArtifact,
  ScenarioState,
  VendorMetrics,
  VendorProfile,
  VendorWorkPackage,
  WorkflowDefinition,
} from "./types";

export function exportWorkPackage(
  program: DataProgram,
  workflow: WorkflowDefinition,
  vendor: VendorProfile,
): VendorWorkPackage {
  return {
    id: `work-package-${program.id}-${vendor.id}-${workflow.version}`,
    programId: program.id,
    vendorId: vendor.id,
    requirementVersion: program.requirementVersion,
    rubricVersion: program.rubricVersion,
    workflowVersion: workflow.version,
    targetRecords: 2400,
    acceptance: {
      schemaValidity: 1,
      provenance: 1,
      maxDuplicates: 0,
      goldAccuracy: workflow.goldAccuracyThreshold,
      minSliceRecords: workflow.minSliceRecords,
      maxDisagreement: workflow.maxDisagreement,
    },
    schema: { input: workflow.inputFields, output: workflow.outputFields },
  };
}

export function normalizeVendorDelivery(payload: unknown): DeliveryRecord[] {
  if (!Array.isArray(payload))
    throw new Error("Vendor delivery must be an array.");
  return payload.map((item, index) => {
    if (!item || typeof item !== "object")
      throw new Error(`Record ${index + 1} is not an object.`);
    const record = item as Record<string, unknown>;
    const requiredStrings = [
      "id",
      "assetId",
      "prompt",
      "locale",
      "genre",
      "annotatorId",
      "rubricVersion",
    ];
    const invalidField = requiredStrings.find(
      (field) => typeof record[field] !== "string",
    );
    if (invalidField)
      throw new Error(
        `Record ${index + 1} has an invalid ${invalidField} field.`,
      );
    if (
      typeof record.requestedInstrumental !== "boolean" ||
      typeof record.confidence !== "number" ||
      typeof record.provenanceValid !== "boolean"
    ) {
      throw new Error(`Record ${index + 1} has invalid typed fields.`);
    }
    const labels = new Set(["vocals_present", "instrumental", "uncertain"]);
    if (record.label !== undefined && !labels.has(String(record.label)))
      throw new Error(`Record ${index + 1} has an invalid label.`);
    if (!labels.has(String(record.peerLabel)))
      throw new Error(`Record ${index + 1} has an invalid peer label.`);
    return record as unknown as DeliveryRecord;
  });
}

export function checkRequirementAlignment(
  artifacts: RequirementArtifact[],
  currentVersion: string,
) {
  return artifacts.map((artifact) => ({
    ...artifact,
    status:
      artifact.version === currentVersion
        ? ("aligned" as const)
        : ("stale" as const),
  }));
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function runQualityGates(
  records: DeliveryRecord[],
  workflow: WorkflowDefinition,
): QAReport {
  const validLabels = new Set(["vocals_present", "instrumental", "uncertain"]);
  const schemaFailures = records.filter(
    (record) =>
      !record.prompt.trim() || !record.label || !validLabels.has(record.label),
  );
  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];
  records.forEach((record) => {
    if (seen.has(record.assetId))
      duplicateIds.push(record.id, seen.get(record.assetId)!);
    else seen.set(record.assetId, record.id);
  });
  const uniqueDuplicateIds = [...new Set(duplicateIds)];
  const provenanceFailures = records.filter(
    (record) => !record.provenanceValid,
  );
  const goldRecords = records.filter((record) => record.goldAnswer);
  const goldCorrect = goldRecords.filter(
    (record) => record.label === record.goldAnswer,
  ).length;
  const goldAccuracy = goldRecords.length
    ? goldCorrect / goldRecords.length
    : 0;
  const sliceCounts = new Map<string, number>();
  records.forEach((record) =>
    sliceCounts.set(
      `${record.genre}-${record.locale}`,
      (sliceCounts.get(`${record.genre}-${record.locale}`) ?? 0) + 1,
    ),
  );
  const missingSlices = workflow.requiredSlices.filter(
    (slice) => (sliceCounts.get(slice) ?? 0) < workflow.minSliceRecords,
  );
  const staleRubrics = records.filter(
    (record) => record.rubricVersion !== workflow.rubricVersion,
  );
  const disagreements = records.filter(
    (record) => record.label !== record.peerLabel,
  );
  const disagreementRate = disagreements.length / records.length;

  const gates = [
    {
      id: "schema",
      label: "Schema validity",
      value: 1 - schemaFailures.length / records.length,
      displayValue: percent(1 - schemaFailures.length / records.length),
      threshold: "100%",
      passed: schemaFailures.length === 0,
      critical: true,
      recordIds: schemaFailures.map((record) => record.id),
    },
    {
      id: "duplicates",
      label: "Duplicate assets",
      value: uniqueDuplicateIds.length,
      displayValue: String(uniqueDuplicateIds.length),
      threshold: "0",
      passed: uniqueDuplicateIds.length === 0,
      critical: true,
      recordIds: uniqueDuplicateIds,
    },
    {
      id: "provenance",
      label: "Provenance complete",
      value: 1 - provenanceFailures.length / records.length,
      displayValue: percent(1 - provenanceFailures.length / records.length),
      threshold: "100%",
      passed: provenanceFailures.length === 0,
      critical: true,
      recordIds: provenanceFailures.map((record) => record.id),
    },
    {
      id: "gold",
      label: "Gold accuracy",
      value: goldAccuracy,
      displayValue: percent(goldAccuracy),
      threshold: `≥ ${percent(workflow.goldAccuracyThreshold)}`,
      passed: goldAccuracy >= workflow.goldAccuracyThreshold,
      critical: true,
      recordIds: goldRecords
        .filter((record) => record.label !== record.goldAnswer)
        .map((record) => record.id),
    },
    {
      id: "coverage",
      label: "Required slice coverage",
      value: workflow.requiredSlices.length - missingSlices.length,
      displayValue: `${workflow.requiredSlices.length - missingSlices.length}/${workflow.requiredSlices.length}`,
      threshold: `${workflow.requiredSlices.length}/${workflow.requiredSlices.length}`,
      passed: missingSlices.length === 0,
      critical: true,
      recordIds: [],
      subjects: missingSlices,
    },
    {
      id: "rubric",
      label: "Rubric alignment",
      value: records.length - staleRubrics.length,
      displayValue: `${records.length - staleRubrics.length}/${records.length}`,
      threshold: `${records.length}/${records.length}`,
      passed: staleRubrics.length === 0,
      critical: true,
      recordIds: staleRubrics.map((record) => record.id),
    },
    {
      id: "agreement",
      label: "Inter-rater disagreement",
      value: disagreementRate,
      displayValue: percent(disagreementRate),
      threshold: `≤ ${percent(workflow.maxDisagreement)}`,
      passed: disagreementRate <= workflow.maxDisagreement,
      critical: true,
      recordIds: disagreements.map((record) => record.id),
    },
  ];

  const blockedIds = new Set(
    gates.flatMap((gate) => (gate.passed ? [] : gate.recordIds)),
  );
  return {
    delivery: records[0]?.id.startsWith("corrected")
      ? "corrected"
      : "defective",
    passed: gates.every((gate) => !gate.critical || gate.passed),
    gates,
    acceptedCount: records.length - blockedIds.size,
    blockedCount: blockedIds.size,
    generatedAt: DEMO_NOW,
  };
}

const weights: Record<keyof VendorMetrics, number> = {
  quality: 0.3,
  reliability: 0.1,
  costEfficiency: 0.1,
  throughput: 0.05,
  expertise: 0.15,
  responsiveness: 0.1,
  improvement: 0.1,
  scaling: 0.1,
};

export function scoreVendor(metrics: VendorMetrics) {
  return (
    Math.round(
      Object.entries(weights).reduce(
        (score, [key, weight]) =>
          score + metrics[key as keyof VendorMetrics] * weight,
        0,
      ) * 10,
    ) / 10
  );
}

export function recommendAllocation(vendors: VendorProfile[]) {
  return vendors.map((vendor) => {
    const score = scoreVendor(vendor.metrics);
    const latestQuality =
      vendor.history.at(-1)?.quality ?? vendor.metrics.quality;
    const earliestQuality = vendor.history[0]?.quality ?? latestQuality;
    const trajectory = latestQuality - earliestQuality;
    const recommendation =
      score >= 90 && trajectory >= 0
        ? "expand"
        : score >= 84
          ? "maintain"
          : score >= 74 && trajectory > -5
            ? "remediate"
            : "pause";
    return { vendorId: vendor.id, score, trajectory, recommendation } as const;
  });
}

export function submitInternalAnnotation(
  task: InternalAnnotationTask,
  decision: AnnotationDecision,
): InternalAnnotationTask {
  if (!decision.rationale.trim())
    throw new Error("A review rationale is required.");
  const requiresAdjudication =
    decision.label === "uncertain" ||
    (decision.confidence ?? 0) < 0.7 ||
    (task.calibration && decision.label !== task.referenceAnswer);
  return {
    ...task,
    status: requiresAdjudication ? "adjudication_required" : "complete",
    decision,
  };
}

export function productSignalEligible(
  signal: ScenarioState["productSignals"][number],
) {
  return signal.kind === "explicit" || signal.confidence >= 0.7;
}

export function getReleaseEligibility(state: ScenarioState) {
  const vendorPassed = Boolean(
    state.qaReport?.passed && state.activeDelivery === "corrected",
  );
  const internalComplete = state.internalTasks.every(
    (task) => task.status === "complete",
  );
  const unresolvedInternal = state.internalTasks
    .filter((task) => task.status !== "complete")
    .map((task) => task.id);
  const eligibleProductSignals = state.productSignals.filter(
    productSignalEligible,
  );
  return {
    eligible: vendorPassed && internalComplete && !state.release,
    vendorPassed,
    internalComplete,
    unresolvedInternal,
    eligibleProductSignals,
    excludedProductSignals: state.productSignals.filter(
      (signal) => !productSignalEligible(signal),
    ),
  };
}

export function buildDatasetManifest(state: ScenarioState): DatasetRelease {
  const eligibility = getReleaseEligibility(state);
  if (
    !eligibility.vendorPassed ||
    !eligibility.internalComplete ||
    state.activeDelivery !== "corrected"
  ) {
    throw new Error(
      "A corrected, quality-approved delivery and resolved internal queue are required.",
    );
  }
  const activeRecords =
    state.activeDelivery === "corrected" ? correctedRecords : defectiveRecords;
  const rejected = new Set(
    Object.values(state.vendorDecisions)
      .filter((decision) => decision.action === "reject")
      .map((decision) => decision.assetId),
  );
  const vendorIds = activeRecords
    .filter((record) => !rejected.has(record.assetId))
    .map((record) => record.assetId);
  const internalIds = state.internalTasks
    .filter((task) => task.status === "complete")
    .map((task) => task.assetId);
  const productIds = eligibility.eligibleProductSignals.map(
    (signal) => signal.id,
  );
  const lineage: DatasetRelease["lineage"] = [
    ...activeRecords
      .filter((record) => !rejected.has(record.assetId))
      .map((record) => ({
        recordId: record.assetId,
        source: "vendor" as const,
        originId: `northstar:${state.activeDelivery}`,
        requirementVersion: state.program.requirementVersion,
        rubricVersion: record.rubricVersion,
        workflowVersion: state.workflow.version,
        decision: Object.values(state.vendorDecisions).find(
          (decision) => decision.assetId === record.assetId,
        ),
      })),
    ...state.internalTasks
      .filter((task) => task.status === "complete")
      .map((task) => ({
        recordId: task.assetId,
        source: "internal" as const,
        originId: task.assignedTo,
        requirementVersion: task.requirementVersion,
        rubricVersion: task.rubricVersion,
        workflowVersion: state.workflow.version,
        decision: task.decision,
      })),
    ...eligibility.eligibleProductSignals.map((signal) => ({
      recordId: signal.id,
      source: "product" as const,
      originId: signal.kind,
      requirementVersion: state.program.requirementVersion,
      rubricVersion: state.program.rubricVersion,
      workflowVersion: "product-signal-v1",
    })),
  ];
  return {
    id: `dataset-${state.program.id}-${state.program.requirementVersion}`,
    version: `dataset-${state.program.requirementVersion}`,
    requirementVersion: state.program.requirementVersion,
    rubricVersion: state.program.rubricVersion,
    workflowVersion: state.workflow.version,
    adapterVersion: "vendor-json-v1",
    deliveryVersion: "corrected",
    createdAt: DEMO_NOW,
    counts: {
      vendor: vendorIds.length,
      internal: internalIds.length,
      product: productIds.length,
    },
    includedRecordIds: [...vendorIds, ...internalIds, ...productIds],
    excludedRecordIds: [
      ...rejected,
      ...eligibility.excludedProductSignals.map((signal) => signal.id),
    ],
    lineage,
    decision: "candidate",
  };
}

export function canPromote(state: ScenarioState) {
  return Boolean(
    state.qaReport?.passed &&
      state.activeDelivery === "corrected" &&
      state.internalTasks.every((task) => task.status === "complete") &&
      state.release?.decision === "candidate",
  );
}

export function buildLineageGraph(state: ScenarioState): {
  nodes: LineageNode[];
  edges: LineageEdge[];
} {
  const allInternalComplete = state.internalTasks.every(
    (task) => task.status === "complete",
  );
  const unresolvedInternal = state.internalTasks.some(
    (task) => task.status === "adjudication_required",
  );
  const qaStatus = state.qaReport
    ? !state.qaReport.passed || unresolvedInternal
      ? "blocked"
      : allInternalComplete
        ? "complete"
        : "active"
    : "pending";
  const eligibleSignals = state.productSignals.filter(
    productSignalEligible,
  ).length;
  const nodes: LineageNode[] = [
    {
      id: "signal",
      label: "Product signal",
      detail: `${eligibleSignals}/${state.productSignals.length} eligible candidates`,
      status: "complete",
      count: eligibleSignals,
    },
    {
      id: "requirement",
      label: `Requirement ${state.program.requirementVersion}`,
      detail: `Target behavior, ${state.program.rubricVersion}, and guardrails`,
      status: state.artifacts.every((artifact) => artifact.status === "aligned")
        ? "complete"
        : "active",
    },
    {
      id: "vendor",
      label: "Vendor delivery",
      detail:
        state.activeDelivery === "corrected"
          ? "Corrected batch"
          : "Pilot batch",
      status:
        state.activeDelivery === "corrected"
          ? "complete"
          : state.qaReport
            ? "blocked"
            : "active",
      count: 48,
    },
    {
      id: "internal",
      label: "In-house review",
      detail: `${state.internalTasks.filter((task) => task.status === "complete").length}/${state.internalTasks.length} complete`,
      status: unresolvedInternal
        ? "blocked"
        : allInternalComplete
          ? "complete"
          : "active",
      count: state.internalTasks.length,
    },
    {
      id: "qa",
      label: "Unified quality",
      detail: state.qaReport
        ? `${state.qaReport.gates.filter((gate) => gate.passed).length}/${state.qaReport.gates.length} vendor gates · ${eligibleSignals} product candidates · ${state.internalTasks.filter((task) => task.status === "complete").length} internal labels`
        : "Waiting for delivery",
      status: qaStatus,
    },
    {
      id: "release",
      label: "Dataset release",
      detail: state.release ? state.release.version : "Not created",
      status: state.release ? "complete" : "pending",
      count: state.release?.includedRecordIds.length,
    },
    {
      id: "evaluation",
      label: "Evaluation",
      detail: "Target and guardrail results",
      status:
        state.program.stage === "promoted"
          ? "complete"
          : state.program.stage === "held"
            ? "blocked"
            : state.release
              ? "simulated"
              : "pending",
    },
  ];
  const edges: LineageEdge[] = [
    {
      id: "signal-requirement",
      source: "signal",
      target: "requirement",
      label: `${state.productSignals.length} signals`,
    },
    {
      id: "requirement-vendor",
      source: "requirement",
      target: "vendor",
      label: "work package",
    },
    {
      id: "requirement-internal",
      source: "requirement",
      target: "internal",
      label: state.program.rubricVersion,
    },
    { id: "vendor-qa", source: "vendor", target: "qa", label: "48 records" },
    {
      id: "internal-qa",
      source: "internal",
      target: "qa",
      label: `${state.internalTasks.filter((task) => task.status === "complete").length} labels`,
    },
    {
      id: "signal-qa",
      source: "signal",
      target: "qa",
      label: `${eligibleSignals}/${state.productSignals.length} eligible`,
    },
    {
      id: "qa-release",
      source: "qa",
      target: "release",
      label: state.release
        ? `${state.release.includedRecordIds.length} included`
        : "pending",
    },
    {
      id: "release-evaluation",
      source: "release",
      target: "evaluation",
      label: "simulated eval",
    },
  ];
  return { nodes, edges };
}
