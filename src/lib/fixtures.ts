import type {
  DataProgram,
  DeliveryRecord,
  EvaluationResult,
  InternalAnnotationTask,
  ProductSignal,
  RequirementArtifact,
  ScenarioState,
  SourcePlanItem,
  VendorProfile,
  VocalLabel,
  WorkflowDefinition,
} from "./types";

export const DEMO_NOW = "2026-08-18T16:00:00.000Z";

export const program: DataProgram = {
  id: "program-unexpected-vocals",
  name: "Unexpected Vocals",
  summary: "Reduce vocal leakage when creators request instrumental music.",
  owner: "Maya Chen",
  researchOwner: "Eli Morgan",
  productOwner: "Nora Singh",
  requirementVersion: "v3",
  rubricVersion: "rubric-v3",
  baseline: 12.8,
  target: 6,
  guardrail: 72,
  deadline: "Aug 23",
  stage: "signal_detected",
};

export const artifacts: RequirementArtifact[] = [
  { id: "request", name: "Data request", version: "v3", owner: "Research", status: "aligned" },
  { id: "work-order", name: "Vendor work order", version: "v2", owner: "Data Ops", status: "stale" },
  { id: "guideline", name: "Annotation guideline", version: "v2", owner: "Data Ops", status: "stale" },
  { id: "gold-set", name: "Gold set", version: "v3", owner: "Research", status: "aligned" },
];

export const sourcePlan: SourcePlanItem[] = [
  { source: "vendor", targetRecords: 2400, share: 60, estimatedCost: 1152, confidence: "medium", turnaround: "4 days" },
  { source: "internal", targetRecords: 400, share: 10, estimatedCost: 880, confidence: "high", turnaround: "3 days" },
  { source: "product", targetRecords: 1200, share: 30, estimatedCost: 120, confidence: "medium", turnaround: "7 days" },
];

export const workflow: WorkflowDefinition = {
  id: "workflow-rubric-classification",
  name: "Rubric classification",
  version: "workflow-v3",
  type: "rubric-classification",
  status: "executable",
  inputFields: ["asset_id", "prompt", "locale", "genre", "requested_instrumental"],
  outputFields: ["label", "confidence", "annotator_id", "rubric_version"],
  goldAccuracyThreshold: 0.92,
  rubricVersion: "rubric-v3",
  requiredSlices: ["ambient-en", "electronic-en", "classical-es"],
  minSliceRecords: 2,
  maxDisagreement: 0.15,
  humanReviewRule: "Route uncertainty or confidence below 0.70 to an internal expert.",
  description: "Determine whether a generated clip contains audible vocals using a versioned rubric.",
};

export const workflowTemplates: WorkflowDefinition[] = [
  workflow,
  { ...workflow, id: "workflow-pairwise", name: "Pairwise comparison", type: "pairwise", status: "template", description: "Compare two outputs for vocal naturalness and preference." },
  { ...workflow, id: "workflow-qa", name: "Expert Q&A", type: "qa", status: "template", description: "Capture structured expert explanations for complex defects." },
  { ...workflow, id: "workflow-ranking", name: "Multi-output ranking", type: "ranking", status: "template", description: "Rank multiple generations by prompt adherence." },
  { ...workflow, id: "workflow-agent", name: "AI agent review", type: "agent-review", status: "template", description: "Pre-screen records and route uncertain or high-risk outputs to people.", agentConfig: { model: "classifier-demo-v2", promptVersion: "agent-prompt-v4", confidenceThreshold: 0.86, knownFailures: ["vocal-like instruments", "non-English phonemes", "dense mixes"] } },
  { ...workflow, id: "workflow-product", name: "In-product preference", type: "product-feedback", status: "template", description: "Normalize explicit and implicit product feedback into candidates." },
];

export const vendors: VendorProfile[] = [
  {
    id: "northstar",
    name: "Northstar Audio Data",
    specialty: "Music perception",
    rate: 0.48,
    weeklyCapacity: 12000,
    metrics: { quality: 94, reliability: 93, costEfficiency: 82, throughput: 88, expertise: 96, responsiveness: 91, improvement: 95 },
    history: [{ period: "W1", quality: 86 }, { period: "W2", quality: 89 }, { period: "W3", quality: 92 }, { period: "W4", quality: 94 }],
  },
  {
    id: "tempo",
    name: "TempoLabel",
    specialty: "High-volume moderation",
    rate: 0.31,
    weeklyCapacity: 26000,
    metrics: { quality: 79, reliability: 84, costEfficiency: 95, throughput: 96, expertise: 70, responsiveness: 76, improvement: 58 },
    history: [{ period: "W1", quality: 87 }, { period: "W2", quality: 85 }, { period: "W3", quality: 82 }, { period: "W4", quality: 79 }],
  },
  {
    id: "aural",
    name: "Aural IQ",
    specialty: "Expert audio review",
    rate: 0.72,
    weeklyCapacity: 6000,
    metrics: { quality: 97, reliability: 96, costEfficiency: 64, throughput: 66, expertise: 98, responsiveness: 93, improvement: 82 },
    history: [{ period: "W1", quality: 95 }, { period: "W2", quality: 95 }, { period: "W3", quality: 96 }, { period: "W4", quality: 97 }],
  },
];

