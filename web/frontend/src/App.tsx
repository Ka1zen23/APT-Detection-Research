import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { StoryPage } from "@/pages/StoryPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { ObjectivesPage } from "@/pages/ObjectivesPage";
import { MethodologyPage } from "@/pages/MethodologyPage";
import { DatasetPage } from "@/pages/DatasetPage";
import { ExperimentsPage } from "@/pages/ExperimentsPage";
import { ExperimentDetailPage } from "@/pages/ExperimentDetailPage";
import { ComparisonPage } from "@/pages/ComparisonPage";
import { ThresholdPage } from "@/pages/ThresholdPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { AblationPage } from "@/pages/AblationPage";
import { FindingsPage } from "@/pages/FindingsPage";
import { RoadmapPage } from "@/pages/RoadmapPage";
import { JournalPage } from "@/pages/JournalPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { LimitationsPage } from "@/pages/LimitationsPage";
import { ArchitecturePage } from "@/pages/ArchitecturePage";
import { EnvironmentPage } from "@/pages/EnvironmentPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<StoryPage />} />
      <Route element={<AppShell />}>
        <Route path="overview" element={<OverviewPage />} />
        <Route path="objectives" element={<ObjectivesPage />} />
        <Route path="methodology" element={<MethodologyPage />} />
        <Route path="dataset" element={<DatasetPage />} />
        <Route path="experiments" element={<ExperimentsPage />} />
        <Route path="experiments/:id" element={<ExperimentDetailPage />} />
        <Route path="comparison" element={<ComparisonPage />} />
        <Route path="thresholds" element={<ThresholdPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="ablation" element={<AblationPage />} />
        <Route path="findings" element={<FindingsPage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="journal/:slug" element={<JournalPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="limitations" element={<LimitationsPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="environment" element={<EnvironmentPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
