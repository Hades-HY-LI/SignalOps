"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Boxes,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Database,
  Download,
  FileJson,
  GitBranch,
  House,
  Layers3,
  ListChecks,
  PackageCheck,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { buildLineageGraph, canPromote, exportWorkPackage, recommendAllocation, scoreVendor } from "@/lib/domain";
import { correctedRecords, defectiveRecords, evaluationResults, workflowTemplates } from "@/lib/fixtures";
import { useScenario } from "@/lib/scenario";
import type { VocalLabel } from "@/lib/types";

const LineageMap = dynamic(() => import("./lineage-map").then((module) => module.LineageMap), {
  ssr: false,
  loading: () => <div className="lineage-shell release-empty">Preparing lineage graph…</div>,
});

const nav = [
  ["mission", "Mission control", House],
  ["requirements", "Requirements", ListChecks],
  ["vendors", "Vendor operations", Boxes],
  ["internal", "In-house review", Users],
  ["registry", "Workflow registry", Layers3],
  ["lineage", "Data lineage", GitBranch],
  ["release", "Dataset release", PackageCheck],
] as const;

function Status({ value }: { value: string }) {
  const label = value.replaceAll("_", " ");
  const variant = value === "qa_blocked" ? "blocked" : value === "release_ready" ? "complete" : value;
  return <span className={`status ${variant}`}>{label}</span>;
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="section-heading">
      <div><div className="eyebrow">{number} / Workflow</div><h2>{title}</h2></div>
      <p>{description}</p>
    </div>
  );
}

