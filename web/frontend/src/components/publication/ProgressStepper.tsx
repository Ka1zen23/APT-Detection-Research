import { AlertTriangle, Check, Circle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { stepLabels, type StepStatus } from "@/lib/research-progress";
import { ProgressConnection, ResearchMotion } from "./ProgressMotion";

export interface ProgressStep {
  id: string;
  title: string;
  short?: string;
  status: StepStatus;
}

interface Props {
  steps: ProgressStep[];
  label: string;
  compact?: boolean;
  selected?: string;
  panelId?: string;
  onSelect?: (id: string) => void;
  destination?: (id: string) => string;
}

export function ProgressStepper({ steps, compact, label, selected, onSelect, panelId, destination }: Props) {
  return <ResearchMotion>
    <ol className="pub-progress-stepper" aria-label={label} data-compact={compact || undefined}>
      {steps.map((step, index) => {
        const label = `${step.title} · ${stepLabels[step.status]}`;
        const indicator = <>
          <span className="pub-step-marker" aria-hidden="true">
            {step.status === "completed" ? <Check size={15} /> : step.status === "blocked" ? <AlertTriangle size={14} /> : step.status === "failed" ? <X size={15} /> : step.status === "in_progress" ? <Circle fill="currentColor" size={9} /> : index + 1}
          </span>
          <span className="pub-step-caption"><strong>{step.short ?? step.title}</strong><small>{stepLabels[step.status]}</small></span>
        </>;
        return <li key={step.id} data-status={step.status} data-selected={selected === step.id || undefined}>
          {index < steps.length - 1 && <ProgressConnection completed={step.status === "completed" && ["completed", "next", "in_progress"].includes(steps[index + 1].status)} />}
          {onSelect
            ? <button type="button" aria-label={label} aria-controls={panelId} aria-pressed={selected === step.id} onClick={() => onSelect(step.id)}>{indicator}</button>
            : destination
              ? <Link to={destination(step.id)} aria-label={label}>{indicator}</Link>
              : <div className="pub-step-static" aria-label={label}>{indicator}</div>}
        </li>;
      })}
    </ol>
  </ResearchMotion>;
}
