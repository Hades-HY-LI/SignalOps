"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Database,
  Download,
  FolderKanban,
  Gauge,
  Layers3,
  Plus,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import { recommendAllocation, scoreVendor } from "@/lib/domain";
import {
  buildDatasetExport,
  buildEvaluationHandoffPackage,
  datasetExportRows,
} from "@/lib/exports";
import { useWorkspace } from "@/lib/workspace";
import type {
  Project,
  ProjectHealth,
  ProjectPortfolioStage,
  VendorMetrics,
  VendorProfile,
} from "@/lib/types";
import {
  Card,
  downloadCsv,
  downloadJson,
  EmptyState,
  Modal,
  PageIntro,
  Status,
} from "./ui";
import { visibleWidgets, WidgetManager } from "./widget-manager";

type GlobalViewName = "portfolio" | "vendors" | "datasets" | "registry";

const vendorMetricWeights: Record<keyof VendorMetrics, number> = {
  quality: 30,
  expertise: 15,
  responsiveness: 10,
  improvement: 10,
  scaling: 10,
  reliability: 10,
  costEfficiency: 10,
  throughput: 5,
};

export function GlobalView({ view }: { view: GlobalViewName }) {
  if (view === "portfolio") return <Portfolio />;
  if (view === "vendors") return <Vendors />;
  if (view === "datasets") return <Datasets />;
  return <Registry />;
}

