import { describe, expect, it } from "vitest";
import { recommendAllocation, scoreVendor } from "./domain";
import { createInitialState } from "./fixtures";
import type { RequirementAttachment, VendorMetrics } from "./types";
import {
  canPromoteDataset,
  createInitialWorkspaceState,
  internalBatchesReleaseReady,
  isWorkspaceState,
  migrateScenarioV1,
  workspaceReducer,
} from "./workspace";

describe("workspace state and migration", () => {
  it("seeds three isolated projects and deeply validates the workspace", () => {
    const state = createInitialWorkspaceState();
    expect(state.projects).toHaveLength(3);
    expect(Object.keys(state.projectStates)).toEqual(
      expect.arrayContaining([
        "unexpected-vocals",
        "vocal-naturalness",
        "multilingual-prompt-adherence",
      ]),
    );
    expect(isWorkspaceState(state)).toBe(true);
    expect(
      isWorkspaceState({
        ...state,
        projectStates: {
          ...state.projectStates,
          "unexpected-vocals": { projectId: "unexpected-vocals" },
        },
      }),
    ).toBe(false);
    expect(
      isWorkspaceState({
        ...state,
        datasets: [...state.datasets, { ...state.datasets[0] }],
      }),
    ).toBe(false);
    expect(isWorkspaceState({ ...state, datasets: [{ id: "partial" }] })).toBe(
      false,
    );
    expect(
      isWorkspaceState({
        ...state,
        evaluationHandoffs: [{ id: "partial-handoff" }],
      }),
    ).toBe(false);
    const projectState = state.projectStates["unexpected-vocals"];
    expect(
      isWorkspaceState({
        ...state,
        projectStates: {
          ...state.projectStates,
          "unexpected-vocals": {
            ...projectState,
            scenario: { ...projectState.scenario, qaReport: {} },
          },
        },
      }),
    ).toBe(false);
    expect(
      isWorkspaceState({
        ...state,
        projectStates: {
          ...state.projectStates,
          "unexpected-vocals": {
            ...projectState,
            scenario: {
              ...projectState.scenario,
              workflow: { id: "partial-workflow" },
            },
          },
        },
      }),
    ).toBe(false);
  });

  it("migrates the v1 scenario without losing its operational state", () => {
    const legacy = createInitialState();
    legacy.program.stage = "qa_blocked";
    const migrated = migrateScenarioV1(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(
      migrated.projectStates["unexpected-vocals"].scenario.program.stage,
    ).toBe("qa_blocked");
    expect(migrated.projects).toHaveLength(3);
    expect(isWorkspaceState(migrated)).toBe(true);
  });

  it("creates an empty planning project and keeps project drafts isolated", () => {
    let state = createInitialWorkspaceState();
    state = workspaceReducer(state, {
      type: "EDIT_REQUIREMENT_DRAFT",
      projectId: "unexpected-vocals",
      changes: { scope: "Updated project-only scope" },
    });
    expect(
      state.projectStates["vocal-naturalness"].requirements.draft.scope,
    ).not.toBe("Updated project-only scope");
    state = workspaceReducer(state, {
      type: "ADD_PROJECT",
      project: {
        name: "Percussion Artifacts",
        summary: "Inspect transient artifacts.",
        owner: "Rae Cole",
        researchOwner: "Uma West",
        productOwner: "Dev Moss",
        health: "healthy",
        stage: "planning",
        modality: "music",
        deadline: "2026-10-01",
        budget: 1000,
        targetVolume: 500,
        blockers: [],
        nextDecision: "Publish requirement",
      },
    });
    expect(state.projects).toHaveLength(4);
    expect(state.activeProjectId).toBe("percussion-artifacts");
    expect(
      state.projectStates["percussion-artifacts"].scenario.productSignals,
    ).toHaveLength(0);
  });

  it("rejects explicit actions scoped to an unknown project", () => {
    const state = createInitialWorkspaceState();
    const next = workspaceReducer(state, {
      type: "EDIT_REQUIREMENT_DRAFT",
      projectId: "missing-project",
      changes: { scope: "Must not leak" },
    });
    expect(next).toBe(state);
  });
});

describe("dashboard and requirements", () => {
  it("toggles and reorders widgets independently by dashboard scope", () => {
    let state = createInitialWorkspaceState();
    const originalProjectFirst =
      state.projectStates["unexpected-vocals"].missionConfig.widgets[0].id;
    state = workspaceReducer(state, {
      type: "TOGGLE_WIDGET",
      scope: "portfolio",
      widgetId: "project_health",
    });
    state = workspaceReducer(state, {
      type: "MOVE_WIDGET",
      scope: "portfolio",
      widgetId: "deadlines",
      direction: "up",
    });
    expect(state.portfolioConfig.widgets[0].id).toBe("deadlines");
    expect(
      state.portfolioConfig.widgets.find((item) => item.id === "project_health")
        ?.visible,
    ).toBe(false);
    expect(
      state.projectStates["unexpected-vocals"].missionConfig.widgets[0].id,
    ).toBe(originalProjectFirst);
  });

  it("applies distinct fixed widget catalogs for dashboard presets", () => {
    let state = createInitialWorkspaceState();
    state = workspaceReducer(state, {
      type: "SET_DASHBOARD_PRESET",
      scope: "portfolio",
      preset: "operations",
    });
    expect(state.portfolioConfig.widgets[0]).toEqual({
      id: "capacity",
      visible: true,
    });
    expect(
      state.portfolioConfig.widgets.find((widget) => widget.id === "budgets")
        ?.visible,
    ).toBe(false);
    state = workspaceReducer(state, {
      type: "SET_DASHBOARD_PRESET",
      scope: "project",
      projectId: "unexpected-vocals",
      preset: "release_readiness",
    });
    expect(
      state.projectStates["unexpected-vocals"].missionConfig.widgets[0].id,
    ).toBe("release_readiness");
  });

  it("publishes immutable requirement history and marks downstream work stale", () => {
    let state = createInitialWorkspaceState();
    const previous =
      state.projectStates["unexpected-vocals"].requirements.versions[0];
    state = workspaceReducer(state, {
      type: "EDIT_REQUIREMENT_DRAFT",
      changes: {
        targetBehavior:
          "Reduce audible vocal leakage below the release threshold.",
      },
    });
    state = workspaceReducer(state, {
      type: "PUBLISH_REQUIREMENT",
      reason: "Clarified the measurable release boundary.",
    });
    const project = state.projectStates["unexpected-vocals"];
    expect(project.requirements.currentVersion).toBe("v4");
    expect(project.requirements.versions).toHaveLength(2);
    expect(project.requirements.versions[0]).toEqual(previous);
    expect(project.requirements.versions[1].changedFields).toContain(
      "targetBehavior",
    );
    expect(project.sourcePlanStatus).toBe("stale");
    expect(
      project.vendorEngagements.every((item) => item.status === "stale"),
    ).toBe(true);
    expect(
      project.workflowStages.every((item) => item.status === "stale"),
    ).toBe(true);
    expect(
      project.scenario.artifacts.every((item) => item.status === "stale"),
    ).toBe(true);
    state = workspaceReducer(state, {
      type: "ALIGN_REQUIREMENTS",
      projectId: "unexpected-vocals",
    });
    expect(
      state.projectStates["unexpected-vocals"].scenario.program.stage,
    ).toBe("requirements_aligned");
  });

  it("records and resolves simulated reminders and validates attachment metadata", () => {
    let state = createInitialWorkspaceState();
    state = workspaceReducer(state, {
      type: "ADD_REMINDER",
      reminder: {
        recipient: "Research",
        dueDate: "2026-08-20",
        message: "Review the revised slices.",
      },
    });
    const reminder =
      state.projectStates["unexpected-vocals"].requirements.reminders[0];
    expect(reminder.status).toBe("open");
    expect(reminder.simulated).toBe(true);
    state = workspaceReducer(state, {
      type: "RESOLVE_REMINDER",
      reminderId: reminder.id,
    });
    expect(
      state.projectStates["unexpected-vocals"].requirements.reminders[0].status,
    ).toBe("resolved");

    const attachment: RequirementAttachment = {
      id: "attachment-1",
      name: "rubric.md",
      mimeType: "text/markdown",
      size: 120,
      storageKey: "unexpected/rubric.md",
      uploadedAt: "2026-08-18T16:00:00.000Z",
      uploadedBy: "Research",
    };
    state = workspaceReducer(state, { type: "ADD_ATTACHMENT", attachment });
    state = workspaceReducer(state, {
      type: "ADD_ATTACHMENT",
      attachment: { ...attachment, id: "too-large", size: 2 * 1024 * 1024 + 1 },
    });
    expect(
      state.projectStates["unexpected-vocals"].requirements.attachments,
    ).toEqual([attachment]);
  });

  it("edits source plans without leaking changes across projects", () => {
    let state = createInitialWorkspaceState();
    const naturalnessBefore = state.projectStates[
      "vocal-naturalness"
    ].sourcePlan.find((item) => item.source === "vendor");
    state = workspaceReducer(state, {
      type: "EDIT_SOURCE_PLAN_ITEM",
      projectId: "unexpected-vocals",
      source: "vendor",
      changes: { targetRecords: 5200, share: 120, estimatedCost: -4 },
    });
    const edited = state.projectStates["unexpected-vocals"].sourcePlan.find(
      (item) => item.source === "vendor",
    );
    const untouched = state.projectStates["vocal-naturalness"].sourcePlan.find(
      (item) => item.source === "vendor",
    );
    expect(edited).toMatchObject({
      targetRecords: 5200,
      share: 100,
      estimatedCost: 0,
    });
    expect(untouched).toEqual(naturalnessBefore);
    expect(state.projectStates["unexpected-vocals"].sourcePlanStatus).toBe(
      "stale",
    );
  });

  it("requires a complete allocation before saving a source plan", () => {
    let state = createInitialWorkspaceState();
    state = workspaceReducer(state, {
      type: "EDIT_SOURCE_PLAN_ITEM",
      projectId: "vocal-naturalness",
      source: "vendor",
      changes: { targetRecords: 7000 },
    });
    expect(state.projectStates["vocal-naturalness"].sourcePlanStatus).toBe(
      "stale",
    );
    state = workspaceReducer(state, {
      type: "SAVE_SOURCE_PLAN",
      projectId: "vocal-naturalness",
    });
    expect(state.projectStates["vocal-naturalness"].sourcePlanStatus).toBe(
      "aligned",
    );
    expect(state.audit.at(-1)).toMatchObject({
      action: "Source plan saved",
      projectId: "vocal-naturalness",
    });
  });
});

describe("shared vendors and internal operations", () => {
  it("uses the approved weighted vendor score", () => {
    const empty: VendorMetrics = {
      quality: 0,
      expertise: 0,
      responsiveness: 0,
      improvement: 0,
      scaling: 0,
      reliability: 0,
      costEfficiency: 0,
      throughput: 0,
    };
    expect(scoreVendor({ ...empty, quality: 100 })).toBe(30);
    expect(scoreVendor({ ...empty, expertise: 100 })).toBe(15);
    expect(scoreVendor({ ...empty, scaling: 100 })).toBe(10);
    expect(scoreVendor({ ...empty, throughput: 100 })).toBe(5);
  });

  it("scores a newly added vendor without performance history", () => {
    const vendor = {
      ...createInitialWorkspaceState().vendors[0],
      id: "new-vendor",
      history: [],
    };
    expect(recommendAllocation([vendor])[0]).toMatchObject({
      vendorId: "new-vendor",
      trajectory: 0,
    });
  });

  it("requires completed, quality-approved internal batches before release", () => {
    let state = createInitialWorkspaceState();
    expect(
      internalBatchesReleaseReady(state.projectStates["unexpected-vocals"]),
    ).toBe(false);
    state = workspaceReducer(state, {
      type: "SYNC_INTERNAL_BATCH",
      batchId: "internal-batch-unexpected-v1",
      completedTasks: 400,
    });
    expect(
      internalBatchesReleaseReady(state.projectStates["unexpected-vocals"]),
    ).toBe(false);
    state = workspaceReducer(state, {
      type: "IMPORT_INTERNAL_RESULT",
      batchId: "internal-batch-unexpected-v1",
      aggregateQA: 0.95,
    });
    expect(
      internalBatchesReleaseReady(state.projectStates["unexpected-vocals"]),
    ).toBe(true);
  });
});

describe("dataset and evaluation lifecycle", () => {
  it("invalidates prior quality evidence after a new requirement is published", () => {
    let state = createInitialWorkspaceState();
    state = workspaceReducer(state, { type: "ALIGN_REQUIREMENTS" });
    state = workspaceReducer(state, { type: "ACTIVATE_SOURCES" });
    state = workspaceReducer(state, { type: "RUN_QA" });
    state = workspaceReducer(state, {
      type: "REVIEW_VENDOR",
      recordId: "delivery-009",
      action: "reject",
      rationale: "Return the ambiguous record for correction.",
    });
    state = workspaceReducer(state, { type: "REQUEST_REMEDIATION" });
    state = workspaceReducer(state, { type: "LOAD_CORRECTED" });
    state = workspaceReducer(state, { type: "RUN_QA" });
    state = workspaceReducer(state, {
      type: "SYNC_INTERNAL_BATCH",
      batchId: "internal-batch-unexpected-v1",
      completedTasks: 400,
    });
    state = workspaceReducer(state, {
      type: "IMPORT_INTERNAL_RESULT",
      batchId: "internal-batch-unexpected-v1",
      aggregateQA: 0.95,
    });
    expect(
      state.projectStates["unexpected-vocals"].scenario.qaReport?.passed,
    ).toBe(true);
    state = workspaceReducer(state, {
      type: "EDIT_REQUIREMENT_DRAFT",
      changes: { scope: "Expanded current-version scope" },
    });
    state = workspaceReducer(state, {
      type: "PUBLISH_REQUIREMENT",
      reason: "Expanded the release scope.",
    });
    const project = state.projectStates["unexpected-vocals"];
    expect(project.scenario.qaReport).toBeNull();
    expect(project.sourcePlanStatus).toBe("stale");
    expect(project.internalWorkBatches[0]).toMatchObject({
      requirementVersion: "v4",
      status: "planned",
      completedTasks: 0,
    });
    expect(
      project.scenario.internalTasks.every(
        (task) => task.requirementVersion === "v4",
      ),
    ).toBe(true);
    state = workspaceReducer(state, { type: "BUILD_RELEASE" });
    expect(
      state.datasets.some(
        (dataset) => dataset.projectId === "unexpected-vocals",
      ),
    ).toBe(false);
  });

  it("records manifest downloads in dataset history and the workspace audit", () => {
    let state = createInitialWorkspaceState();
    state = workspaceReducer(state, {
      type: "RECORD_DATASET_DOWNLOAD",
      datasetId: "dataset-naturalness-v2",
      format: "csv",
    });
    expect(state.datasets[0].downloadHistory).toEqual([
      { format: "csv", downloadedAt: expect.any(String) },
    ]);
    expect(state.audit.at(-1)?.action).toBe("Dataset downloaded");
  });

  it("creates a unique dataset after vendor QA and aggregate internal import, without annotation actions", () => {
    let state = createInitialWorkspaceState();
    state = workspaceReducer(state, { type: "ALIGN_REQUIREMENTS" });
    state = workspaceReducer(state, { type: "ACTIVATE_SOURCES" });
    state = workspaceReducer(state, { type: "RUN_QA" });
    state = workspaceReducer(state, {
      type: "REVIEW_VENDOR",
      recordId: "delivery-009",
      action: "reject",
      rationale: "Return the ambiguous record for correction.",
    });
    state = workspaceReducer(state, { type: "REQUEST_REMEDIATION" });
    state = workspaceReducer(state, { type: "LOAD_CORRECTED" });
    state = workspaceReducer(state, { type: "RUN_QA" });
    expect(
      state.projectStates["unexpected-vocals"].scenario.qaReport?.passed,
    ).toBe(true);
    state = workspaceReducer(state, { type: "BUILD_RELEASE" });
    expect(
      state.datasets.some(
        (dataset) => dataset.projectId === "unexpected-vocals",
      ),
    ).toBe(false);
    state = workspaceReducer(state, {
      type: "SYNC_INTERNAL_BATCH",
      batchId: "internal-batch-unexpected-v1",
      completedTasks: 400,
    });
    state = workspaceReducer(state, {
      type: "IMPORT_INTERNAL_RESULT",
      batchId: "internal-batch-unexpected-v1",
      aggregateQA: 0.95,
    });
    expect(
      state.projectStates["unexpected-vocals"].scenario.internalTasks.every(
        (task) => task.status === "complete",
      ),
    ).toBe(true);
    state = workspaceReducer(state, { type: "BUILD_RELEASE" });
    const count = state.datasets.length;
    expect(
      state.datasets.find(
        (dataset) => dataset.projectId === "unexpected-vocals",
      )?.recordCount,
    ).toBeGreaterThan(0);
    state = workspaceReducer(state, { type: "BUILD_RELEASE" });
    expect(state.datasets).toHaveLength(count);
  });

  it("keeps immutable dataset identities unique across requirement cycles", () => {
    let state = createInitialWorkspaceState();
    const completeCycle = () => {
      state = workspaceReducer(state, { type: "ALIGN_REQUIREMENTS" });
      state = workspaceReducer(state, { type: "ACTIVATE_SOURCES" });
      state = workspaceReducer(state, { type: "RUN_QA" });
      state = workspaceReducer(state, {
        type: "REVIEW_VENDOR",
        recordId: "delivery-009",
        action: "reject",
        rationale: "Return this record for correction.",
      });
      state = workspaceReducer(state, { type: "REQUEST_REMEDIATION" });
      state = workspaceReducer(state, { type: "LOAD_CORRECTED" });
      state = workspaceReducer(state, { type: "RUN_QA" });
      const batch =
        state.projectStates["unexpected-vocals"].internalWorkBatches[0];
      state = workspaceReducer(state, {
        type: "SYNC_INTERNAL_BATCH",
        batchId: batch.id,
        completedTasks: batch.totalTasks,
      });
      state = workspaceReducer(state, {
        type: "IMPORT_INTERNAL_RESULT",
        batchId: batch.id,
        aggregateQA: 0.95,
      });
      state = workspaceReducer(state, { type: "BUILD_RELEASE" });
    };

    completeCycle();
    const first = state.datasets.find(
      (dataset) => dataset.projectId === "unexpected-vocals",
    )!;
    state = workspaceReducer(state, {
      type: "EDIT_REQUIREMENT_DRAFT",
      changes: { scope: "A second immutable release scope." },
    });
    state = workspaceReducer(state, {
      type: "PUBLISH_REQUIREMENT",
      reason: "Begin the next release cycle.",
    });
    completeCycle();
    const releases = state.datasets.filter(
      (dataset) => dataset.projectId === "unexpected-vocals",
    );
    expect(releases).toHaveLength(2);
    expect(new Set(releases.map((dataset) => dataset.id)).size).toBe(2);
    expect(releases.map((dataset) => dataset.id)).toContain(first.id);
    expect(releases.at(-1)).toMatchObject({
      requirementVersion: "v4",
      version: "dataset-v4",
    });
  });

  it("enforces the evaluation lifecycle and promotion guardrails", () => {
    let state = createInitialWorkspaceState();
    const handoffId = "evaluation-naturalness-v2";
    const datasetId = "dataset-naturalness-v2";
    expect(canPromoteDataset(state, datasetId)).toBe(false);
    state = workspaceReducer(state, { type: "ADVANCE_EVALUATION", handoffId });
    state = workspaceReducer(state, { type: "ADVANCE_EVALUATION", handoffId });
    expect(
      state.evaluationHandoffs.find((item) => item.id === handoffId)?.status,
    ).toBe("running");
    state = workspaceReducer(state, {
      type: "SUBMIT_EVALUATION_RESULTS",
      handoffId,
      notes: "Target and guardrail passed.",
      results: [
        {
          metric: "Vocal naturalness preference",
          value: 0.78,
          threshold: 0.75,
          operator: "gte",
          guardrail: false,
          passed: true,
        },
        {
          metric: "Prompt adherence",
          value: 0.74,
          threshold: 0.72,
          operator: "gte",
          guardrail: true,
          passed: true,
        },
      ],
    });
    state = workspaceReducer(state, { type: "ADVANCE_EVALUATION", handoffId });
    expect(
      state.evaluationHandoffs.find((item) => item.id === handoffId)?.status,
    ).toBe("decision_ready");
    expect(canPromoteDataset(state, datasetId)).toBe(true);
    state = workspaceReducer(state, {
      type: "PROMOTE_DATASET",
      datasetId,
      rationale: "All required evidence passed.",
    });
    expect(
      state.datasets.find((item) => item.id === datasetId)?.releaseState,
    ).toBe("promoted");
  });

  it("blocks promotion when an evaluation result fails", () => {
    let state = createInitialWorkspaceState();
    const handoffId = "evaluation-naturalness-v2";
    state = workspaceReducer(state, { type: "ADVANCE_EVALUATION", handoffId });
    state = workspaceReducer(state, { type: "ADVANCE_EVALUATION", handoffId });
    state = workspaceReducer(state, {
      type: "SUBMIT_EVALUATION_RESULTS",
      handoffId,
      notes: "Guardrail regressed.",
      results: [
        {
          metric: "Vocal naturalness preference",
          value: 0.78,
          threshold: 0.75,
          operator: "gte",
          guardrail: false,
          passed: true,
        },
        {
          metric: "Prompt adherence",
          value: 0.7,
          threshold: 0.72,
          operator: "gte",
          guardrail: true,
          passed: true,
        },
      ],
    });
    state = workspaceReducer(state, { type: "ADVANCE_EVALUATION", handoffId });
    expect(
      state.evaluationHandoffs
        .find((item) => item.id === handoffId)
        ?.results.find((result) => result.metric === "Prompt adherence")
        ?.passed,
    ).toBe(false);
    state = workspaceReducer(state, {
      type: "PROMOTE_DATASET",
      datasetId: "dataset-naturalness-v2",
      rationale: "Promote anyway.",
    });
    expect(state.datasets[0].releaseState).toBe("candidate");
  });
});
