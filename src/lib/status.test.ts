import { describe, expect, it } from "vitest";
import { buildReleaseCheckpoints } from "./status";
import { createInitialWorkspaceState } from "./workspace";

describe("release checkpoint status", () => {
  it("distinguishes an unfinished source plan from an aligned plan with no in-house work", () => {
    const state = createInitialWorkspaceState();
    const result = buildReleaseCheckpoints(
      state,
      "multilingual-prompt-adherence",
    );
    expect(result.checkpoints.find((item) => item.id === "internal")).toMatchObject(
      {
        status: "pending",
      },
    );

    state.projectStates["multilingual-prompt-adherence"] = {
      ...state.projectStates["multilingual-prompt-adherence"],
      sourcePlanStatus: "aligned",
      sourcePlan: state.projectStates[
        "multilingual-prompt-adherence"
      ].sourcePlan.map((item) =>
        item.source === "vendor"
          ? { ...item, share: 100, targetRecords: 100 }
          : item,
      ),
    };
    const aligned = buildReleaseCheckpoints(
      state,
      "multilingual-prompt-adherence",
    );
    expect(
      aligned.checkpoints.find((item) => item.id === "internal"),
    ).toMatchObject({
      status: "not_required",
      detail: "No in-house allocation in the saved source plan",
    });
  });

  it("includes a trace route and evidence source for every checkpoint", () => {
    const state = createInitialWorkspaceState();
    const result = buildReleaseCheckpoints(state, "unexpected-vocals");
    expect(result.checkpoints).toHaveLength(6);
    expect(
      result.checkpoints.every(
        (item) =>
          item.href.startsWith("/projects/unexpected-vocals/") &&
          item.source.length > 0,
      ),
    ).toBe(true);
  });
});
