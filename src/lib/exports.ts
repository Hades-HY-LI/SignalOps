import type { DatasetVersion, EvaluationHandoff, SourceType } from "./types";

export interface DatasetExportRow {
  record_id: string;
  source: SourceType;
  asset_uri: string;
  origin_id: string;
  dataset_version: string;
  requirement_version: string;
  qa_status: DatasetVersion["qaStatus"];
}

export function datasetExportRows(dataset: DatasetVersion): DatasetExportRow[] {
  if (dataset.manifest?.lineage.length) {
    return dataset.manifest.lineage.map((item) => ({
      record_id: item.recordId,
      source: item.source,
      asset_uri: `object://signalops-demo/${dataset.id}/${item.source}/${item.recordId}.json`,
      origin_id: item.originId,
      dataset_version: dataset.version,
      requirement_version: item.requirementVersion,
      qa_status: dataset.qaStatus,
    }));
  }

  return (
    Object.entries(dataset.sourceCounts) as Array<[SourceType, number]>
  ).flatMap(([source, count]) =>
    Array.from({ length: count }, (_, index) => {
      const recordId = `${dataset.id}-${source}-${String(index + 1).padStart(6, "0")}`;
      return {
        record_id: recordId,
        source,
        asset_uri: `object://signalops-demo/${dataset.id}/${source}/${recordId}.json`,
        origin_id: `${source}-partition`,
        dataset_version: dataset.version,
        requirement_version: dataset.requirementVersion,
        qa_status: dataset.qaStatus,
      };
    }),
  );
}

export function buildDatasetExport(dataset: DatasetVersion) {
  const records = datasetExportRows(dataset);
  return {
    schema_version: "signalops.dataset-export.v1",
    generated_by: "SignalOps browser-local demo",
    dataset: {
      id: dataset.id,
      project_id: dataset.projectId,
      name: dataset.name,
      version: dataset.version,
      requirement_version: dataset.requirementVersion,
      qa_status: dataset.qaStatus,
      release_state: dataset.releaseState,
      record_count: dataset.recordCount,
      source_counts: dataset.sourceCounts,
    },
    data_contract: {
      format: "JSONL assets referenced by a record-level manifest",
      primary_key: "record_id",
      fields: [
        "record_id",
        "source",
        "asset_uri",
        "origin_id",
        "dataset_version",
        "requirement_version",
        "qa_status",
      ],
      media_note:
        "Raw media is not embedded in this browser demo. Production handoffs resolve signed object-storage URIs.",
    },
    partitions: (
      Object.entries(dataset.sourceCounts) as Array<[SourceType, number]>
    )
      .filter(([, count]) => count > 0)
      .map(([source, count]) => ({
        source,
        record_count: count,
        manifest_path: `manifests/${source}.jsonl`,
        data_prefix: `object://signalops-demo/${dataset.id}/${source}/`,
      })),
    exclusions: dataset.exclusions,
    records,
  };
}

export function buildEvaluationHandoffPackage(
  dataset: DatasetVersion,
  handoff: EvaluationHandoff,
) {
  const datasetPackage = buildDatasetExport(dataset);
  return {
    schema_version: "signalops.evaluation-handoff.v1",
    handoff: {
      id: handoff.id,
      project_id: handoff.projectId,
      dataset_id: handoff.datasetId,
      status: handoff.status,
      owners: handoff.owners,
      due_date: handoff.dueDate,
      decision_request: handoff.decisionRequest,
      delivery: handoff.delivery,
    },
    evaluation_spec: {
      method: handoff.method,
      target_metrics: handoff.targetMetrics,
      guardrails: handoff.guardrails,
      slices: handoff.slices,
      expected_result_schema: {
        metric: "string",
        value: "number",
        threshold: "number",
        operator: "gte | lte",
        guardrail: "boolean",
        notes: "string",
      },
    },
    execution: {
      mode: handoff.delivery,
      simulated: true,
      download_instructions: [
        "Read dataset.records as the record-level manifest.",
        "Resolve asset_uri values from the configured object-storage connector.",
        "Run the declared metrics and return results using expected_result_schema.",
      ],
      connector:
        handoff.delivery === "simulated_connector"
          ? {
              registry_entry_id: "registry-evaluation-api",
              method: "POST",
              endpoint: "/v1/evaluation-runs",
              callback: "/v1/evaluation-runs/{run_id}/results",
            }
          : null,
    },
    dataset: datasetPackage,
    submitted_results: handoff.results,
    notes: handoff.notes,
  };
}
