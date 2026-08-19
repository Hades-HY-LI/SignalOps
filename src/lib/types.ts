export type ProgramStage =
  | "signal_detected"
  | "requirements_aligned"
  | "sources_active"
  | "qa_blocked"
  | "remediation_requested"
  | "corrected_received"
  | "internal_review_complete"
  | "release_ready"
  | "promoted"
  | "held";

export type NodeStatus = "pending" | "active" | "blocked" | "complete" | "simulated";
export type SourceType = "product" | "vendor" | "internal";

export interface DataProgram {
  id: string;
  name: string;
  summary: string;
  owner: string;
  researchOwner: string;
  productOwner: string;
  requirementVersion: string;
  rubricVersion: string;
  baseline: number;
  target: number;
  guardrail: number;
  deadline: string;
  stage: ProgramStage;
}

export interface ProductSignal {
  id: string;
  kind: "explicit" | "implicit";
  label: string;
  confidence: number;
  slice: string;
  createdAt: string;
  simulated: true;
}

export interface RequirementArtifact {
  id: string;
  name: string;
  version: string;
  owner: string;
  status: "aligned" | "stale";
}

export interface SourcePlanItem {
  source: SourceType;
  targetRecords: number;
  share: number;
  estimatedCost: number;
  confidence: "high" | "medium" | "low";
  turnaround: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  type: "rubric-classification" | "pairwise" | "qa" | "ranking" | "agent-review" | "product-feedback";
  status: "executable" | "template";
  inputFields: string[];
  outputFields: string[];
  goldAccuracyThreshold: number;
  rubricVersion: string;
  requiredSlices: string[];
  minSliceRecords: number;
  maxDisagreement: number;
  humanReviewRule: string;
  description: string;
  agentConfig?: {
    model: string;
    promptVersion: string;
    confidenceThreshold: number;
    knownFailures: string[];
  };
}

export interface VendorMetrics {
  quality: number;
  reliability: number;
  costEfficiency: number;
  throughput: number;
  expertise: number;
  responsiveness: number;
  improvement: number;
}

export interface VendorProfile {
  id: string;
  name: string;
  specialty: string;
  rate: number;
  weeklyCapacity: number;
  metrics: VendorMetrics;
  history: Array<{ period: string; quality: number }>;
}

export interface VendorWorkPackage {
  id: string;
  programId: string;
  vendorId: string;
  requirementVersion: string;
  rubricVersion: string;
  workflowVersion: string;
  targetRecords: number;
  acceptance: {
    schemaValidity: number;
    provenance: number;
    maxDuplicates: number;
    goldAccuracy: number;
    minSliceRecords: number;
    maxDisagreement: number;
  };
  schema: { input: string[]; output: string[] };
}

export type VocalLabel = "vocals_present" | "instrumental" | "uncertain";

export interface DeliveryRecord {
  id: string;
  assetId: string;
  prompt: string;
  locale: string;
  genre: string;
  requestedInstrumental: boolean;
  label?: VocalLabel;
  peerLabel: VocalLabel;
  confidence: number;
  annotatorId: string;
  rubricVersion: string;
  provenanceValid: boolean;
  goldAnswer?: VocalLabel;
  ambiguous: boolean;
  source: "vendor";
  simulated: true;
}

export interface AnnotationDecision {
  recordId: string;
  assetId: string;
  action: "accept" | "reject" | "override";
  rationale: string;
  reviewer: string;
  label?: VocalLabel;
  confidence?: number;
  createdAt: string;
}

export interface InternalAnnotationTask {
  id: string;
  recordId: string;
  assetId: string;
  prompt: string;
  genre: string;
  assignedTo: string;
  requirementVersion: string;
  rubricVersion: string;
  referenceAnswer: VocalLabel;
  status: "pending" | "adjudication_required" | "complete";
  decision?: AnnotationDecision;
  calibration: boolean;
}

export interface QAGateResult {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  threshold: string;
  passed: boolean;
  critical: boolean;
  recordIds: string[];
  subjects?: string[];
}

export interface QAReport {
  delivery: "defective" | "corrected";
  passed: boolean;
  gates: QAGateResult[];
  acceptedCount: number;
  blockedCount: number;
  generatedAt: string;
}

export interface RemediationPlan {
  id: string;
  vendorId: string;
  defectCategories: string[];
  actions: string[];
  retestSize: number;
  status: "draft" | "sent";
}

export interface DatasetRelease {
  id: string;
  version: string;
  requirementVersion: string;
  rubricVersion: string;
  workflowVersion: string;
  adapterVersion: string;
  deliveryVersion: "corrected";
  createdAt: string;
  counts: Record<SourceType, number>;
  includedRecordIds: string[];
  excludedRecordIds: string[];
  lineage: Array<{
    recordId: string;
    source: SourceType;
    originId: string;
    requirementVersion: string;
    rubricVersion: string;
    workflowVersion: string;
    decision?: AnnotationDecision;
  }>;
  decision: "candidate" | "promoted" | "held";
  rationale?: string;
}

export interface EvaluationResult {
  metric: string;
  baseline: number;
  candidate: number;
  threshold: number;
  guardrail: boolean;
  simulated: true;
}

export interface AuditEvent {
  id: string;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
}

export interface ScenarioState {
  schemaVersion: 1;
  program: DataProgram;
  artifacts: RequirementArtifact[];
  sourcePlan: SourcePlanItem[];
  workflow: WorkflowDefinition;
  productSignals: ProductSignal[];
  vendors: VendorProfile[];
  activeDelivery: "defective" | "corrected";
  vendorDecisions: Record<string, AnnotationDecision>;
  internalTasks: InternalAnnotationTask[];
  qaReport: QAReport | null;
  remediation: RemediationPlan | null;
  release: DatasetRelease | null;
  audit: AuditEvent[];
}

export interface LineageNode {
  id: string;
  label: string;
  detail: string;
  status: NodeStatus;
  count?: number;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}