const genres = ["ambient", "electronic", "classical", "jazz", "cinematic", "lo-fi"];

function labelFor(index: number): VocalLabel {
  return index % 5 === 0 ? "vocals_present" : "instrumental";
}

export function makeDeliveryRecords(corrected = false): DeliveryRecord[] {
  return Array.from({ length: 48 }, (_, index) => {
    let locale = corrected && index >= 44 ? "es" : index % 4 === 0 ? "es" : "en";
    const genre = corrected && index >= 44 ? "classical" : genres[index % genres.length];
    if (!corrected && genre === "classical" && locale === "es") locale = "en";
    const goldAnswer = index < 10 ? labelFor(index) : undefined;
    const wrongGold = !corrected && (index === 5 || index === 6);
    const normalLabel = goldAnswer ?? labelFor(index);

    return {
      id: `${corrected ? "corrected" : "delivery"}-${String(index + 1).padStart(3, "0")}`,
      assetId: !corrected && index === 1 ? "asset-001" : `asset-${String(index + 1).padStart(3, "0")}`,
      prompt: !corrected && (index === 2 || index === 3) ? "" : `${genre} instrumental study ${index + 1}`,
      locale,
      genre,
      requestedInstrumental: true,
      label: !corrected && index === 3 ? undefined : wrongGold ? (normalLabel === "instrumental" ? "vocals_present" : "instrumental") : normalLabel,
      peerLabel: (!corrected && index >= 8 && index <= 15) || (corrected && index >= 8 && index <= 10)
        ? (normalLabel === "instrumental" ? "vocals_present" : "instrumental")
        : normalLabel,
      confidence: index >= 8 && index <= 10 ? 0.58 + (index - 8) * 0.04 : 0.86 + (index % 8) * 0.01,
      annotatorId: `northstar-${(index % 8) + 1}`,
      rubricVersion: !corrected && index === 11 ? "rubric-v2" : "rubric-v3",
      provenanceValid: corrected || (index !== 4 && index !== 5),
      goldAnswer,
      ambiguous: index >= 8 && index <= 10,
      source: "vendor",
      simulated: true,
    };
  });
}

export const defectiveRecords = makeDeliveryRecords(false);
export const correctedRecords = makeDeliveryRecords(true);

export const internalTasks: InternalAnnotationTask[] = Array.from({ length: 7 }, (_, index) => ({
  id: `internal-task-${index + 1}`,
  recordId: `internal-record-${String(index + 1).padStart(3, "0")}`,
  assetId: `internal-asset-${String(index + 1).padStart(3, "0")}`,
  prompt: defectiveRecords[8 + index].prompt || `Instrumental review ${index + 1}`,
  genre: defectiveRecords[8 + index].genre,
  assignedTo: index < 4 ? "Sam Rivera" : "Jordan Lee",
  requirementVersion: "v3",
  rubricVersion: "rubric-v3",
  referenceAnswer: index % 3 === 0 ? "vocals_present" : "instrumental",
  status: "pending",
  calibration: index < 2,
}));

export const productSignals: ProductSignal[] = [
  { id: "signal-1", kind: "explicit", label: "Unexpected vocals", confidence: 0.96, slice: "ambient-en", createdAt: DEMO_NOW, simulated: true },
  { id: "signal-2", kind: "implicit", label: "Regenerated after short listen", confidence: 0.44, slice: "electronic-en", createdAt: DEMO_NOW, simulated: true },
];

export const evaluationResults: EvaluationResult[] = [
  { metric: "Unexpected vocal rate", baseline: 12.8, candidate: 5.4, threshold: 6, guardrail: false, simulated: true },
  { metric: "Instrumental preference", baseline: 68.2, candidate: 76.9, threshold: 74, guardrail: false, simulated: true },
  { metric: "Overall prompt adherence", baseline: 73.1, candidate: 73.4, threshold: 72, guardrail: true, simulated: true },
];

export function createInitialState(): ScenarioState {
  return {
    schemaVersion: 1,
    program: { ...program },
    artifacts: artifacts.map((artifact) => ({ ...artifact })),
    sourcePlan: sourcePlan.map((item) => ({ ...item })),
    workflow: { ...workflow },
    productSignals: productSignals.map((signal) => ({ ...signal })),
    vendors: vendors.map((vendor) => ({ ...vendor, metrics: { ...vendor.metrics }, history: vendor.history.map((point) => ({ ...point })) })),
    activeDelivery: "defective",
    vendorDecisions: {},
    internalTasks: internalTasks.map((task) => ({ ...task })),
    qaReport: null,
    remediation: null,
    release: null,
    audit: [
      { id: "audit-1", action: "Signal opened", detail: "Unexpected vocals exceeded the 10% review threshold.", actor: "System", createdAt: DEMO_NOW },
    ],
  };
}
