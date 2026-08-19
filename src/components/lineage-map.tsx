"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { LineageNode as LineageNodeData } from "@/lib/types";

type FlowLineageData = LineageNodeData & { onSelect: (id: string) => void } & Record<string, unknown>;
type LineageNodeProps = Node<FlowLineageData, "lineage">;

function LineageNode({ data }: NodeProps<LineageNodeProps>) {
  return (
    <div
      className="lineage-node"
      data-status={data.status}
      role="button"
      tabIndex={0}
      aria-label={`${data.label}: ${data.detail}`}
      onClick={() => data.onSelect(data.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          data.onSelect(data.id);
        }
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <span className={`status ${data.status}`}>{data.status}</span>
      <strong style={{ marginTop: 9 }}>{data.label}</strong>
      <p>{data.detail}</p>
      {typeof data.count === "number" ? <p className="mono">{data.count} records</p> : null}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const positions: Record<string, { x: number; y: number }> = {
  signal: { x: 10, y: 22 },
  requirement: { x: 245, y: 22 },
  vendor: { x: 480, y: 22 },
  internal: { x: 480, y: 176 },
  qa: { x: 730, y: 98 },
  release: { x: 970, y: 98 },
  evaluation: { x: 1210, y: 98 },
};

export function LineageMap({
  graph,
  selectedId,
  onSelect,
}: {
  graph: { nodes: LineageNodeData[]; edges: Array<{ id: string; source: string; target: string; label?: string }> };
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const nodes = useMemo<Node<FlowLineageData, "lineage">[]>(
    () => graph.nodes.map((node) => ({ id: node.id, type: "lineage", position: positions[node.id], data: { ...node, onSelect }, selected: node.id === selectedId, draggable: false })),
    [graph.nodes, onSelect, selectedId],
  );
  const edges = useMemo<Edge[]>(
    () => graph.edges.map((edge) => ({ ...edge, label: edge.label, animated: edge.target === "qa", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#87917f" }, labelStyle: { fill: "#bfc6bb", fontSize: 9 }, labelBgStyle: { fill: "#1b2018" } })),
    [graph.edges],
  );

  return (
    <div className="lineage-shell" aria-label="Interactive dataset lineage graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ lineage: LineageNode }}
        onNodeClick={(_, node) => onSelect(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.52}
        maxZoom={1.3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#343b31" gap={22} size={1} variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
