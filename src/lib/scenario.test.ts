import { describe, expect, it } from "vitest";
import { createInitialState } from "./fixtures";
import { isScenarioState, scenarioReducer } from "./scenario";

describe("scenario lifecycle", () => {
  it("runs the blocked delivery through remediation", () => {
    let state = createInitialState();
    state = scenarioReducer(state, { type: "ALIGN_REQUIREMENTS" });
    state = scenarioReducer(state, { type: "ACTIVATE_SOURCES" });
    state = scenarioReducer(state, { type: "RUN_QA" });
    expect(state.program.stage).toBe("qa_blocked");

    state = scenarioReducer(state, { type: "REVIEW_VENDOR", recordId: "delivery-009", action: "reject", rationale: "Ambiguous record requires correction." });
    state = scenarioReducer(state, { type: "REQUEST_REMEDIATION" });
    expect(state.remediation?.status).toBe("sent");
    state = scenarioReducer(state, { type: "LOAD_CORRECTED" });
    state = scenarioReducer(state, { type: "RUN_QA" });
    expect(state.qaReport?.passed).toBe(true);
  });

  it("ignores review actions without rationale", () => {
    const state = createInitialState();
    const next = scenarioReducer(state, { type: "REVIEW_VENDOR", recordId: "delivery-001", action: "override", rationale: "" });
    expect(next).toBe(state);
  });

  it("resets to the initial scenario", () => {
    let state = createInitialState();
    state = scenarioReducer(state, { type: "ALIGN_REQUIREMENTS" });
    state = scenarioReducer(state, { type: "RESET" });
    expect(state.program.stage).toBe("signal_detected");
    expect(state.artifacts.some((artifact) => artifact.status === "stale")).toBe(true);
  });

  it("rejects malformed persisted state", () => {
    expect(isScenarioState({ schemaVersion: 1 })).toBe(false);
    expect(isScenarioState({ ...createInitialState(), internalTasks: [null] })).toBe(false);
    expect(isScenarioState(createInitialState())).toBe(true);
  });

  it("routes low-confidence internal work to adjudication", () => {
    let state = createInitialState();
    state = scenarioReducer(state, { type: "ALIGN_REQUIREMENTS" });
    state = scenarioReducer(state, { type: "ACTIVATE_SOURCES" });
    const task = state.internalTasks[0];
    state = scenarioReducer(state, { type: "COMPLETE_INTERNAL", taskId: task.id, label: "uncertain", confidence: 0.65, notes: "Evidence remains ambiguous." });
    expect(state.internalTasks[0].status).toBe("adjudication_required");
    state = scenarioReducer(state, { type: "RESOLVE_INTERNAL", taskId: task.id, label: "instrumental", rationale: "Senior review resolved the boundary case." });
    expect(state.internalTasks[0].status).toBe("complete");
  });
});
