import { Link } from "react-router-dom";
import { ArrowRight, Database, Lock, Server, ShieldCheck, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, InfoCallout, LoadingBlock, PageHeader, SectionHeading, SourceNote } from "@/components/features/common";
import { useArchitecture } from "@/hooks/queries";

export function ArchitecturePage() {
  const { data, isLoading, error, refetch } = useArchitecture();
  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System, Architecture"
        title="Research and application architecture"
        description="The dashboard is an isolated read-only presentation layer over existing research artifacts. It does not train, retrain or execute models."
        actions={<Badge variant="success">Read-only</Badge>}
      />

      <InfoCallout tone="info" title="Separation of concerns">
        {data.summary}
      </InfoCallout>

      <Card>
        <CardHeader>
          <CardTitle>Application layers</CardTitle>
          <div className="text-xs text-muted-foreground">Request path from stored research artifact to rendered dashboard.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.layers.map((layer, index) => (
            <div key={layer.title} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="grid size-6 shrink-0 place-items-center rounded border border-primary/25 bg-primary/5 font-mono text-[12px] text-primary">{index + 1}</div>
                {index < data.layers.length - 1 && <div className="h-full w-px bg-border" />}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="text-xs font-semibold text-foreground">{layer.title}</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{layer.description}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5"><Workflow className="size-3.5" /> Data flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.data_flow.map((step, index) => (
              <div key={step} className="flex items-center gap-2 rounded border border-border px-2.5 py-2">
                <span className="font-mono text-[12px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[13px] text-foreground">{step}</span>
                {index < data.data_flow.length - 1 && <ArrowRight className="ml-auto size-3 text-muted-foreground/50" />}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5"><Lock className="size-3.5" /> Read-only boundaries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.boundaries.map((boundary) => (
              <div key={boundary} className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3 shrink-0 text-success" />
                {boundary}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Server className="size-3.5" /> Backend stack</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {data.stack.backend.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
            <div className="mt-2 w-full text-[12px] leading-relaxed text-muted-foreground">
              Versioned /api/v1 endpoints, Pydantic response models, allowlisted artifact roots, bounded pagination and mtime-aware caching.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-1.5"><Database className="size-3.5" /> Frontend stack</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {data.stack.frontend.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
            <div className="mt-2 w-full text-[12px] leading-relaxed text-muted-foreground">
              TanStack Query reads the exported static snapshot; Recharts renders measured series. Individual provenance events are excluded from the public bundle.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeading title="Operational guarantees" description="What the API will and will not do." />
        <div className="grid gap-2 text-[12px] leading-relaxed text-muted-foreground md:grid-cols-2">
          <div className="rounded border border-success/15 bg-success/5 p-2.5"><span className="font-medium text-success">Will:</span> read JSON/CSV/Parquet under explicit roots, compute curves from stored scores, serve allowlisted figures and text documents, cache in memory.</div>
          <div className="rounded border border-error/15 bg-error/5 p-2.5"><span className="font-medium text-error">Will not:</span> accept client filesystem paths, load checkpoints, execute research scripts, retrain models, write into results/, data/ or models/, or expose environment secrets.</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/environment">Reproducibility details <ArrowRight /></Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/methodology">Research pipeline</Link></Button>
        </div>
        <SourceNote className="mt-2" source="web/content/architecture.json" />
      </Card>
    </div>
  );
}
