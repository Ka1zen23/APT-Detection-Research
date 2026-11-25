import { lazy } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { PublicationShell } from "@/layouts/PublicationShell";
import { PublicationHome } from "@/pages/PublicationHome";

const Tour = lazy(() => import("@/pages/ResearchTourPage").then((m) => ({ default: m.ResearchTourPage })));
const ProvenanceExplorer = lazy(() => import("@/pages/ProvenanceExplorerPage").then((m) => ({ default: m.ProvenanceExplorerPage })));
const PipelinePage = lazy(() => import("@/pages/PipelinePage").then((m) => ({ default: m.PipelinePage })));
const EmbeddingExplorer = lazy(() => import("@/pages/EmbeddingExplorerPage").then((m) => ({ default: m.EmbeddingExplorerPage })));
const Findings = lazy(() => import("@/pages/PublicationFindings").then((m) => ({ default: m.PublicationFindings })));
const Progress = lazy(() => import("@/pages/PublicationReference").then((m) => ({ default: m.ProgressPage })));
const Documentation = lazy(() => import("@/pages/PublicationReference").then((m) => ({ default: m.DocumentationPage })));
const ExperimentSection = lazy(() => import("@/pages/PublicationExperiments").then((m) => ({ default: m.ExperimentSection })));
const ExperimentsLanding = lazy(() => import("@/pages/PublicationExperiments").then((m) => ({ default: m.ExperimentsLanding })));
const GuidedExperimentDetail = lazy(() => import("@/pages/PublicationExperiments").then((m) => ({ default: m.GuidedExperimentDetail })));
const GuidedComparison = lazy(() => import("@/pages/PublicationExperiments").then((m) => ({ default: m.GuidedComparison })));
const GuidedExperimentDemo = lazy(() => import("@/pages/PublicationExperiments").then((m) => ({ default: m.GuidedExperimentDemo })));
const TrainingEvidence = lazy(() => import("@/components/publication/TrainingEvidence").then((m) => ({ default: m.TrainingEvidence })));
const ArtifactExplorer = lazy(() => import("@/pages/PublicationExperiments").then((m) => ({ default: m.ArtifactExplorer })));
const Overview = lazy(() => import("@/pages/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const Registry = lazy(() => import("@/pages/ExperimentsPage").then((m) => ({ default: m.ExperimentsPage })));
const ExperimentDetail = lazy(() => import("@/pages/ExperimentDetailPage").then((m) => ({ default: m.ExperimentDetailPage })));
const Comparison = lazy(() => import("@/pages/ComparisonPage").then((m) => ({ default: m.ComparisonPage })));
const Threshold = lazy(() => import("@/pages/ThresholdPage").then((m) => ({ default: m.ThresholdPage })));
const Alerts = lazy(() => import("@/pages/AlertsPage").then((m) => ({ default: m.AlertsPage })));
const Ablation = lazy(() => import("@/pages/AblationPage").then((m) => ({ default: m.AblationPage })));
const Objectives = lazy(() => import("@/pages/ObjectivesPage").then((m) => ({ default: m.ObjectivesPage })));
const Methodology = lazy(() => import("@/pages/MethodologyPage").then((m) => ({ default: m.MethodologyPage })));
const Dataset = lazy(() => import("@/pages/DatasetPage").then((m) => ({ default: m.DatasetPage })));
const Glossary = lazy(() => import("@/pages/GlossaryPage").then((m) => ({ default: m.GlossaryPage })));
const Journal = lazy(() => import("@/pages/JournalPage").then((m) => ({ default: m.JournalPage })));
const Reports = lazy(() => import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const Limitations = lazy(() => import("@/pages/LimitationsPage").then((m) => ({ default: m.LimitationsPage })));
const Architecture = lazy(() => import("@/pages/ArchitecturePage").then((m) => ({ default: m.ArchitecturePage })));
const Environment = lazy(() => import("@/pages/EnvironmentPage").then((m) => ({ default: m.EnvironmentPage })));
const Settings = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const NotFound = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

const aliases = {
  overview: "/experiments/evidence",
  comparison: "/experiments/comparison",
  thresholds: "/experiments/thresholds",
  alerts: "/experiments/alerts",
  ablation: "/experiments/ablation",
  roadmap: "/progress",
  objectives: "/documentation/objectives",
  methodology: "/documentation/methodology",
  dataset: "/documentation/dataset",
  glossary: "/documentation/glossary",
  journal: "/documentation/journal",
  reports: "/documentation/reports",
  limitations: "/documentation/limitations",
  architecture: "/documentation/architecture",
  environment: "/documentation/environment",
  settings: "/documentation/settings",
};

function LegacyRoute({ to }: { to: string }) {
  const { search, hash } = useLocation();
  const { slug } = useParams();
  return <Navigate replace to={{ pathname: slug ? `${to}/${encodeURIComponent(slug)}` : to, search, hash }} />;
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicationShell />}>
        <Route index element={<PublicationHome />} />
        <Route path="understand" element={<Tour />} />
        <Route path="understand/provenance-explorer" element={<ProvenanceExplorer />} />
        <Route path="understand/pipeline" element={<PipelinePage />} />
        <Route path="understand/embedding-explorer" element={<EmbeddingExplorer />} />
        <Route path="understand/:chapter" element={<Tour />} />
        <Route path="findings" element={<Findings />} />
        <Route path="progress" element={<Progress />} />
        <Route path="experiments" element={<ExperimentSection />}>
          <Route index element={<ExperimentsLanding />} />
          <Route path="registry" element={<Registry />} />
          <Route path="evidence" element={<Overview />} />
          <Route path="comparison" element={<GuidedComparison technical={<Comparison />} />} />
          <Route path="training" element={<TrainingEvidence />} />
          <Route path="thresholds" element={<GuidedExperimentDemo kind="thresholds" technical={<Threshold />} />} />
          <Route path="alerts" element={<GuidedExperimentDemo kind="alerts" technical={<Alerts />} />} />
          <Route path="ablation" element={<GuidedExperimentDemo kind="ablation" technical={<Ablation />} />} />
          <Route path=":id" element={<GuidedExperimentDetail technical={<ExperimentDetail />} />} />
        </Route>
        <Route path="documentation">
          <Route index element={<Documentation />} />
          <Route path="objectives" element={<Objectives />} />
          <Route path="methodology" element={<Methodology />} />
          <Route path="dataset" element={<Dataset />} />
          <Route path="glossary" element={<Glossary />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/:slug" element={<Journal />} />
          <Route path="reports" element={<Reports />} />
          <Route path="limitations" element={<Limitations />} />
          <Route path="architecture" element={<Architecture />} />
          <Route path="environment" element={<Environment />} />
          <Route path="settings" element={<Settings />} />
          <Route path="artifacts" element={<ArtifactExplorer />} />
        </Route>
        {Object.entries(aliases).map(([path, to]) => <Route key={path} path={path} element={<LegacyRoute to={to} />} />)}
        <Route path="journal/:slug" element={<LegacyRoute to={aliases.journal} />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
