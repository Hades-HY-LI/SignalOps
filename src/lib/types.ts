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

export type NodeStatus =
  | "pending"
  | "active"
  | "blocked"
  | "complete"
  | "simulated";
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
  status: "pending" | "aligned" | "stale";
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
  type:
    | "rubric-classification"
    | "pairwise"
    | "qa"
    | "ranking"
    | "agent-review"
    | "product-feedback";
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
  scaling: number;
}

export interface VendorProfile {
  id: string;
  name: string;
  specialty: string;
  rate: number;
  weeklyCapacity: number;
  metrics: VendorMetrics;
  history: Array<{ period: string; quality: number }>;
  capabilities?: VendorCapability[];
  modalities?: string[];
  locales?: string[];
  availability?: "available" | "limited" | "unavailable";
  utilization?: number;
  rateBand?: "budget" | "standard" | "premium";
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
  projectId?: string;
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

export type ProjectHealth = "healthy" | "at_risk" | "blocked";
export type ProjectPortfolioStage =
  | "planning"
  | "collecting"
  | "quality_review"
  | "release_ready"
  | "promoted"
  | "held";
export type EvaluationStatus =
  | "not_requested"
  | "requested"
  | "accepted"
  | "running"
  | "results_submitted"
  | "decision_ready";
export type VendorCapability =
  | "vocals"
  | "music_preference"
  | "instrumental_sound"
  | "speech"
  | "sound_effects"
  | "multilingual"
  | "expert_review"
  | "ranking"
  | "ai_agent_review";

export interface Project {
  id: string;
  name: string;
  summary: string;
  owner: string;
  researchOwner: string;
  productOwner: string;
  health: ProjectHealth;
  stage: ProjectPortfolioStage;
  modality: string;
  deadline: string;
  budget: number;
  targetVolume: number;
  recordVolume: number;
  blockers: string[];
  nextDecision: string;
  releaseReadiness: number;
  evaluationStatus: EvaluationStatus;
  createdAt: string;
  simulated: boolean;
}

export type PortfolioWidgetId =
  | "project_health"
  | "deadlines"
  | "budgets"
  | "capacity"
  | "blockers"
  | "source_mix";
export type ProjectWidgetId =
  | "target_metric"
  | "release_readiness"
  | "source_status"
  | "quality_status"
  | "blockers"
  | "owners";

export interface DashboardWidget {
  id: PortfolioWidgetId | ProjectWidgetId;
  visible: boolean;
}

export interface MissionControlConfig {
  preset:
    | "executive"
    | "operations"
    | "delivery_health"
    | "source_operations"
    | "release_readiness";
  widgets: DashboardWidget[];
}

export interface RequirementDraft {
  targetBehavior: string;
  scope: string;
  slices: string[];
  exclusions: string[];
  thresholds: {
    goldAccuracy: number;
    maxDisagreement: number;
    minimumSliceRecords: number;
  };
  owner: string;
  dueDate: string;
}

export interface RequirementVersion extends RequirementDraft {
  version: string;
  publishedAt: string;
  publishedBy: string;
  changeReason: string;
  changedFields: string[];
}

export interface RequirementAttachment {
  id: string;
  name: string;
  mimeType:
    | "text/markdown"
    | "text/plain"
    | "application/json"
    | "application/pdf";
  size: number;
  storageKey: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Reminder {
  id: string;
  recipient: string;
  dueDate: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  simulated: true;
}

export interface RequirementDocument {
  id: string;
  projectId: string;
  title: string;
  currentVersion: string;
  draft: RequirementDraft;
  versions: RequirementVersion[];
  attachments: RequirementAttachment[];
  reminders: Reminder[];
}

export interface VendorEngagement {
  id: string;
  projectId: string;
  vendorId: string;
  status: "planned" | "pilot" | "production" | "paused" | "stale";
  requirementVersion: string;
  workPackageVersion: string;
  createdAt: string;
}

export interface VendorPilot {
  id: string;
  projectId: string;
  vendorId: string;
  version: string;
  workPackageVersion: string;
  taskCount: number;
  unitCost: number;
  totalCost: number;
  startDate: string;
  endDate: string;
  turnaroundHours: number;
  throughputPerDay: number;
  quality: number;
  goldAccuracy: number;
  remediationCount: number;
  decision: "proceed" | "hold" | "pending";
}

export interface InternalWorkBatch {
  id: string;
  projectId: string;
  name: string;
  team: string;
  status: "planned" | "in_progress" | "completed" | "qa_failed";
  totalTasks: number;
  completedTasks: number;
  requirementVersion: string;
  createdAt: string;
  updatedAt: string;
  aggregateQA?: number;
}

export interface InternalOpsSnapshot {
  id: string;
  projectId: string;
  capturedAt: string;
  backlog: number;
  completedTasks: number;
  dailyThroughput: number;
  medianCycleHours: number;
  slaAttainment: number;
  calibrationAgreement: number;
  escalationRate: number;
  qcFailureRate: number;
  availableCapacity: number;
  teamAllocation: Array<{ team: string; tasks: number }>;
  defectTaxonomy: Array<{ label: string; count: number }>;
  simulated: true;
}

export interface ProjectWorkflowStage {
  id: string;
  projectId: string;
  name: string;
  owner: string;
  version: string;
  status: "pending" | "active" | "blocked" | "complete" | "stale";
  entryCriteria: string[];
  exitCriteria: string[];
  dependencies: string[];
  linkedArtifactIds: string[];
}

export interface DatasetVersion {
  id: string;
  projectId: string;
  name: string;
  owner: string;
  version: string;
  sources: SourceType[];
  sourceCounts: Record<SourceType, number>;
  recordCount: number;
  requirementVersion: string;
  qaStatus: "pending" | "passed" | "failed";
  releaseState: "draft" | "candidate" | "promoted" | "held";
  evaluationStatus: EvaluationStatus;
  latestDecision: string;
  manifest: DatasetRelease | null;
  exclusions: string[];
  downloadHistory: Array<{ format: "json" | "csv"; downloadedAt: string }>;
  createdAt: string;
}

export interface EvaluationMetricResult {
  metric: string;
  value: number;
  threshold: number;
  operator: "gte" | "lte";
  guardrail: boolean;
  passed: boolean;
  notes?: string;
}

export interface EvaluationHandoff {
  id: string;
  projectId: string;
  datasetId: string;
  owners: Array<"research" | "ml">;
  targetMetrics: string[];
  guardrails: string[];
  slices: string[];
  dueDate: string;
  method: string;
  decisionRequest: string;
  status: Exclude<EvaluationStatus, "not_requested">;
  delivery: "download" | "simulated_connector";
  results: EvaluationMetricResult[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type RegistryEntryKind =
  | "workflow"
  | "annotation_platform"
  | "api"
  | "webhook"
  | "object_storage"
  | "product_event";

export interface RegistryEntry {
  id: string;
  name: string;
  kind: RegistryEntryKind;
  version: string;
  status: "executable" | "template" | "connected" | "simulated";
  capabilities: string[];
  assignedProjectIds: string[];
  description: string;
}

export interface ProjectState {
  projectId: string;
  missionConfig: MissionControlConfig;
  requirements: RequirementDocument;
  sourcePlan: SourcePlanItem[];
  sourcePlanStatus: "pending" | "aligned" | "stale";
  vendorEngagements: VendorEngagement[];
  internalWorkBatches: InternalWorkBatch[];
  internalOpsSnapshots: InternalOpsSnapshot[];
  workflowStages: ProjectWorkflowStage[];
  scenario: ScenarioState;
  releaseReferences: string[];
  evaluationReferences: string[];
}

export interface WorkspaceState {
  schemaVersion: 2;
  fixtureRevision: 2;
  projects: Project[];
  activeProjectId: string;
  projectStates: Record<string, ProjectState>;
  portfolioConfig: MissionControlConfig;
  vendors: VendorProfile[];
  vendorPilots: VendorPilot[];
  datasets: DatasetVersion[];
  evaluationHandoffs: EvaluationHandoff[];
  registryEntries: RegistryEntry[];
  audit: AuditEvent[];
}
