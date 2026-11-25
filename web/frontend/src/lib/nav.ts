import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardList,
  Compass,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TerminalSquare,
  Workflow,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Research",
    items: [
      { label: "Research story", to: "/", icon: Compass, description: "Narrative walkthrough of the findings" },
      { label: "Overview", to: "/overview", icon: LayoutDashboard, description: "Research status and headline evidence" },
      { label: "Research Objectives", to: "/objectives", icon: Target, description: "Objectives and completion state" },
      { label: "Methodology", to: "/methodology", icon: Workflow, description: "Pipeline, encoder and autoencoder" },
      { label: "Dataset Overview", to: "/dataset", icon: Database, description: "Aggregate CICAPT-IIoT structure and distributions" },
    ],
  },
  {
    label: "Experiments",
    items: [
      { label: "Experiment Registry", to: "/experiments", icon: FlaskConical, description: "All registered experiments" },
      { label: "Model Comparison", to: "/comparison", icon: GitCompareArrows, description: "Ranking and operating points" },
      { label: "Threshold Analysis", to: "/thresholds", icon: SlidersHorizontal, description: "Validation percentile sensitivity" },
      { label: "Alert Prioritisation", to: "/alerts", icon: Gauge, description: "Analyst alert-budget simulator" },
      { label: "Provenance Ablation", to: "/ablation", icon: BarChart3, description: "E5 representation comparison" },
    ],
  },
  {
    label: "Documentation",
    items: [
      { label: "Research Findings", to: "/findings", icon: ListChecks, description: "Preliminary evidence F01–F06" },
      { label: "Metric glossary", to: "/glossary", icon: BookMarked, description: "Definitions, denominators and caveats" },
      { label: "Research Roadmap", to: "/roadmap", icon: ClipboardList, description: "Milestones and dependencies" },
      { label: "Research Journal", to: "/journal", icon: BookOpen, description: "Chronological research sessions" },
      { label: "Reports", to: "/reports", icon: FileText, description: "Available logs and planned documents" },
      { label: "Limitations", to: "/limitations", icon: AlertTriangle, description: "Methodological constraints" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Architecture", to: "/architecture", icon: Cpu, description: "Research and application architecture" },
      { label: "Research Environment", to: "/environment", icon: TerminalSquare, description: "Versions and reproducibility" },
      { label: "Settings", to: "/settings", icon: Settings, description: "Appearance and data refresh" },
    ],
  },
];

export const flatNav = navGroups.flatMap((group) => group.items);

export const statusMeta = {
  completed: { label: "Completed", tone: "success" as const, icon: ShieldCheck },
  in_progress: { label: "In progress", tone: "info" as const, icon: Activity },
  next: { label: "Next", tone: "warning" as const, icon: Target },
  planned: { label: "Planned", tone: "neutral" as const, icon: ClipboardList },
  failed: { label: "Failed", tone: "error" as const, icon: AlertTriangle },
  requires_verification: { label: "Requires verification", tone: "warning" as const, icon: AlertTriangle },
};
