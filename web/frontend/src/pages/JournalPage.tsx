import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BookOpen, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingBlock, PageHeader, SourceNote } from "@/components/features/common";
import { useJournal, useJournalEntry } from "@/hooks/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function JournalPage() {
  const { slug } = useParams();
  const list = useJournal();
  const entry = useJournalEntry(slug ?? "");

  if (list.isLoading) return <LoadingBlock rows={8} />;
  if (list.error || !list.data) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  if (slug) {
    if (entry.isLoading) return <LoadingBlock rows={8} />;
    if (entry.error || !entry.data) return <ErrorState error={entry.error} onRetry={() => entry.refetch()} />;
    const item = entry.data;
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Documentation · Research journal"
          title={item.title}
          description={item.summary}
          actions={<Button asChild variant="outline" size="sm"><Link to="/journal"><ArrowLeft /> All entries</Link></Button>}
        >
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline"><CalendarDays className="size-2.5" /> {formatDate(item.date)}</Badge>
            <Badge variant="success">Session {item.status}</Badge>
            {item.experiments.map((id) => <Badge key={id} variant="outline" className="font-mono">{id}</Badge>)}
          </div>
        </PageHeader>
        <Card>
          <CardContent className="p-5">
            <div className="prose-research max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
        <SourceNote source={item.artifact} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentation · Research journal"
        title="Research journal"
        description="Chronological records of research sessions. Entries are stored as Markdown files in web/content/journal and loaded by the read-only API."
        actions={<Badge variant="outline">{list.data.entries.length} entries</Badge>}
      />
      <div className="space-y-3">
        {list.data.entries.map((item) => (
          <Card key={item.slug} className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground">{formatDate(item.date)}</span>
                  <Badge variant="success">{item.status}</Badge>
                </div>
                <Link to={`/journal/${item.slug}`} className="mt-1 block text-sm font-semibold text-foreground hover:text-primary">
                  {item.title}
                </Link>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.experiments.map((id) => <Link key={id} to={`/experiments/${id}`}><Badge variant="outline" className="font-mono hover:border-primary/40 hover:text-primary">{id}</Badge></Link>)}
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to={`/journal/${item.slug}`}><BookOpen /> Read entry</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <CardHeader className="p-0"><CardTitle>Journal conventions</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          Entries separate activities, experiments, findings, problems, solutions, decisions, remaining
          questions and next steps. The current journal starts on 25 November 2026; no earlier session
          dates are invented.
        </CardContent>
      </Card>
      <div className={cn("flex flex-wrap gap-2")}>
        {list.data.entries.map((item) => <SourceNote key={item.slug} source={item.artifact} />)}
      </div>
    </div>
  );
}
