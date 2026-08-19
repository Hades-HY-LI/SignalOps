"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useSyncExternalStore } from "react";
import { correctedRecords, createInitialState, defectiveRecords, DEMO_NOW } from "./fixtures";
import { buildDatasetManifest, getReleaseEligibility, runQualityGates, submitInternalAnnotation } from "./domain";
import type { AnnotationDecision, ProductSignal, ScenarioState, VocalLabel } from "./types";

const STORAGE_KEY = "signalops-scenario-v1";

type Action =
  | { type: "HYDRATE"; state: ScenarioState }
  | { type: "ALIGN_REQUIREMENTS" }
  | { type: "CAPTURE_SIGNAL"; kind: "explicit" | "implicit" }
  | { type: "ACTIVATE_SOURCES" }
  | { type: "RUN_QA" }
  | { type: "REVIEW_VENDOR"; recordId: string; action: "accept" | "reject" | "override"; rationale: string; label?: VocalLabel }
  | { type: "REQUEST_REMEDIATION" }
  | { type: "LOAD_CORRECTED" }
  | { type: "COMPLETE_INTERNAL"; taskId: string; label: VocalLabel; confidence: number; notes: string }
  | { type: "RESOLVE_INTERNAL"; taskId: string; label: Exclude<VocalLabel, "uncertain">; rationale: string }
  | { type: "BUILD_RELEASE" }
  | { type: "PROMOTE"; rationale: string }
  | { type: "HOLD"; rationale: string }
  | { type: "RESET" };

function audit(state: ScenarioState, action: string, detail: string, actor = "Maya Chen") {
  return [...state.audit, { id: `audit-${state.audit.length + 1}`, action, detail, actor, createdAt: DEMO_NOW }];
}

