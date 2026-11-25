import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionHeading } from "@/components/features/common";
import { METRICS } from "@/lib/metrics";

export function GlossaryPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Metric glossary"
        description="What each number counts, which labels it uses, and how to read it. The dashboard shows measured artifacts only; a metric without a denominator is not a result."
      />

      <section>
        <SectionHeading
          title="Three rules for reading the dashboard"
          description="These apply to every chart, table and metric card."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Every number has a denominator",
              body: "70 original positives sit inside 100,892 attack-test events. Precision, recall and false positives all depend on that imbalance.",
            },
            {
              title: "Original and contextual labels stay separate",
              body: "Original labels are edge-derived annotations. The 225 contextual indicators come from connected provenance nodes and are supporting evidence, not a second ground truth.",
            },
            {
              title: "A ranking metric is not a deployment claim",
              body: "ROC-AUC and Average Precision describe ranking. P99 is the primary operating point; P99.95 is retrospective and exploratory.",
            },
          ].map((rule) => (
            <Card key={rule.title} className="p-5">
              <h3 className="text-[15px] font-medium text-foreground">{rule.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{rule.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Terms"
          description="Each term is linked from the relevant chart or card. Use the source line on a page to open the artifact behind the value. n/a means no measured artifact, not zero."
        />
        <div className="space-y-3">
          {METRICS.map((metric) => (
            <Card key={metric.id} id={metric.id} className="scroll-mt-24 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 lg:max-w-[62ch]">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-medium text-foreground">{metric.term}</h3>
                    <span className="rounded border border-border bg-elevated px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {metric.id}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-foreground">{metric.short}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{metric.long}</p>
                  {metric.denominator && (
                    <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Counts over:</span>{" "}
                      {metric.denominator}
                    </p>
                  )}
                  {metric.caveat && (
                    <p className="mt-2 text-[13px] leading-relaxed text-warning">
                      {metric.caveat}
                    </p>
                  )}
                </div>
                <div className="shrink-0 rounded-lg border border-border bg-elevated px-4 py-3 lg:w-64">
                  <div className="text-[12px] text-muted-foreground">Direction</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-foreground">
                    {metric.direction}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <BookOpen className="mt-0.5 size-4 text-primary" />
          <div>
            <div className="text-[14px] font-medium text-foreground">Need the artifact behind a value?</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Every page prints its source files. The experiment registry links each run to its
              evaluation artifacts.
            </p>
          </div>
        </div>
        <Link className="whitespace-nowrap text-[13px] font-medium text-primary underline underline-offset-4" to="/experiments">
          Open registry
        </Link>
      </Card>
    </div>
  );
}
