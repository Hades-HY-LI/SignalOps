import { describe, expect, it } from "vitest";
import {
  buildDatasetExport,
  buildEvaluationHandoffPackage,
  datasetExportRows,
} from "./exports";
import { createInitialWorkspaceState } from "./workspace";

describe("dataset and evaluation exports", () => {
  it("builds a record-level manifest for every dataset record", () => {
    const state = createInitialWorkspaceState();
    const dataset = state.datasets[0];
    const rows = datasetExportRows(dataset);
    expect(rows).toHaveLength(dataset.recordCount);
    expect(rows[0]).toMatchObject({
      source: "vendor",
      dataset_version: dataset.version,
      requirement_version: dataset.requirementVersion,
    });
    expect(buildDatasetExport(dataset)).toMatchObject({
      schema_version: "signalops.dataset-export.v1",
      dataset: { record_count: dataset.recordCount },
    });
  });

  it("embeds dataset references, execution instructions, and evaluation schema", () => {
    const state = createInitialWorkspaceState();
    const dataset = state.datasets[0];
    const handoff = state.evaluationHandoffs[0];
    const pkg = buildEvaluationHandoffPackage(dataset, handoff);
    expect(pkg.dataset.records).toHaveLength(dataset.recordCount);
    expect(pkg.execution.connector).toMatchObject({
      registry_entry_id: "registry-evaluation-api",
      method: "POST",
    });
    expect(pkg.evaluation_spec.target_metrics).toEqual(handoff.targetMetrics);
  });
});