export function scenarioReducer(state: ScenarioState, action: Action): ScenarioState {
  switch (action.type) {
    case "HYDRATE":
      return isScenarioState(action.state) ? action.state : state;
    case "ALIGN_REQUIREMENTS":
      if (state.release || state.program.stage !== "signal_detected") return state;
      return {
        ...state,
        program: { ...state.program, stage: "requirements_aligned" },
        artifacts: state.artifacts.map((artifact) => ({ ...artifact, version: state.program.requirementVersion, status: "aligned" })),
        audit: audit(state, "Requirements aligned", "Downstream artifacts advanced to requirement v3."),
      };
    case "CAPTURE_SIGNAL": {
      if (state.release) return state;
      const signal: ProductSignal = {
        id: `signal-${state.productSignals.length + 1}`,
        kind: action.kind,
        label: action.kind === "explicit" ? "Unexpected vocals reported" : "Regenerated after short listen",
        confidence: action.kind === "explicit" ? 0.96 : 0.42,
        slice: "ambient-en",
        createdAt: DEMO_NOW,
        simulated: true,
      };
      return { ...state, productSignals: [...state.productSignals, signal], audit: audit(state, "Product signal captured", `${signal.kind} signal normalized at ${Math.round(signal.confidence * 100)}% confidence.`, "Product simulator") };
    }
    case "ACTIVATE_SOURCES":
      if (state.release || state.program.stage !== "requirements_aligned") return state;
      return { ...state, program: { ...state.program, stage: "sources_active" }, audit: audit(state, "Sources activated", "Vendor, internal, and product collection paths opened.") };
    case "RUN_QA": {
      if (state.release || !["sources_active", "qa_blocked", "corrected_received"].includes(state.program.stage)) return state;
      const records = state.activeDelivery === "corrected" ? correctedRecords : defectiveRecords;
      const qaReport = runQualityGates(records, state.workflow);
      return { ...state, qaReport, program: { ...state.program, stage: qaReport.passed ? "corrected_received" : "qa_blocked" }, audit: audit(state, qaReport.passed ? "Quality gates passed" : "Delivery blocked", qaReport.passed ? "Corrected delivery passed all critical gates." : `${qaReport.gates.filter((gate) => !gate.passed).length} critical gates failed.`, "Quality engine") };
    }
    case "REVIEW_VENDOR": {
      if (state.release || !action.rationale.trim()) return state;
      const activeRecords = state.activeDelivery === "corrected" ? correctedRecords : defectiveRecords;
      const record = activeRecords.find((item) => item.id === action.recordId);
      if (!record) return state;
      const decision: AnnotationDecision = { recordId: action.recordId, assetId: record.assetId, action: action.action, rationale: action.rationale, reviewer: "Maya Chen", label: action.label, createdAt: DEMO_NOW };
      return { ...state, vendorDecisions: { ...state.vendorDecisions, [action.recordId]: decision }, audit: audit(state, "Vendor exception reviewed", `${action.recordId} marked ${action.action}.`) };
    }
    case "REQUEST_REMEDIATION":
      if (state.release || state.program.stage !== "qa_blocked" || !state.qaReport || state.qaReport.passed || Object.keys(state.vendorDecisions).length === 0) return state;
      return {
        ...state,
        program: { ...state.program, stage: "remediation_requested" },
        remediation: { id: "remediation-northstar-1", vendorId: "northstar", defectCategories: state.qaReport.gates.filter((gate) => !gate.passed).map((gate) => gate.label), actions: ["Correct malformed records", "Replace duplicate assets", "Revalidate provenance", "Recalibrate against rubric v3", "Backfill classical-es slice"], retestSize: 48, status: "sent" },
        audit: audit(state, "Remediation sent", "Northstar received a five-part corrective action plan."),
      };
    case "LOAD_CORRECTED":
      if (state.release || !state.remediation || state.program.stage !== "remediation_requested") return state;
      return { ...state, activeDelivery: "corrected", qaReport: null, program: { ...state.program, stage: "corrected_received" }, audit: audit(state, "Corrected delivery received", "Northstar resubmitted 48 normalized records.", "Northstar Audio Data") };
    case "COMPLETE_INTERNAL": {
      if (state.release || !action.notes.trim() || ["signal_detected", "requirements_aligned"].includes(state.program.stage)) return state;
      const tasks = state.internalTasks.map((task) => task.id === action.taskId ? submitInternalAnnotation(task, { recordId: task.recordId, assetId: task.assetId, action: action.label === task.referenceAnswer ? "accept" : "override", rationale: action.notes, reviewer: task.assignedTo, label: action.label, confidence: action.confidence, createdAt: DEMO_NOW }) : task);
      const allComplete = tasks.every((task) => task.status === "complete");
      return { ...state, internalTasks: tasks, program: { ...state.program, stage: allComplete && state.qaReport?.passed ? "internal_review_complete" : state.program.stage }, audit: audit(state, "Internal annotation completed", `${action.taskId} reviewed at ${Math.round(action.confidence * 100)}% confidence.`, tasks.find((task) => task.id === action.taskId)?.assignedTo) };
    }
    case "RESOLVE_INTERNAL": {
      if (state.release || !action.rationale.trim()) return state;
      const task = state.internalTasks.find((item) => item.id === action.taskId);
      if (!task || task.status !== "adjudication_required") return state;
      const tasks = state.internalTasks.map((item) => item.id === task.id ? { ...item, status: "complete" as const, decision: { recordId: item.recordId, assetId: item.assetId, action: "override" as const, rationale: action.rationale, reviewer: state.program.owner, label: action.label, confidence: 1, createdAt: DEMO_NOW } } : item);
      const allComplete = tasks.every((item) => item.status === "complete");
      return { ...state, internalTasks: tasks, program: { ...state.program, stage: allComplete && state.qaReport?.passed ? "internal_review_complete" : state.program.stage }, audit: audit(state, "Internal adjudication resolved", `${task.id} resolved as ${action.label.replaceAll("_", " ")}.`) };
    }
    case "BUILD_RELEASE": {
      if (!getReleaseEligibility(state).eligible) return state;
      const release = buildDatasetManifest(state);
      return { ...state, release, program: { ...state.program, stage: "release_ready" }, audit: audit(state, "Dataset release created", `${release.version} contains ${release.includedRecordIds.length} traceable records.`) };
    }
    case "PROMOTE":
      if (state.program.stage !== "release_ready" || !state.release || state.release.decision !== "candidate" || !state.qaReport?.passed || !state.internalTasks.every((task) => task.status === "complete") || !action.rationale.trim()) return state;
      return { ...state, release: { ...state.release, decision: "promoted", rationale: action.rationale }, program: { ...state.program, stage: "promoted" }, audit: audit(state, "Dataset promoted", action.rationale) };
    case "HOLD":
      if (state.program.stage !== "release_ready" || !state.release || state.release.decision !== "candidate" || !action.rationale.trim()) return state;
      return { ...state, release: { ...state.release, decision: "held", rationale: action.rationale }, program: { ...state.program, stage: "held" }, audit: audit(state, "Dataset held", action.rationale) };
    case "RESET":
      return createInitialState();
    default:
      return state;
  }
}

interface ScenarioContextValue {
  state: ScenarioState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

const subscribeToHydration = () => () => undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => typeof value[field] === "string");
}

