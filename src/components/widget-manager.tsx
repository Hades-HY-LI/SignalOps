"use client";
import { ArrowDown, ArrowUp, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import type { DashboardWidget, MissionControlConfig } from "@/lib/types";
import type { WorkspaceAction } from "@/lib/workspace";
import { Modal } from "./ui";

const labels: Record<string,string> = { project_health:"Project health",deadlines:"Deadlines",budgets:"Budgets",capacity:"Capacity",blockers:"Blockers",source_mix:"Source mix",target_metric:"Target metric",release_readiness:"Release readiness",source_status:"Source status",quality_status:"Quality status",owners:"Owners" };

export function WidgetManager({ config, scope, projectId, dispatch, onClose }: { config: MissionControlConfig; scope:"portfolio"|"project"; projectId?:string; dispatch: React.Dispatch<WorkspaceAction>; onClose:()=>void }) {
  return <Modal title="Manage dashboard" description="Choose what appears and adjust the reading order." onClose={onClose}><div className="widget-manager">{config.widgets.map((widget,index)=><div className="widget-row" key={widget.id}><button className="icon-button" onClick={()=>dispatch({type:"TOGGLE_WIDGET",scope,widgetId:widget.id,projectId})} aria-label={`${widget.visible?"Hide":"Show"} ${labels[widget.id]}`}>{widget.visible?<Eye size={16}/>:<EyeOff size={16}/>}</button><span>{labels[widget.id]}</span><button className="icon-button" disabled={index===0} onClick={()=>dispatch({type:"MOVE_WIDGET",scope,widgetId:widget.id,direction:"up",projectId})} aria-label={`Move ${labels[widget.id]} up`}><ArrowUp size={15}/></button><button className="icon-button" disabled={index===config.widgets.length-1} onClick={()=>dispatch({type:"MOVE_WIDGET",scope,widgetId:widget.id,direction:"down",projectId})} aria-label={`Move ${labels[widget.id]} down`}><ArrowDown size={15}/></button></div>)}</div><footer className="modal-actions"><button className="button dark" onClick={onClose}><SlidersHorizontal size={14}/> Done</button></footer></Modal>;
}

export function visibleWidgets(config: MissionControlConfig): DashboardWidget[] { return config.widgets.filter((item)=>item.visible); }