function Portfolio() {
  const { state, dispatch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [health, setHealth] = useState("all");
  const [owner, setOwner] = useState("all");
  const [modality, setModality] = useState("all");
  const [attention, setAttention] = useState(false);
  const [modal, setModal] = useState<"create" | "manage" | null>(null);
  const [edit, setEdit] = useState<Project | null>(null);
  const filtered = state.projects.filter(
    (p) =>
      `${p.name} ${p.summary}`.toLowerCase().includes(query.toLowerCase()) &&
      (stage === "all" || p.stage === stage) &&
      (health === "all" || p.health === health) &&
      (owner === "all" || p.owner === owner) &&
      (modality === "all" || p.modality === modality) &&
      (!attention || p.blockers.length > 0),
  );
  const widgets = visibleWidgets(state.portfolioConfig);
  const sourceTotals = state.projects.reduce(
    (totals, project) => {
      state.projectStates[project.id].sourcePlan.forEach((item) => {
        totals[item.source] += item.targetRecords;
      });
      return totals;
    },
    { vendor: 0, internal: 0, product: 0 },
  );
  return (
    <>
      <PageIntro
        eyebrow="Global / Portfolio"
        title="Data operations portfolio"
        description="One view across active collection programs, shared capacity, delivery risk, and release decisions."
        actions={
          <>
            <span className="sim-label">Simulated workspace</span>
            <button className="button" onClick={() => setModal("manage")}>
              <Settings2 size={14} /> Widgets
            </button>
            <button
              className="button primary"
              onClick={() => setModal("create")}
            >
              <Plus size={14} /> New project
            </button>
          </>
        }
      />
      <div className="preset-bar">
        <div className="preset-copy">
          <strong>Dashboard view</strong>
          <small>
            Switches the visible KPI set. Use Widgets to customize it.
          </small>
        </div>
        {(["executive", "operations"] as const).map((p) => (
          <button
            key={p}
            className={state.portfolioConfig.preset === p ? "active" : ""}
            aria-pressed={state.portfolioConfig.preset === p}
            title={`Show the ${p} dashboard preset`}
            onClick={() =>
              dispatch({
                type: "SET_DASHBOARD_PRESET",
                scope: "portfolio",
                preset: p,
              })
            }
          >
            {p}
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        {widgets.map((w) => (
          <PortfolioWidget key={w.id} id={w.id} />
        ))}
      </div>
      <Card className="route-section">
        <div className="card-header">
          <div>
            <h3>Workspace sourcing summary</h3>
            <p className="subtle">
              Planned records across every project workspace.
            </p>
          </div>
          <span className="calc-label sim-label">Live calculation</span>
        </div>
        <div className="grid grid-3 mini-stats">
          <div>
            <span>Vendor</span>
            <b>{sourceTotals.vendor.toLocaleString()}</b>
          </div>
          <div>
            <span>In-house</span>
            <b>{sourceTotals.internal.toLocaleString()}</b>
          </div>
          <div>
            <span>Product</span>
            <b>{sourceTotals.product.toLocaleString()}</b>
          </div>
        </div>
      </Card>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
          />
        </label>
        <FilterSelect
          label="Stage"
          value={stage}
          onChange={setStage}
          values={[
            "all",
            "planning",
            "collecting",
            "quality_review",
            "release_ready",
            "promoted",
          ]}
        />
        <FilterSelect
          label="Health"
          value={health}
          onChange={setHealth}
          values={["all", "healthy", "at_risk", "blocked"]}
        />
        <FilterSelect
          label="Owner"
          value={owner}
          onChange={setOwner}
          values={["all", ...new Set(state.projects.map((p) => p.owner))]}
        />
        <FilterSelect
          label="Modality"
          value={modality}
          onChange={setModality}
          values={["all", ...new Set(state.projects.map((p) => p.modality))]}
        />
        <button
          className={`button ${attention ? "primary" : ""}`}
          onClick={() => setAttention(!attention)}
        >
          <AlertTriangle size={14} /> Needs attention
        </button>
      </div>
      {filtered.length ? (
        <div className="project-grid">
          {filtered.map((project) => (
            <Card className="project-card" key={project.id}>
              <div className="card-header">
                <Status value={project.health} />
                <span className="sim-label">Seeded</span>
              </div>
              <h2>{project.name}</h2>
              <p>{project.summary}</p>
              <div className="project-progress">
                <span style={{ width: `${project.releaseReadiness}%` }} />
              </div>
              <div className="grid grid-3 mini-stats">
                <div>
                  <span>Readiness</span>
                  <b>{project.releaseReadiness}%</b>
                </div>
                <div>
                  <span>Records</span>
                  <b>{project.recordVolume.toLocaleString()}</b>
                </div>
                <div>
                  <span>Budget</span>
                  <b>${project.budget.toLocaleString()}</b>
                </div>
              </div>
              <div className="decision-line">
                <span>Next decision</span>
                <strong>{project.nextDecision}</strong>
              </div>
              <footer>
                <button
                  className="button small"
                  onClick={() => setEdit(project)}
                >
                  Edit
                </button>
                <Link
                  className="button dark"
                  href={`/projects/${project.id}/mission`}
                  onClick={() =>
                    dispatch({ type: "SWITCH_PROJECT", projectId: project.id })
                  }
                >
                  Open project <ArrowRight size={13} />
                </Link>
              </footer>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderKanban />}
          title="No matching projects"
          text="Clear one or more filters to expand the portfolio view."
        />
      )}
      {modal === "manage" ? (
        <WidgetManager
          config={state.portfolioConfig}
          scope="portfolio"
          dispatch={dispatch}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal === "create" ? (
        <ProjectModal onClose={() => setModal(null)} />
      ) : null}
      {edit ? (
        <ProjectModal project={edit} onClose={() => setEdit(null)} />
      ) : null}
    </>
  );
}

function PortfolioWidget({ id }: { id: string }) {
  const { state } = useWorkspace();
  const data: { [key: string]: [string, string, string, React.ReactNode] } = {
    project_health: [
      "Project health",
      `${state.projects.filter((p) => p.health === "healthy").length}/${state.projects.length}`,
      "Healthy projects",
      <Gauge key="a" />,
    ],
    deadlines: [
      "Nearest deadline",
      "5 days",
      "Unexpected Vocals",
      <AlertTriangle key="b" />,
    ],
    budgets: [
      "Active budget",
      `$${state.projects.reduce((n, p) => n + p.budget, 0).toLocaleString()}`,
      "Across all projects",
      <BarChart3 key="c" />,
    ],
    capacity: ["Vendor capacity", "44k", "Weekly records", <Users key="d" />],
    blockers: [
      "Open blockers",
      String(state.projects.reduce((n, p) => n + p.blockers.length, 0)),
      "Needs operating attention",
      <AlertTriangle key="e" />,
    ],
    source_mix: [
      "Records collected",
      state.projects.reduce((n, p) => n + p.recordVolume, 0).toLocaleString(),
      "Across three source paths",
      <Layers3 key="f" />,
    ],
  };
  const d = data[id];
  return (
    <Card className="kpi-widget">
      <div className="widget-icon">{d[3]}</div>
      <span>{d[0]}</span>
      <strong>{d[1]}</strong>
      <p>{d[2]}</p>
    </Card>
  );
}

function ProjectModal({
  project,
  onClose,
}: {
  project?: Project;
  onClose: () => void;
}) {
  const { dispatch } = useWorkspace();
  const [name, setName] = useState(project?.name ?? "");
  const [summary, setSummary] = useState(project?.summary ?? "");
  const [owner, setOwner] = useState(project?.owner ?? "");
  const [modality, setModality] = useState(project?.modality ?? "audio");
  const [health, setHealth] = useState<ProjectHealth>(
    project?.health ?? "healthy",
  );
  const [stage, setStage] = useState<ProjectPortfolioStage>(
    project?.stage ?? "planning",
  );
  const [deadline, setDeadline] = useState(project?.deadline ?? "2026-09-30");
  const [budget, setBudget] = useState(String(project?.budget ?? 0));
  const [targetVolume, setTargetVolume] = useState(
    String(project?.targetVolume ?? 0),
  );
  const save = () => {
    if (!name.trim() || !summary.trim() || !owner.trim()) return;
    if (project)
      dispatch({
        type: "EDIT_PROJECT",
        projectId: project.id,
        changes: {
          name,
          summary,
          owner,
          modality,
          health,
          stage,
          deadline,
          budget: Math.max(0, Number(budget)),
          targetVolume: Math.max(0, Number(targetVolume)),
        },
      });
    else
      dispatch({
        type: "ADD_PROJECT",
        project: {
          name,
          summary,
          owner,
          researchOwner: owner,
          productOwner: owner,
          health,
          stage,
          modality,
          deadline,
          budget: Math.max(0, Number(budget)),
          targetVolume: Math.max(0, Number(targetVolume)),
          blockers: [],
          nextDecision: "Publish initial requirement",
        },
      });
    onClose();
  };
  return (
    <Modal
      title={project ? "Edit project" : "Create project"}
      description="Portfolio fields can be refined at any time."
      onClose={onClose}
    >
      <div className="form-stack">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Summary
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Owner
            <input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label>
            Modality
            <input
              value={modality}
              onChange={(e) => setModality(e.target.value)}
            />
          </label>
          <label>
            Health
            <select
              value={health}
              onChange={(event) =>
                setHealth(event.target.value as ProjectHealth)
              }
            >
              <option value="healthy">Healthy</option>
              <option value="at_risk">At risk</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label>
            Stage
            <select
              value={stage}
              onChange={(event) =>
                setStage(event.target.value as ProjectPortfolioStage)
              }
            >
              <option value="planning">Planning</option>
              <option value="collecting">Collecting</option>
              <option value="quality_review">Quality review</option>
              <option value="release_ready">Release ready</option>
              <option value="promoted">Promoted</option>
              <option value="held">Held</option>
            </select>
          </label>
          <label>
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
          <label>
            Budget
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </label>
          <label>
            Target volume
            <input
              type="number"
              min="0"
              value={targetVolume}
              onChange={(event) => setTargetVolume(event.target.value)}
            />
          </label>
        </div>
      </div>
      <footer className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button dark"
          disabled={!name || !summary || !owner}
          onClick={save}
        >
          Save project
        </button>
      </footer>
    </Modal>
  );
}

function Vendors() {
  const { state } = useWorkspace();
  const [q, setQ] = useState("");
  const [cap, setCap] = useState("all");
  const [avail, setAvail] = useState("all");
  const [modality, setModality] = useState("all");
  const [locale, setLocale] = useState("all");
  const [recommendation, setRecommendation] = useState("all");
  const [selected, setSelected] = useState<VendorProfile | null>(null);
  const [add, setAdd] = useState(false);
  const recs = useMemo(
    () => recommendAllocation(state.vendors),
    [state.vendors],
  );
  const list = state.vendors.filter(
    (v) =>
      `${v.name} ${v.specialty}`.toLowerCase().includes(q.toLowerCase()) &&
      (cap === "all" || v.capabilities?.includes(cap as never)) &&
      (avail === "all" || v.availability === avail) &&
      (modality === "all" || v.modalities?.includes(modality)) &&
      (locale === "all" || v.locales?.includes(locale)) &&
      (recommendation === "all" ||
        recs.find((item) => item.vendorId === v.id)?.recommendation ===
          recommendation),
  );
  return (
    <>
      <PageIntro
        eyebrow="Global / Vendor network"
        title="Vendor directory"
        description="Compare expertise, operating fit, economics, availability, and performance history."
        actions={
          <button className="button primary" onClick={() => setAdd(true)}>
            <Plus size={14} /> Add vendor
          </button>
        }
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendors"
            aria-label="Search vendors"
          />
        </label>
        <FilterSelect
          label="Capability"
          value={cap}
          onChange={setCap}
          values={[
            "all",
            "vocals",
            "music_preference",
            "instrumental_sound",
            "speech",
            "sound_effects",
            "multilingual",
            "expert_review",
            "ranking",
            "ai_agent_review",
          ]}
        />
        <FilterSelect
          label="Availability"
          value={avail}
          onChange={setAvail}
          values={["all", "available", "limited", "unavailable"]}
        />
        <FilterSelect
          label="Modality"
          value={modality}
          onChange={setModality}
          values={[
            "all",
            ...new Set(state.vendors.flatMap((v) => v.modalities ?? [])),
          ]}
        />
        <FilterSelect
          label="Locale"
          value={locale}
          onChange={setLocale}
          values={[
            "all",
            ...new Set(state.vendors.flatMap((v) => v.locales ?? [])),
          ]}
        />
        <FilterSelect
          label="Recommendation"
          value={recommendation}
          onChange={setRecommendation}
          values={["all", "expand", "maintain", "remediate", "pause"]}
        />
      </div>
      <div className="project-grid">
        {list.map((v) => {
          const r = recs.find((x) => x.vendorId === v.id)!;
          return (
            <Card className="project-card" key={v.id}>
              <div className="card-header">
                <Status value={v.availability ?? "available"} />
                <Status value={r.recommendation} />
              </div>
              <h2>{v.name}</h2>
              <p>{v.specialty}</p>
              <div className="score-line">
                <strong>{scoreVendor(v.metrics)}</strong>
                <span>weighted score</span>
              </div>
              <div className="tag-row">
                {v.capabilities?.map((x) => (
                  <span className="tag" key={x}>
                    {x.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
              <div className="grid grid-3 mini-stats">
                <div>
                  <span>Capacity</span>
                  <b>{v.weeklyCapacity.toLocaleString()}</b>
                </div>
                <div>
                  <span>Utilization</span>
                  <b>{Math.round((v.utilization ?? 0) * 100)}%</b>
                </div>
                <div>
                  <span>Rate</span>
                  <b>${v.rate}</b>
                </div>
              </div>
              <footer>
                <button className="button dark" onClick={() => setSelected(v)}>
                  View profile <ArrowRight size={13} />
                </button>
              </footer>
            </Card>
          );
        })}
      </div>
      {selected ? (
        <VendorModal vendor={selected} onClose={() => setSelected(null)} />
      ) : null}
      {add ? <VendorModal onClose={() => setAdd(false)} /> : null}
    </>
  );
}

function VendorModal({
  vendor,
  onClose,
}: {
  vendor?: VendorProfile;
  onClose: () => void;
}) {
  const { state, dispatch } = useWorkspace();
  const [name, setName] = useState(vendor?.name ?? "");
  const [specialty, setSpecialty] = useState(vendor?.specialty ?? "");
  const [rate, setRate] = useState(String(vendor?.rate ?? 0.5));
  const pilots = state.vendorPilots.filter((p) => p.vendorId === vendor?.id);
  const engagements = Object.values(state.projectStates).flatMap(
    (projectState) =>
      projectState.vendorEngagements.filter(
        (engagement) => engagement.vendorId === vendor?.id,
      ),
  );
  const save = () => {
    if (!name || !specialty) return;
    const base: VendorProfile = vendor ?? {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      specialty,
      rate: Number(rate),
      weeklyCapacity: 5000,
      metrics: {
        quality: 80,
        reliability: 80,
        costEfficiency: 80,
        throughput: 80,
        expertise: 80,
        responsiveness: 80,
        improvement: 80,
        scaling: 80,
      },
      history: [],
      capabilities: ["expert_review"],
      modalities: ["audio"],
      locales: ["en"],
      availability: "available",
      utilization: 0.5,
      rateBand: "standard",
    };
    if (vendor)
      dispatch({
        type: "EDIT_VENDOR",
        vendorId: vendor.id,
        changes: { name, specialty, rate: Number(rate) },
      });
    else
      dispatch({
        type: "ADD_VENDOR",
        vendor: { ...base, name, specialty, rate: Number(rate) },
      });
    onClose();
  };
  return (
    <Modal
      title={vendor ? `${vendor.name} profile` : "Add vendor"}
      description={
        vendor
          ? "Performance, fit, and pilot history"
          : "Create a reusable directory profile."
      }
      onClose={onClose}
    >
      <div className="form-grid">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Specialty
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
        </label>
        <label>
          Rate / record
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
      </div>
      {vendor ? (
        <>
          <h3 className="subsection-title">Eight-metric score</h3>
          <div className="metric-breakdown">
            {Object.entries(vendor.metrics).map(([k, v]) => (
              <div key={k}>
                <span>
                  {k.replaceAll(/([A-Z])/g, " $1")} ·{" "}
                  {vendorMetricWeights[k as keyof VendorMetrics]}%
                </span>
                <div className="progress">
                  <i style={{ width: `${v}%` }} />
                </div>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <div className="grid grid-3 mini-stats">
            <div>
              <span>Weekly capacity</span>
              <b>{vendor.weeklyCapacity.toLocaleString()}</b>
            </div>
            <div>
              <span>Utilization</span>
              <b>{Math.round((vendor.utilization ?? 0) * 100)}%</b>
            </div>
            <div>
              <span>Rate band</span>
              <b>{vendor.rateBand ?? "standard"}</b>
            </div>
          </div>
          <h3 className="subsection-title">Historical quality trend</h3>
          {vendor.history.map((point) => (
            <div className="kv" key={point.period}>
              <span>{point.period}</span>
              <b>{point.quality}% quality</b>
            </div>
          ))}
          <h3 className="subsection-title">Project engagements</h3>
          {engagements.length ? (
            engagements.map((engagement) => (
              <div className="kv" key={engagement.id}>
                <span>
                  {
                    state.projects.find(
                      (project) => project.id === engagement.projectId,
                    )?.name
                  }{" "}
                  · {engagement.workPackageVersion}
                </span>
                <Status value={engagement.status} />
              </div>
            ))
          ) : (
            <p className="subtle">No active project engagements.</p>
          )}
          <h3 className="subsection-title">Pilot history</h3>
          {pilots.length ? (
            pilots.map((p) => (
              <div className="engagement" key={p.id}>
                <div className="card-header">
                  <strong>
                    {p.version} · {p.workPackageVersion}
                  </strong>
                  <Status value={p.decision} />
                </div>
                <div className="pilot-grid">
                  <span>{p.taskCount} tasks</span>
                  <b>${p.unitCost}/task</b>
                  <b>${p.totalCost} total</b>
                  <b>
                    {p.startDate} → {p.endDate}
                  </b>
                  <b>
                    {p.turnaroundHours}h · {p.throughputPerDay}/day
                  </b>
                  <b>
                    {Math.round(p.quality * 100)}% quality ·{" "}
                    {Math.round(p.goldAccuracy * 100)}% gold
                  </b>
                  <span>{p.remediationCount} remediations</span>
                </div>
              </div>
            ))
          ) : (
            <p className="subtle">No pilots recorded.</p>
          )}
        </>
      ) : null}
      <footer className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button className="button dark" onClick={save}>
          Save vendor
        </button>
      </footer>
    </Modal>
  );
}

function Datasets() {
  const { state, dispatch } = useWorkspace();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selected, setSelected] = useState(state.datasets[0]?.id ?? "");
  const [due, setDue] = useState("2026-08-30");
  const [evaluationOwners, setEvaluationOwners] = useState<
    "research" | "ml" | "both"
  >("both");
  const [targetMetric, setTargetMetric] = useState("Primary quality metric");
  const [guardrail, setGuardrail] = useState("Prompt adherence");
  const [slices, setSlices] = useState("all");
  const [method, setMethod] = useState("Structured evaluation");
  const [decisionRequest, setDecisionRequest] = useState(
    "Confirm release readiness.",
  );
  const [delivery, setDelivery] = useState<"download" | "simulated_connector">(
    "simulated_connector",
  );
  const list = state.datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(q.toLowerCase()) &&
      (status === "all" || d.releaseState === status) &&
      (projectFilter === "all" || d.projectId === projectFilter),
  );
  const dataset = state.datasets.find((d) => d.id === selected);
  const handoff = state.evaluationHandoffs.find(
    (h) => h.datasetId === dataset?.id,
  );
  return (
    <>
      <PageIntro
        eyebrow="Global / Dataset registry"
        title="Datasets & evaluation"
        description="Trace versioned releases from source mix through evaluation and final decision."
      />
      <div className="split-layout">
        <Card>
          <div className="filter-bar compact">
            <label className="search-field">
              <Search size={15} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search datasets"
                aria-label="Search datasets"
              />
            </label>
            <FilterSelect
              label="State"
              value={status}
              onChange={setStatus}
              values={["all", "candidate", "promoted", "held"]}
            />
            <FilterSelect
              label="Project"
              value={projectFilter}
              onChange={setProjectFilter}
              values={["all", ...state.projects.map((project) => project.id)]}
            />
          </div>
          {list.length ? (
            list.map((d) => (
              <button
                className="list-row"
                aria-pressed={selected === d.id}
                key={d.id}
                onClick={() => setSelected(d.id)}
              >
                <span>
                  <strong>
                    {d.name} · {d.version}
                  </strong>
                  <small>
                    {d.recordCount.toLocaleString()} records · {d.owner}
                  </small>
                </span>
                <Status value={d.releaseState} />
              </button>
            ))
          ) : (
            <EmptyState
              icon={<Database />}
              title="No matching datasets"
              text="Adjust filters or create a project release."
            />
          )}
        </Card>
        <Card>
          {dataset ? (
            <>
              <div className="card-header">
                <div>
                  <h2>{dataset.name}</h2>
                  <p className="subtle mono">{dataset.id}</p>
                </div>
                <Status value={dataset.releaseState} />
              </div>
              <div className="grid grid-3 mini-stats">
                <div>
                  <span>Records</span>
                  <b>{dataset.recordCount.toLocaleString()}</b>
                </div>
                <div>
                  <span>QA</span>
                  <b>{dataset.qaStatus}</b>
                </div>
                <div>
                  <span>Requirement</span>
                  <b>{dataset.requirementVersion}</b>
                </div>
              </div>
              <div className="tag-row">
                {dataset.sources.map((x) => (
                  <span className="tag" key={x}>
                    {x}
                  </span>
                ))}
              </div>
              <h3 className="subsection-title">Source mix & evidence</h3>
              {Object.entries(dataset.sourceCounts).map(([source, count]) => (
                <div className="kv" key={source}>
                  <span>{source}</span>
                  <b>{count.toLocaleString()} records</b>
                </div>
              ))}
              <div className="kv">
                <span>Excluded records</span>
                <b>{dataset.exclusions.length}</b>
              </div>
              <div className="kv">
                <span>Evaluation state</span>
                <Status value={dataset.evaluationStatus} />
              </div>
              <div className="kv">
                <span>Latest decision</span>
                <b>{dataset.latestDecision}</b>
              </div>
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => {
                    dispatch({
                      type: "RECORD_DATASET_DOWNLOAD",
                      datasetId: dataset.id,
                      format: "json",
                    });
                    downloadJson(
                      `${dataset.id}-record-manifest.json`,
                      buildDatasetExport(dataset),
                    );
                  }}
                >
                  <Download size={14} /> Record manifest JSON
                </button>
                <button
                  className="button"
                  onClick={() => {
                    dispatch({
                      type: "RECORD_DATASET_DOWNLOAD",
                      datasetId: dataset.id,
                      format: "csv",
                    });
                    downloadCsv(
                      `${dataset.id}-records.csv`,
                      datasetExportRows(dataset),
                    );
                  }}
                >
                  <Download size={14} /> Record manifest CSV
                </button>
              </div>
              <h3 className="subsection-title">Download history</h3>
              {dataset.downloadHistory.length ? (
                dataset.downloadHistory.map((item, index) => (
                  <div className="kv" key={`${item.downloadedAt}-${index}`}>
                    <span>{item.format.toUpperCase()}</span>
                    <b>{item.downloadedAt.slice(0, 10)}</b>
                  </div>
                ))
              ) : (
                <p className="subtle">No downloads recorded.</p>
              )}
              <h3 className="subsection-title">Evaluation handoff</h3>
              {handoff ? (
                <div className="notice">
                  <Status value={handoff.status} /> <b>{handoff.method}</b>
                  <p>
                    This package tells Research or ML which immutable dataset to
                    read, where each record lives, which metrics to run, and how
                    to return results.
                  </p>
                  <div className="handoff-route">
                    <span>Dataset manifest</span>
                    <ArrowRight size={13} />
                    <span>{handoff.delivery.replaceAll("_", " ")}</span>
                    <ArrowRight size={13} />
                    <span>{handoff.owners.join(" + ")}</span>
                    <ArrowRight size={13} />
                    <span>Result callback</span>
                  </div>
                  <div className="button-row">
                    <button
                      className="button small"
                      onClick={() =>
                        downloadJson(
                          `${handoff.id}-evaluation-package.json`,
                          buildEvaluationHandoffPackage(dataset, handoff),
                        )
                      }
                    >
                      <Download size={13} /> Download complete eval package
                    </button>
                  </div>
                  {handoff.results.map((result) => (
                    <div className="kv" key={result.metric}>
                      <span>
                        {result.metric} · {result.value}
                      </span>
                      <Status value={result.passed ? "passed" : "blocked"} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="form-stack">
                  <label>
                    Evaluation owners
                    <select
                      value={evaluationOwners}
                      onChange={(event) =>
                        setEvaluationOwners(
                          event.target.value as "research" | "ml" | "both",
                        )
                      }
                    >
                      <option value="both">Research + ML</option>
                      <option value="research">Research</option>
                      <option value="ml">ML</option>
                    </select>
                  </label>
                  <label>
                    Target metric
                    <input
                      value={targetMetric}
                      onChange={(event) => setTargetMetric(event.target.value)}
                    />
                  </label>
                  <label>
                    Guardrail
                    <input
                      value={guardrail}
                      onChange={(event) => setGuardrail(event.target.value)}
                    />
                  </label>
                  <label>
                    Slices
                    <input
                      value={slices}
                      onChange={(event) => setSlices(event.target.value)}
                    />
                  </label>
                  <label>
                    Method
                    <input
                      value={method}
                      onChange={(event) => setMethod(event.target.value)}
                    />
                  </label>
                  <label>
                    Decision request
                    <textarea
                      value={decisionRequest}
                      onChange={(event) =>
                        setDecisionRequest(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      type="date"
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </label>
                  <label>
                    Delivery
                    <select
                      value={delivery}
                      onChange={(event) =>
                        setDelivery(
                          event.target.value as
                            | "download"
                            | "simulated_connector",
                        )
                      }
                    >
                      <option value="download">Download package</option>
                      <option value="simulated_connector">
                        Simulated connector
                      </option>
                    </select>
                  </label>
                  <button
                    className="button primary"
                    disabled={
                      dataset.releaseState !== "candidate" ||
                      dataset.qaStatus !== "passed"
                    }
                    onClick={() =>
                      dispatch({
                        type: "CREATE_EVALUATION_HANDOFF",
                        projectId: dataset.projectId,
                        handoff: {
                          datasetId: dataset.id,
                          owners:
                            evaluationOwners === "both"
                              ? ["research", "ml"]
                              : [evaluationOwners],
                          targetMetrics: [targetMetric],
                          guardrails: [guardrail],
                          slices: slices
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                          dueDate: due,
                          method,
                          decisionRequest,
                          delivery,
                        },
                      })
                    }
                  >
                    Create handoff
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Database />}
              title="Select a dataset"
              text="Choose a version to inspect lineage and evaluation state."
            />
          )}
        </Card>
      </div>
    </>
  );
}

function Registry() {
  const { state, dispatch } = useWorkspace();
  const [kind, setKind] = useState("all");
  const [guide, setGuide] = useState<string | null>(null);
  const list = state.registryEntries.filter(
    (e) => kind === "all" || e.kind === kind,
  );
  return (
    <>
      <PageIntro
        eyebrow="Global / Registry"
        title="Workflow & integration registry"
        description="Reusable workflow definitions and connector contracts assigned across projects."
        actions={<span className="sim-label">No external execution</span>}
      />
      <div className="filter-bar">
        <FilterSelect
          label="Type"
          value={kind}
          onChange={setKind}
          values={[
            "all",
            "workflow",
            "annotation_platform",
            "api",
            "webhook",
            "object_storage",
            "product_event",
          ]}
        />
      </div>
      <div className="registry-grid">
        {list.map((entry) => (
          <Card className="registry-card" key={entry.id}>
            <div className="card-header">
              <span className="widget-icon">
                {entry.kind === "workflow" ? (
                  <Layers3 size={17} />
                ) : (
                  <Boxes size={17} />
                )}
              </span>
              <Status value={entry.status} />
            </div>
            <h2>{entry.name}</h2>
            <p>{entry.description}</p>
            <div className="tag-row">
              {entry.capabilities.map((c) => (
                <span className="tag" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <footer>
              <div>
                <span className="mono subtle">{entry.version}</span>
                <span className="subtle">
                  {entry.assignedProjectIds.length
                    ? `${entry.assignedProjectIds.length} assigned`
                    : "Unassigned"}
                </span>
              </div>
              {entry.assignedProjectIds.includes(state.activeProjectId) ? (
                <Status value="complete" />
              ) : (
                <button
                  className="button small"
                  onClick={() =>
                    dispatch({
                      type: "ASSIGN_REGISTRY_ENTRY",
                      projectId: state.activeProjectId,
                      entryId: entry.id,
                    })
                  }
                >
                  Assign active project
                </button>
              )}
            </footer>
            <button
              className="button connector-guide-button"
              onClick={() => setGuide(guide === entry.id ? null : entry.id)}
              aria-expanded={guide === entry.id}
            >
              {guide === entry.id ? "Hide connection guide" : "How to connect"}
            </button>
            {guide === entry.id ? <ConnectionGuide entry={entry} /> : null}
          </Card>
        ))}
      </div>
    </>
  );
}

function ConnectionGuide({
  entry,
}: {
  entry: ReturnType<typeof useWorkspace>["state"]["registryEntries"][number];
}) {
  const connector = connectorBlueprint(entry.kind, entry.id);
  return (
    <div className="connection-guide">
      <div className="eyebrow">Connection contract</div>
      <div className="kv">
        <span>Transport</span>
        <b>{connector.transport}</b>
      </div>
      <div className="kv">
        <span>Authentication</span>
        <b>{connector.auth}</b>
      </div>
      <div className="kv">
        <span>Data sent</span>
        <b>{connector.input}</b>
      </div>
      <div className="kv">
        <span>Data returned</span>
        <b>{connector.output}</b>
      </div>
      <ol>
        {connector.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button
        className="button small"
        onClick={() =>
          downloadJson(`${entry.id}-contract.json`, {
            schema_version: "signalops.connector.v1",
            registry_entry: entry,
            connection: connector,
            execution: "simulated",
          })
        }
      >
        <Download size={13} /> Download connector contract
      </button>
    </div>
  );
}

function connectorBlueprint(kind: string, id: string) {
  if (kind === "workflow")
    return {
      transport: "Assigned definition",
      auth: "Workspace access",
      input: "Requirement, rubric, source schema",
      output: "Versioned decisions and QA evidence",
      steps: [
        "Assign the definition to a project.",
        "Map project artifacts to workflow inputs.",
        "Publish a version, then validate entry and exit criteria.",
      ],
    };
  if (kind === "annotation_platform")
    return {
      transport: "REST batch API + webhook",
      auth: "Scoped bearer token",
      input: "Work package JSON and signed asset URIs",
      output: "Completed labels, provenance, and QC metadata",
      steps: [
        "Configure the vendor platform endpoint.",
        "Export a versioned work package.",
        "Register the delivery webhook and test a synthetic batch.",
      ],
    };
  if (kind === "object_storage")
    return {
      transport: "Object-storage manifest",
      auth: "Short-lived signed URLs",
      input: "JSONL manifest and media objects",
      output: "Result manifest under the configured prefix",
      steps: [
        "Set input and result prefixes.",
        "Grant least-privilege read/write access.",
        "Validate manifest checksums before import.",
      ],
    };
  if (kind === "product_event")
    return {
      transport: "Event stream",
      auth: "Service identity",
      input: "Explicit and implicit product events",
      output: "Normalized eligible signals",
      steps: [
        "Register the event schema.",
        "Map consent and eligibility fields.",
        "Route accepted events into the project quality layer.",
      ],
    };
  return {
    transport: kind === "webhook" ? "HTTPS webhook" : "REST API",
    auth: "HMAC signature or scoped token",
    input: "Versioned request and dataset manifest",
    output: "Status events and structured results",
    steps: [
      `Configure ${id} in the target system.`,
      "Download and implement the contract below.",
      "Send a synthetic request and verify the callback payload.",
    ],
  };
}

function FilterSelect({
  label,
  value,
  onChange,
  values,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  values: string[];
}) {
  return (
    <label className="filter-select">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {values.map((v) => (
          <option value={v} key={v}>
            {v === "all"
              ? `All ${label.toLowerCase()}s`
              : v.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