function hasNumbers(value: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDecision(value: unknown) {
  if (!isRecord(value)) return false;
  return hasStrings(value, ["recordId", "assetId", "action", "rationale", "reviewer", "createdAt"])
    && (value.label === undefined || typeof value.label === "string")
    && (value.confidence === undefined || typeof value.confidence === "number");
}

export function isScenarioState(value: unknown): value is ScenarioState {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  const state = value;
  if (!isRecord(state.program)
    || !hasStrings(state.program, ["id", "name", "summary", "owner", "researchOwner", "productOwner", "requirementVersion", "rubricVersion", "deadline", "stage"])
    || !hasNumbers(state.program, ["baseline", "target", "guardrail"])) return false;
  if (!Array.isArray(state.artifacts) || !state.artifacts.every((item) => isRecord(item) && hasStrings(item, ["id", "name", "version", "owner", "status"]))) return false;
  if (!Array.isArray(state.sourcePlan) || !state.sourcePlan.every((item) => isRecord(item) && hasStrings(item, ["source", "confidence", "turnaround"]) && hasNumbers(item, ["targetRecords", "share", "estimatedCost"]))) return false;
  if (!isRecord(state.workflow)
    || !hasStrings(state.workflow, ["id", "name", "version", "type", "status", "rubricVersion", "humanReviewRule", "description"])
    || !hasNumbers(state.workflow, ["goldAccuracyThreshold", "minSliceRecords", "maxDisagreement"])
    || !isStringArray(state.workflow.inputFields) || !isStringArray(state.workflow.outputFields) || !isStringArray(state.workflow.requiredSlices)) return false;
  if (!Array.isArray(state.productSignals) || !state.productSignals.every((item) => isRecord(item) && hasStrings(item, ["id", "kind", "label", "slice", "createdAt"]) && hasNumbers(item, ["confidence"]))) return false;
  if (!Array.isArray(state.vendors) || !state.vendors.every((item) => isRecord(item)
    && hasStrings(item, ["id", "name", "specialty"])
    && hasNumbers(item, ["rate", "weeklyCapacity"])
    && isRecord(item.metrics)
    && hasNumbers(item.metrics, ["quality", "reliability", "costEfficiency", "throughput", "expertise", "responsiveness", "improvement"])
    && Array.isArray(item.history)
    && item.history.every((point) => isRecord(point) && hasStrings(point, ["period"]) && hasNumbers(point, ["quality"])))) return false;
  if (state.activeDelivery !== "defective" && state.activeDelivery !== "corrected") return false;
  if (!isRecord(state.vendorDecisions) || !Object.values(state.vendorDecisions).every(isDecision)) return false;
  if (!Array.isArray(state.internalTasks) || !state.internalTasks.every((item) => isRecord(item)
    && hasStrings(item, ["id", "recordId", "assetId", "prompt", "genre", "assignedTo", "requirementVersion", "rubricVersion", "referenceAnswer", "status"])
    && typeof item.calibration === "boolean"
    && (item.decision === undefined || isDecision(item.decision)))) return false;
  if (state.qaReport !== null && (!isRecord(state.qaReport)
    || !hasStrings(state.qaReport, ["delivery", "generatedAt"])
    || !hasNumbers(state.qaReport, ["acceptedCount", "blockedCount"])
    || typeof state.qaReport.passed !== "boolean"
    || !Array.isArray(state.qaReport.gates)
    || !state.qaReport.gates.every((gate) => isRecord(gate) && hasStrings(gate, ["id", "label", "displayValue", "threshold"]) && hasNumbers(gate, ["value"]) && typeof gate.passed === "boolean" && typeof gate.critical === "boolean" && isStringArray(gate.recordIds)))) return false;
  if (state.remediation !== null && (!isRecord(state.remediation) || !hasStrings(state.remediation, ["id", "vendorId", "status"]) || !hasNumbers(state.remediation, ["retestSize"]) || !isStringArray(state.remediation.defectCategories) || !isStringArray(state.remediation.actions))) return false;
  if (state.release !== null && (!isRecord(state.release)
    || !hasStrings(state.release, ["id", "version", "requirementVersion", "rubricVersion", "workflowVersion", "adapterVersion", "deliveryVersion", "createdAt", "decision"])
    || !isStringArray(state.release.includedRecordIds) || !isStringArray(state.release.excludedRecordIds)
    || !isRecord(state.release.counts) || !hasNumbers(state.release.counts, ["product", "vendor", "internal"])
    || !Array.isArray(state.release.lineage)
    || !state.release.lineage.every((item) => isRecord(item) && hasStrings(item, ["recordId", "source", "originId", "requirementVersion", "rubricVersion", "workflowVersion"]) && (item.decision === undefined || isDecision(item.decision))))) return false;
  return Array.isArray(state.audit) && state.audit.every((item) => isRecord(item) && hasStrings(item, ["id", "action", "detail", "actor", "createdAt"]));
}

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(scenarioReducer, undefined, createInitialState);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (isScenarioState(parsed)) dispatch({ type: "HYDRATE", state: parsed });
        else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createInitialState()));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const value = useMemo(() => ({ state, dispatch, hydrated }), [state, hydrated]);
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const context = useContext(ScenarioContext);
  if (!context) throw new Error("useScenario must be used within ScenarioProvider");
  return context;
}
