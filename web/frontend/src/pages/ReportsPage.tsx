import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ExternalLink, FileText, Lock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, InfoCallout, LoadingBlock, PageHeader, SourceNote } from "@/components/features/common";
import { documentUrl } from "@/services/api";
import { useReports } from "@/hooks/queries";
import { cn } from "@/lib/utils";

function statusVariant(report: { available: boolean; status: string }) {
  if (report.available) return "success" as const;
  if (report.status === "planned") return "warning" as const;
  return "neutral" as const;
}

export function ReportsPage() {
  const { data, isLoading, error, refetch } = useReports();
  const [preview, setPreview] = useState<{ title: string; key: string } | null>(null);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentation · Reports"
        title="Report library"
        description="Available experimental logs and planned documents. No report, PDF or supervisor note is invented when the artifact is absent."
        actions={<Badge variant="outline">{data.available} available</Badge>}
      />

      <InfoCallout tone="info" title="Document policy">
        Experimental summaries are available as original text logs from the results directories. Proposal,
        interim, methodology, meeting-note and dissertation entries remain planned or unavailable. PDF
        preview is shown only when a real PDF exists; none is present in the repository.
      </InfoCallout>

      <div className="grid gap-3 lg:grid-cols-2">
        {data.reports.map((report) => (
          <Card key={report.id} className={cn("p-4", report.available && "border-success/20")}>
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded border border-border bg-elevated">
                {report.available ? <FileText className="size-4 text-success" /> : <Lock className="size-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground">{report.id}</span>
                  <h2 className="text-sm font-semibold text-foreground">{report.title}</h2>
                  <Badge variant={statusVariant(report)}>{report.status}</Badge>
                  <Badge variant="outline">{report.category}</Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{report.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{report.format}</Badge>
                  {report.available && report.document_key && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setPreview({ title: report.title, key: report.document_key! })}>
                        <FileText /> Preview
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href={documentUrl(report.document_key)} target="_blank" rel="noreferrer"><Download /> Open raw</a>
                      </Button>
                    </>
                  )}
                  {report.artifact && <SourceNote source={report.artifact} />}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-foreground">Need the full research context?</div>
            <div className="text-[10px] text-muted-foreground">The dashboard's methodology and limitation views are maintained separately from report documents.</div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/methodology">Methodology</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/limitations">Limitations</Link></Button>
          </div>
        </div>
      </Card>

      <DocumentPreview preview={preview} onClose={() => setPreview(null)} />
      <SourceNote source="web/content/reports.json + results logs + data/raw readme" />
    </div>
  );
}

function DocumentPreview({
  preview,
  onClose,
}: {
  preview: { title: string; key: string } | null;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(preview);

  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    setText(null);
    setError(null);
    setLoading(true);
    fetch(documentUrl(preview.key))
      .then((response) => {
        if (!response.ok) throw new Error("Document unavailable");
        return response.text();
      })
      .then((value) => {
        if (!cancelled) setText(value);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const close = () => {
    setText(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-4xl">
        <DialogTitle>{preview?.title}</DialogTitle>
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground">Original text artifact · served read-only</div>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close preview"><X /></Button>
        </div>
        {loading && <div className="py-8 text-xs text-muted-foreground">Loading artifact…</div>}
        {error && <EmptyState title="Preview unavailable" description={error} />}
        {text && (
          <pre className="max-h-[65vh] overflow-auto rounded border border-border bg-elevated/50 p-3 font-mono text-[10px] leading-relaxed text-foreground whitespace-pre-wrap">
            {text}
          </pre>
        )}
        {preview && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={documentUrl(preview.key)} target="_blank" rel="noreferrer"><ExternalLink /> Open in new tab</a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