function downloadJson(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Dashboard() {
  const { state, dispatch, hydrated } = useScenario();
  const [signalKind, setSignalKind] = useState<"explicit" | "implicit">("explicit");
  const [selectedTaskId, setSelectedTaskId] = useState(state.internalTasks[0]?.id ?? "");
  const [internalLabel, setInternalLabel] = useState<VocalLabel>("instrumental");
  const [internalConfidence, setInternalConfidence] = useState("0.85");
  const [internalNotes, setInternalNotes] = useState("");
  const [reviewRecordId, setReviewRecordId] = useState("");
  const [reviewAction, setReviewAction] = useState<"accept" | "reject" | "override">("reject");
  const [reviewRationale, setReviewRationale] = useState("");
  const [releaseRationale, setReleaseRationale] = useState("");
  const [selectedLineageId, setSelectedLineageId] = useState("qa");

  const activeRecords = state.activeDelivery === "corrected" ? correctedRecords : defectiveRecords;
  const selectedTask = state.internalTasks.find((task) => task.id === selectedTaskId) ?? state.internalTasks[0];
  const graph = useMemo(() => buildLineageGraph(state), [state]);
  const selectedNode = graph.nodes.find((node) => node.id === selectedLineageId) ?? graph.nodes[0];
  const vendorRecommendations = useMemo(() => recommendAllocation(state.vendors), [state.vendors]);
  const failedRecordIds = useMemo(() => new Set(state.qaReport?.gates.flatMap((gate) => gate.passed ? [] : gate.recordIds) ?? []), [state.qaReport]);
  const completedInternal = state.internalTasks.filter((task) => task.status === "complete").length;
  const alignedCount = state.artifacts.filter((item) => item.status === "aligned").length;
  const promotable = canPromote(state);

  const submitInternal = () => {
    if (!selectedTask || selectedTask.status !== "pending" || !internalNotes.trim()) return;
    dispatch({ type: "COMPLETE_INTERNAL", taskId: selectedTask.id, label: internalLabel, confidence: Number(internalConfidence), notes: internalNotes });
    setInternalNotes("");
    const next = state.internalTasks.find((task) => task.status === "pending" && task.id !== selectedTask.id);
    if (next) setSelectedTaskId(next.id);
  };

  return (
    <main className="app-shell" aria-busy={!hydrated}>
      <aside className="sidebar">
        <a className="brand" href="#mission" aria-label="SignalOps home"><span className="brand-mark"><Activity size={16} /></span><span className="brand-name">SignalOps</span></a>
        <div className="environment">Control room</div>
        <nav className="side-nav" aria-label="Workspace sections">
          {nav.map(([id, label, Icon]) => <a key={id} href={`#${id}`} title={label}><Icon size={16} /><span>{label}</span></a>)}
        </nav>
        <div className="side-foot"><div className="eyebrow"><span className="dot" /> Scenario saved</div><p>Versioned locally in this browser.</p></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="brand"><span className="brand-mark"><Activity size={16} /></span><span>SignalOps</span><span className="topbar-title">/ Unexpected Vocals</span></div>
          <div className="top-actions">
            <button className="button small" onClick={() => dispatch({ type: "RESET" })}><RotateCcw size={13} /> Reset</button>
            <div className="owner"><span className="avatar">MC</span><span>Maya Chen</span></div>
          </div>
        </header>

        <section id="mission" aria-labelledby="mission-title">
          <div className="hero">
            <div className="hero-main">
              <div className="eyebrow" style={{ color: "#aab2a5" }}><span className="sim-label">Simulated scenario</span> Active intervention · {state.program.deadline}</div>
              <h1 id="mission-title">Turn noisy signals into <span>trusted data.</span></h1>
              <p>{state.program.summary} One traceable path connects a versioned requirement, three data sources, quality gates, and a release decision.</p>
              <div className="hero-status"><span><i className="dot" />Browser state persisted</span><span><CircleGauge size={13} />Owner · {state.program.owner}</span><Status value={state.program.stage} /></div>
            </div>
            <div className="hero-side">
              <div className="metric-card accent"><div className="eyebrow">Target defect rate</div><strong>{state.program.target}%</strong><p>Down from a {state.program.baseline}% baseline</p></div>
              <div className="metric-card"><div className="eyebrow">Release readiness</div><strong>{state.release ? "100" : state.qaReport?.passed ? "78" : state.qaReport ? "42" : "18"}%</strong><p>{state.qaReport?.passed ? "Quality gates clear" : state.qaReport ? "Blocked on critical QA" : "Awaiting first quality run"}</p></div>
            </div>
          </div>
          <div className="grid grid-3">
            {state.sourcePlan.map((source) => {
              const Icon = source.source === "vendor" ? Boxes : source.source === "internal" ? Users : Zap;
              return <article className="card source-card" key={source.source}><div className="card-header"><span className="source-icon"><Icon size={16} /></span><span className="sim-label">Planned</span></div><div className="eyebrow">{source.source} source</div><strong>{source.targetRecords.toLocaleString()}</strong><p className="subtle">{source.share}% of mix · {source.turnaround} · {source.confidence} confidence</p></article>;
            })}
          </div>
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <article className="card"><div className="card-header"><h3>Program owners</h3><Status value={state.program.stage} /></div><div className="kv"><span>Operations</span><b>{state.program.owner}</b></div><div className="kv"><span>Research</span><b>{state.program.researchOwner}</b></div><div className="kv"><span>Product</span><b>{state.program.productOwner}</b></div></article>
            <article className="card"><div className="card-header"><h3>Related programs</h3><span className="sim-label">Read only</span></div><div className="artifact"><div><strong>Vocal Naturalness Preference</strong><br/><small>Pairwise evaluation</small></div><Status value="pending" /><ChevronRight size={14} /></div><div className="artifact"><div><strong>Prompt-Adherence Review</strong><br/><small>Ranking study</small></div><Status value="pending" /><ChevronRight size={14} /></div></article>
          </div>
        </section>

        <section className="section" id="requirements" aria-labelledby="requirements-title">
          <SectionHeading number="01" title="Requirements & source plan" description="Anchor every downstream artifact to the current research intent before collection starts." />
          <div className="grid grid-2">
            <article className="card">
              <div className="card-header"><div><h3 id="requirements-title">Requirement alignment</h3><p className="subtle">Current version · {state.program.requirementVersion}</p></div><span className="calc-label sim-label">Live check</span></div>
              {state.artifacts.map((artifact) => <div className="artifact" key={artifact.id}><div><strong>{artifact.name}</strong><br/><small>{artifact.owner}</small></div><small className="mono">{artifact.version}</small><Status value={artifact.status} /></div>)}
              <div className="button-row" style={{ marginTop: 16 }}><button className="button primary" disabled={alignedCount === state.artifacts.length} onClick={() => dispatch({ type: "ALIGN_REQUIREMENTS" })}><Check size={13} /> Align stale artifacts</button><span className="subtle">{alignedCount}/{state.artifacts.length} aligned</span></div>
            </article>
            <article className="card">
              <div className="card-header"><div><h3>Source allocation</h3><p className="subtle">4,000 target records across three paths</p></div><span className="sim-label">Estimate</span></div>
              <div className="source-mix" role="img" aria-label="Source mix: 60% vendor, 10% internal, 30% product">{state.sourcePlan.map((item) => <span key={item.source} style={{ width: `${item.share}%` }} />)}</div>
              {state.sourcePlan.map((item) => <div className="kv" key={item.source}><span style={{ textTransform: "capitalize" }}>{item.source} · {item.share}%</span><b>${item.estimatedCost.toLocaleString()} · {item.turnaround}</b></div>)}
              <button className="button dark" disabled={alignedCount !== state.artifacts.length || state.program.stage !== "requirements_aligned"} onClick={() => dispatch({ type: "ACTIVATE_SOURCES" })}><Play size={13} /> Activate all sources</button>
            </article>
          </div>
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <article className="card"><div className="card-header"><div><h3>Product feedback simulator</h3><p className="subtle">Create a normalized candidate signal.</p></div><span className="sim-label"><Sparkles size={10} /> Simulated</span></div><div className="form-grid"><label>Signal behavior<select value={signalKind} disabled={Boolean(state.release)} onChange={(event) => setSignalKind(event.target.value as "explicit" | "implicit")}><option value="explicit">Explicit report</option><option value="implicit">Regenerate behavior</option></select></label><label>Normalized slice<input value="ambient-en" readOnly /></label></div><div className="button-row" style={{ marginTop: 12 }}><button className="button primary" disabled={Boolean(state.release)} onClick={() => dispatch({ type: "CAPTURE_SIGNAL", kind: signalKind })}><Zap size={13} /> Capture signal</button><span className="subtle">{state.productSignals.length} candidates captured</span></div></article>
            <article className="card dark"><div className="card-header"><h3>Collection contract</h3><span className="status complete">Versioned</span></div><div className="kv"><span>Requirement</span><b>{state.program.requirementVersion}</b></div><div className="kv"><span>Rubric</span><b>{state.program.rubricVersion}</b></div><div className="kv"><span>Target</span><b>≤ {state.program.target}% vocal rate</b></div><div className="kv"><span>Guardrail</span><b>≥ {state.program.guardrail}% adherence</b></div></article>
          </div>
        </section>

        <section className="section" id="vendors" aria-labelledby="vendors-title">
          <SectionHeading number="02" title="Vendor operations" description="Package requirements, inspect delivery quality, adjudicate exceptions, and close remediation." />
          <div className="grid grid-3">
            {state.vendors.map((vendor) => {
              const decision = vendorRecommendations.find((item) => item.vendorId === vendor.id)!;
              return <article className="card" key={vendor.id}><div className="card-header"><div><h3>{vendor.name}</h3><p className="subtle">{vendor.specialty}</p></div><Status value={decision.recommendation} /></div><strong style={{ fontSize: 30, letterSpacing: "-.05em" }}>{scoreVendor(vendor.metrics)}</strong><span className="subtle"> / 100 weighted score</span><div className="progress" style={{ margin: "13px 0 8px" }}><span style={{ width: `${scoreVendor(vendor.metrics)}%` }} /></div><div className="kv"><span>Quality trajectory</span><b>{decision.trajectory > 0 ? "+" : ""}{decision.trajectory} pts</b></div><div className="kv"><span>Rate / record</span><b>${vendor.rate}</b></div></article>;
            })}
          </div>
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <article className="card">
              <div className="card-header"><div><h3 id="vendors-title">{state.activeDelivery === "defective" ? "Pilot delivery" : "Corrected delivery"}</h3><p className="subtle">Northstar · 48 normalized records</p></div><span className="sim-label">Simulated records</span></div>
              <div className="button-row" style={{ marginBottom: 15 }}><button className="button" onClick={() => downloadJson("signalops-work-package.json", exportWorkPackage(state.program, state.workflow, state.vendors[0]))}><FileJson size={13} /> Export work package</button><button className="button primary" disabled={Boolean(state.release) || state.program.stage === "signal_detected" || state.program.stage === "requirements_aligned"} onClick={() => dispatch({ type: "RUN_QA" })}><CircleGauge size={13} /> Run automated QA</button></div>
              {state.qaReport ? <div className="stack">{state.qaReport.gates.map((gate) => <div className={`gate ${gate.passed ? "" : "fail"}`} key={gate.id}><span className="gate-icon">{gate.passed ? <Check size={13} /> : <X size={13} />}</span><div><strong>{gate.label}</strong><small>{gate.displayValue} · threshold {gate.threshold}</small></div><Status value={gate.passed ? "complete" : "blocked"} /></div>)}</div> : <div className="release-empty"><div><CircleGauge size={30} /><strong>Quality gates haven’t run</strong><p className="subtle">Activate sources, then analyze the delivery.</p></div></div>}
              {state.qaReport && !state.qaReport.passed ? <><div className="button-row" style={{ marginTop: 15 }}><button className="button danger" onClick={() => dispatch({ type: "REQUEST_REMEDIATION" })} disabled={Boolean(state.remediation) || Object.keys(state.vendorDecisions).length === 0}><Send size={13} /> {state.remediation ? "Remediation sent" : "Send remediation"}</button>{state.remediation ? <button className="button primary" onClick={() => dispatch({ type: "LOAD_CORRECTED" })}><RefreshCw size={13} /> Load corrected delivery</button> : null}</div>{Object.keys(state.vendorDecisions).length === 0 ? <div className="notice" style={{ marginTop: 10 }}>Review at least one failed or ambiguous record before requesting remediation.</div> : null}</> : null}
            </article>
            <article className="card">
              <div className="card-header"><div><h3>Exception adjudication</h3><p className="subtle">Every override requires a traceable rationale.</p></div><span className="calc-label sim-label">Human decision</span></div>
              <div className="records">{activeRecords.filter((record) => failedRecordIds.has(record.id) || record.ambiguous).slice(0, 10).map((record) => <button className="task-button" aria-pressed={reviewRecordId === record.id} key={record.id} onClick={() => setReviewRecordId(record.id)}><div><strong>{record.id}</strong><small>{record.prompt || "Missing prompt"} · {record.genre}-{record.locale}</small></div>{state.vendorDecisions[record.id] ? <CheckCircle2 size={14} color="#437f45" /> : <ChevronRight size={14} />}</button>)}</div>
              {reviewRecordId ? <div className="stack" style={{ marginTop: 14 }}><div className="form-grid"><label>Decision<select value={reviewAction} onChange={(event) => setReviewAction(event.target.value as typeof reviewAction)}><option value="accept">Accept</option><option value="reject">Reject</option><option value="override">Override</option></select></label>{reviewAction === "override" ? <label>Corrected label<select value={internalLabel} onChange={(event) => setInternalLabel(event.target.value as VocalLabel)}><option value="instrumental">Instrumental</option><option value="vocals_present">Vocals present</option><option value="uncertain">Uncertain</option></select></label> : <span />}</div><label>Required rationale<textarea value={reviewRationale} onChange={(event) => setReviewRationale(event.target.value)} placeholder="Explain the evidence behind this decision…" /></label><button className="button dark" disabled={!reviewRationale.trim()} onClick={() => { dispatch({ type: "REVIEW_VENDOR", recordId: reviewRecordId, action: reviewAction, rationale: reviewRationale, label: reviewAction === "override" ? internalLabel : undefined }); setReviewRationale(""); }}><ClipboardCheck size={13} /> Record decision</button></div> : <div className="notice" style={{ marginTop: 14 }}>Select a flagged record to record a decision.</div>}
            </article>
          </div>
        </section>

        <section className="section" id="internal" aria-labelledby="internal-title">
          <SectionHeading number="03" title="In-house annotation" description="Resolve ambiguous and high-risk items with calibrated expert review on the same canonical rubric." />
          <div className="grid grid-2">
            <article className="card"><div className="card-header"><div><h3 id="internal-title">Expert queue</h3><p className="subtle">{completedInternal}/{state.internalTasks.length} complete · 2 reviewers</p></div><Status value={state.internalTasks.some((task) => task.status === "adjudication_required") ? "blocked" : completedInternal === state.internalTasks.length ? "complete" : "active"} /></div><div className="progress" style={{ marginBottom: 14 }}><span style={{ width: `${completedInternal / state.internalTasks.length * 100}%` }} /></div><div className="task-list">{state.internalTasks.map((task) => <button className="task-button" key={task.id} aria-pressed={selectedTask?.id === task.id} onClick={() => setSelectedTaskId(task.id)}><div><strong>{task.prompt}</strong><small>{task.assignedTo} · {task.genre}{task.calibration ? " · calibration" : ""}</small></div>{task.status === "complete" ? <CheckCircle2 size={14} color="#437f45" /> : task.status === "adjudication_required" ? <ShieldAlert size={14} color="#c94a3f" /> : <ChevronRight size={14} />}</button>)}</div></article>
            <article className="card">
              {selectedTask ? <><div className="card-header"><div><h3>Review · {selectedTask.id}</h3><p className="subtle">Assigned to {selectedTask.assignedTo}</p></div>{selectedTask.calibration ? <span className="sim-label">Calibration</span> : <Status value={selectedTask.status} />}</div><div className="notice">{state.workflow.humanReviewRule}</div><div className="kv"><span>Prompt</span><b>{selectedTask.prompt}</b></div><div className="kv"><span>Contract</span><b>{selectedTask.requirementVersion} · {selectedTask.rubricVersion}</b></div>{selectedTask.status === "complete" ? <div className="release-empty"><div><CheckCircle2 size={32} color="#437f45" /><strong>Review complete</strong><p className="subtle">{selectedTask.decision?.label?.replaceAll("_", " ")} · {selectedTask.decision?.rationale}</p></div></div> : selectedTask.status === "adjudication_required" ? <div className="stack" style={{ marginTop: 14 }}><div className="notice"><b>Senior adjudication required.</b><br/>The submitted label was uncertain, low confidence, or disagreed with a calibration reference.</div><label>Resolved label<select value={internalLabel} onChange={(event) => setInternalLabel(event.target.value as VocalLabel)}><option value="instrumental">Instrumental</option><option value="vocals_present">Vocals present</option></select></label><label>Adjudication rationale<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Document the evidence used to resolve this case…" /></label><button className="button dark" disabled={!internalNotes.trim() || internalLabel === "uncertain"} onClick={() => { dispatch({ type: "RESOLVE_INTERNAL", taskId: selectedTask.id, label: internalLabel as Exclude<VocalLabel, "uncertain">, rationale: internalNotes }); setInternalNotes(""); }}><ShieldAlert size={13} /> Resolve adjudication</button></div> : <div className="stack" style={{ marginTop: 14 }}><div className="form-grid"><label>Classification<select value={internalLabel} onChange={(event) => setInternalLabel(event.target.value as VocalLabel)}><option value="instrumental">Instrumental</option><option value="vocals_present">Vocals present</option><option value="uncertain">Uncertain</option></select></label><label>Confidence<select value={internalConfidence} onChange={(event) => setInternalConfidence(event.target.value)}><option value="0.95">95% · very high</option><option value="0.85">85% · high</option><option value="0.65">65% · route to adjudication</option></select></label></div><label>Expert notes<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Describe the audible evidence…" /></label><button className="button primary" disabled={!internalNotes.trim()} onClick={submitInternal}><Check size={13} /> Submit annotation</button></div>}</> : null}
            </article>
          </div>
        </section>

        <section className="section" id="registry" aria-labelledby="registry-title">
          <SectionHeading number="04" title="Workflow & integration registry" description="A compact catalog of reusable collection and review contracts. Templates are read-only in this prototype." />
          <div className="grid grid-3">
            {workflowTemplates.map((item) => <article className="card workflow-card" key={item.id}><Status value={item.status === "executable" ? "complete" : "pending"} /><h3 id={item.id === state.workflow.id ? "registry-title" : undefined}>{item.name}</h3><p>{item.description}</p>{item.agentConfig ? <p className="mono">{item.agentConfig.model} · {item.agentConfig.promptVersion}<br/>Human review below {Math.round(item.agentConfig.confidenceThreshold * 100)}% · {item.agentConfig.knownFailures.length} known failure slices</p> : null}<footer><span className="mono">{item.type}</span><span>{item.status === "executable" ? "Executable" : "Template only"} <ArrowRight size={10} style={{ verticalAlign: "middle" }} /></span></footer></article>)}
          </div>
          <div className="grid grid-2" style={{ marginTop: 14 }}><article className="card dark"><div className="card-header"><h3>Vendor JSON adapter</h3><Status value="complete" /></div><p className="subtle">Executable normalization path for versioned batch delivery.</p><div className="kv"><span>Input</span><b>JSON array</b></div><div className="kv"><span>Output</span><b>Canonical delivery records</b></div></article><article className="card"><div className="card-header"><h3>Adapter templates</h3><span className="sim-label">Read only</span></div>{["Webhook events", "Object-storage batch", "Internal expert queue", "Product event stream"].map((name) => <div className="kv" key={name}><span>{name}</span><b>Template</b></div>)}</article></div>
        </section>

        <section className="section" id="lineage" aria-labelledby="lineage-title">
          <SectionHeading number="05" title="Interactive data lineage" description="Click a node to inspect its live state. The graph is fixed to preserve a clear source-to-decision narrative." />
          <div className="grid lineage-layout">
            <LineageMap graph={graph} selectedId={selectedLineageId} onSelect={setSelectedLineageId} />
            <aside className="card" aria-live="polite"><div className="card-header"><div><h3 id="lineage-title">{selectedNode.label}</h3><p className="subtle mono">NODE / {selectedNode.id}</p></div><Status value={selectedNode.status} /></div><p className="subtle">{selectedNode.detail}</p>{typeof selectedNode.count === "number" ? <div className="metric-card accent" style={{ marginTop: 16 }}><div className="eyebrow">Records at node</div><strong>{selectedNode.count}</strong><p>Updated from current scenario state</p></div> : null}{selectedNode.id === "qa" && state.qaReport && !state.qaReport.passed ? <div className="notice" style={{ marginTop: 14 }}><b>{state.qaReport.gates.filter((gate) => !gate.passed).length} blocked gates</b><br/>{state.qaReport.gates.filter((gate) => !gate.passed).map((gate) => gate.label).join(" · ")}</div> : null}<div className="lineage-detail"><div className="eyebrow" style={{ marginBottom: 14 }}>Latest audit events</div><div className="audit-list">{state.audit.slice(-6).reverse().map((event) => <div className="audit-item" key={event.id}><strong>{event.action}</strong><p>{event.detail}<br/>{event.actor}</p></div>)}</div></div></aside>
          </div>
        </section>

        <section className="section" id="release" aria-labelledby="release-title">
          <SectionHeading number="06" title="Dataset release & decision" description="Combine accepted records with full source lineage, inspect simulated evaluation results, and record a promotion rationale." />
          <div className="grid grid-2">
            <article className="card">
              <div className="card-header"><div><h3 id="release-title">Release manifest</h3><p className="subtle">Versioned, source-distinguishable dataset candidate</p></div>{state.release ? <Status value={state.release.decision} /> : <Status value="pending" />}</div>
              {state.release ? <><div className="grid grid-3">{Object.entries(state.release.counts).map(([source, count]) => <div className="metric-card" key={source}><div className="eyebrow">{source}</div><strong>{count}</strong><p>included records</p></div>)}</div><div className="kv" style={{ marginTop: 12 }}><span>Dataset version</span><b>{state.release.version}</b></div><div className="kv"><span>Contract lineage</span><b>{state.release.requirementVersion} · {state.release.rubricVersion}</b></div><div className="kv"><span>Execution lineage</span><b>{state.release.workflowVersion} · {state.release.adapterVersion}</b></div><div className="kv"><span>Excluded</span><b>{state.release.excludedRecordIds.length} records</b></div><button className="button" onClick={() => downloadJson("signalops-decision-manifest.json", { release: state.release, quality: state.qaReport, vendorDecisions: state.vendorDecisions, internalDecisions: state.internalTasks.map((task) => task.decision).filter(Boolean), productSignals: state.productSignals, evaluation: evaluationResults, audit: state.audit })}><Download size={13} /> Export decision package</button></> : <div className="release-empty"><div><Database size={34} /><strong>No release candidate yet</strong><p className="subtle">A passing corrected delivery and completed internal queue are required.</p><button className="button primary" disabled={!state.qaReport?.passed || completedInternal !== state.internalTasks.length} onClick={() => dispatch({ type: "BUILD_RELEASE" })}><PackageCheck size={13} /> Build release</button></div></div>}
            </article>
            <article className="card"><div className="card-header"><div><h3>Evaluation readout</h3><p className="subtle">Directional target and guardrail checks.</p></div><span className="sim-label"><BrainCircuit size={10} /> Simulated</span></div>{evaluationResults.map((result) => { const passed = result.guardrail ? result.candidate >= result.threshold : result.metric.includes("rate") ? result.candidate <= result.threshold : result.candidate >= result.threshold; return <div className="evaluation" key={result.metric}><strong>{result.metric}{result.guardrail ? <small> · guardrail</small> : null}</strong><span>{result.baseline}</span><span className="pass">{result.candidate}</span><span>{passed ? <CheckCircle2 size={15} /> : <XCircle size={15} />}</span></div>; })}<div className="stack" style={{ marginTop: 14 }}><label>Release rationale<textarea value={releaseRationale} onChange={(event) => setReleaseRationale(event.target.value)} placeholder="Summarize why this release should be promoted or held…" /></label><div className="button-row"><button className="button dark" disabled={!promotable || !releaseRationale.trim()} onClick={() => dispatch({ type: "PROMOTE", rationale: releaseRationale })}><ShieldAlert size={13} /> {state.release?.decision === "promoted" ? "Promoted" : "Promote dataset"}</button><button className="button danger" disabled={!state.release || state.release.decision !== "candidate" || !releaseRationale.trim()} onClick={() => dispatch({ type: "HOLD", rationale: releaseRationale })}><XCircle size={13} /> {state.release?.decision === "held" ? "Release held" : "Hold release"}</button></div>{!promotable && state.release?.decision === "candidate" ? <div className="notice">Promotion remains locked until critical QA gates pass, internal reviews complete, and a release exists.</div> : null}</div></article>
          </div>
        </section>
      </div>

      <nav className="mobile-nav" aria-label="Mobile workspace sections">{nav.slice(0, 7).map(([id, label, Icon]) => <a key={id} href={`#${id}`} aria-label={label}><Icon size={16} /></a>)}</nav>
    </main>
  );
}
