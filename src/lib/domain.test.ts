import { describe, expect, it } from "vitest";
import {
  buildDatasetManifest,
  buildLineageGraph,
  canPromote,
  checkRequirementAlignment,
  exportWorkPackage,
  normalizeVendorDelivery,
  recommendAllocation,
  runQualityGates,
  scoreVendor,
  submitInternalAnnotation,
} from "./domain";
import {
  correctedRecords,
  createInitialState,
  defectiveRecords,
  program,
  vendors,
  workflow,
} from "./fixtures";

describe("vendor adapter", () => {
  it("exports a versioned canonical work package", () => {
    const workPackage = exportWorkPackage(program, workflow, vendors[0]);
    expect(workPackage.requirementVersion).toBe("v3");
    expect(workPackage.schema.output).toContain("label");
    expect(workPackage.acceptance.goldAccuracy).toBe(0.92);
  });

  it("normalizes arrays and rejects invalid payloads", () => {
    expect(normalizeVendorDelivery(correctedRecords)).toHaveLength(48);
    expect(() => normalizeVendorDelivery({ records: [] })).toThrow("must be an array");
  });
});

describe("quality gates", () => {
  it("blocks the defective delivery with traceable failures", () => {
    const report = runQualityGates(defectiveRecords, workflow);
    expect(report.passed).toBe(false);
    expect(report.gates.filter((gate) => !gate.passed).map((gate) => gate.id)).toEqual(
      expect.arrayContaining(["schema", "duplicates", "provenance", "gold", "coverage", "rubric", "agreement"]),
    );
    expect(report.blockedCount).toBeGreaterThanOrEqual(8);
  });

  it("passes the corrected delivery", () => {
    const report = runQualityGates(correctedRecords, workflow);
    expect(report.passed).toBe(true);
    expect(report.gates.every((gate) => gate.passed)).toBe(true);
  });
});

describe("requirements and sourcing", () => {
  it("detects stale downstream artifacts", () => {
    const state = createInitialState();
    const checked = checkRequirementAlignment(state.artifacts, "v3");
    expect(checked.filter((artifact) => artifact.status === "stale")).toHaveLength(2);
  });

  it("scores vendors and produces evidence-based recommendations", () => {
    expect(scoreVendor(vendors[0].metrics)).toBeGreaterThan(90);
    const recommendations = recommendAllocation(vendors);
    expect(recommendations.find((item) => item.vendorId === "northstar")?.recommendation).toBe("expand");
    expect(recommendations.find((item) => item.vendorId === "tempo")?.recommendation).toBe("pause");
  });
});

describe("human review and release", () => {
  it("requires a rationale for internal annotation", () => {
    const task = createInitialState().internalTasks[0];
    expect(() => submitInternalAnnotation(task, {
      recordId: task.recordId,
      assetId: task.assetId,
      action: "accept",
      rationale: "",
      reviewer: task.assignedTo,
      createdAt: "2026-08-18T16:00:00.000Z",
    })).toThrow("rationale");
  });

  it("builds a cross-source manifest", () => {
    const state = createInitialState();
    state.activeDelivery = "corrected";
    state.qaReport = runQualityGates(correctedRecords, workflow);
    state.internalTasks = state.internalTasks.map((task) => ({ ...task, status: "complete" }));
    const manifest = buildDatasetManifest(state);
    expect(manifest.counts.vendor).toBe(48);
    expect(manifest.counts.internal).toBe(7);
    expect(manifest.counts.product).toBe(1);
    expect(manifest.lineage).toHaveLength(56);
    expect(manifest.lineage.find((item) => item.source === "internal")?.originId).toBeTruthy();
    expect(manifest.lineage.find((item) => item.source === "vendor")?.recordId).toMatch(/^asset-/);
    expect(manifest.lineage.filter((item) => item.source === "internal").every((item) => item.recordId.startsWith("internal-asset-"))).toBe(true);
    expect(new Set(manifest.includedRecordIds).size).toBe(manifest.includedRecordIds.length);
  });

  it("blocks promotion until QA, internal review, and release are complete", () => {
    const state = createInitialState();
    expect(canPromote(state)).toBe(false);
    state.activeDelivery = "corrected";
    state.qaReport = runQualityGates(correctedRecords, workflow);
    state.internalTasks = state.internalTasks.map((task) => ({ ...task, status: "complete" }));
    state.release = buildDatasetManifest(state);
    expect(canPromote(state)).toBe(true);
  });
});

describe("lineage", () => {
  it("reflects blocked and promoted scenario state", () => {
    const state = createInitialState();
    state.qaReport = runQualityGates(defectiveRecords, workflow);
    let graph = buildLineageGraph(state);
    expect(graph.nodes.find((node) => node.id === "qa")?.status).toBe("blocked");

    state.activeDelivery = "corrected";
    state.qaReport = runQualityGates(correctedRecords, workflow);
    state.internalTasks = state.internalTasks.map((task) => ({ ...task, status: "complete" }));
    state.release = buildDatasetManifest(state);
    state.program.stage = "promoted";
    graph = buildLineageGraph(state);
    expect(graph.nodes.find((node) => node.id === "evaluation")?.status).toBe("complete");
  });
});
