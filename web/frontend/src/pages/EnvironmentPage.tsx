import { Cpu, HardDrive, Package, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, InfoCallout, LoadingBlock, PageHeader, SourceNote } from "@/components/features/common";
import { useEnvironment } from "@/hooks/queries";
import { formatDuration, formatNumber } from "@/lib/format";

export function EnvironmentPage() {
  const { data, isLoading, error, refetch } = useEnvironment();
  if (isLoading) return <LoadingBlock rows={10} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System · Research environment"
        title="Research environment and reproducibility"
        description="Verified versions and run metadata from the repository. Missing reproducibility information is listed explicitly rather than inferred."
        actions={<Badge variant="warning">{data.missing_reproducibility.length} gaps</Badge>}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3.5"><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Cpu className="size-3" /> Host</div><div className="mt-1 text-xs font-medium text-foreground">{data.host.host_os}</div><div className="text-[10px] text-muted-foreground">{data.host.operating_system}</div></Card>
        <Card className="p-3.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">GPU</div><div className="mt-1 text-xs font-medium text-foreground">{data.host.gpu}</div></Card>
        <Card className="p-3.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Python / CUDA</div><div className="mt-1 font-mono text-xs text-foreground">{data.host.python} / {data.host.cuda}</div></Card>
        <Card className="p-3.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recorded seeds</div><div className="mt-1 font-mono text-xs text-foreground">42</div><div className="text-[10px] text-muted-foreground">single-seed experiments</div></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5"><Package className="size-3.5" /> Package versions</CardTitle>
            <div className="text-xs text-muted-foreground">Read from the repository's requirements.txt where recorded.</div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border bg-elevated/40">{["Package", "Version", "Recorded"].map((header) => <th key={header} className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-muted-foreground">{header}</th>)}</tr></thead>
              <tbody>
                {data.packages.map((item) => (
                  <tr key={item.package} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-[10px] text-foreground">{item.name}<span className="ml-1 font-mono text-[9px] text-muted-foreground">{item.package}</span></td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-foreground">{item.version ?? "not recorded"}</td>
                    <td className="px-3 py-1.5"><Badge variant={item.recorded ? "success" : "warning"}>{item.recorded ? "yes" : "gap"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5"><RefreshCw className="size-3.5" /> Reproducibility protocol</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p><span className="font-medium text-foreground">Current seed:</span> {data.seeds.current_experiments.join(", ")}. <span className="font-medium text-foreground">Planned:</span> {data.seeds.planned_reproducibility.join(", ")} (E7).</p>
            <p><span className="font-medium text-foreground">Checkpoint selection:</span> best benign validation reconstruction loss; threshold calibrated on the benign validation partition at P99.</p>
            <p><span className="font-medium text-foreground">Dataset partitions:</span> chronological train → validation → benign test → attack test, with no random event-level mixing.</p>
            <p><span className="font-medium text-foreground">Encoder:</span> frozen; revision is not recorded, which limits exact reconstruction of embedding generation.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Measured run metadata</CardTitle>
          <div className="text-xs text-muted-foreground">Direct fields from per-experiment training summaries.</div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="border-b border-border bg-elevated/40">{["Experiment", "Seed", "GPU", "PyTorch", "Elapsed", "Artifact"].map((header) => <th key={header} className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-muted-foreground">{header}</th>)}</tr></thead>
            <tbody>
              {data.runs.map((run) => (
                <tr key={run.experiment} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 font-mono text-[10px] text-foreground">{run.experiment}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px]">{run.seed ?? "—"}</td>
                  <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{run.gpu ?? "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-[9px]">{run.torch_version ?? "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px]">{formatDuration(run.elapsed_seconds)}</td>
                  <td className="px-3 py-1.5"><SourceNote source={run.artifact} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><HardDrive className="size-3.5" /> Dataset partitions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(data.partitions).map(([name, partition]) => (
              <div key={name} className="flex items-center justify-between rounded border border-border px-2.5 py-2">
                <div><div className="text-[10px] font-medium text-foreground">{name.replace("_", " ")}</div><div className="text-[9px] text-muted-foreground">{formatNumber(partition.unique_descriptions)} unique descriptions</div></div>
                <div className="font-mono text-[11px] text-foreground">{formatNumber(partition.records)}</div>
              </div>
            ))}
            <SourceNote source="data/splits/cicapt-iiot/split_summary.json" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5 text-warning"><TriangleAlert className="size-3.5" /> Missing reproducibility information</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.missing_reproducibility.map((item) => (
              <div key={item} className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-warning" />{item}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <InfoCallout tone="warning" title="Reproducibility claim">
        The presence of seeds, versions and checkpoints does not guarantee bitwise GPU determinism. Results
        should be reproduced with the documented E7 protocol before being treated as stable estimates.
      </InfoCallout>
      <SourceNote source={data.source_artifact} />
    </div>
  );
}
