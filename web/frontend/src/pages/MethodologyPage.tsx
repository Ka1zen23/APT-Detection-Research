import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Boxes, Cpu, Layers, Lock, Sigma, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/controls";
import { ErrorState, InfoCallout, LoadingBlock, PageHeader, SectionHeading } from "@/components/features/common";
import { useMethodology } from "@/hooks/queries";
import { cn } from "@/lib/utils";

const LAYER_DETAILS = [
  {
    index: 0,
    role: "Input embedding",
    description:
      "The frozen MiniLM embedding for one event description. It is already semantic: similar descriptions have similar vectors. The autoencoder never updates the encoder.",
  },
  {
    index: 1,
    role: "Compression",
    description:
      "The encoder reduces 384 dimensions to 128. It must retain enough information to reproduce the benign event while discarding incidental variation.",
  },
  {
    index: 2,
    role: "Bottleneck",
    description:
      "The 32-dimensional bottleneck forces a compact representation of what 'normal' looks like. This constraint is what makes reconstruction difficult for unfamiliar events.",
  },
  {
    index: 3,
    role: "Expansion",
    description:
      "The decoder expands the bottleneck back to 128 dimensions, beginning the reconstruction of the original semantic vector.",
  },
  {
    index: 4,
    role: "Reconstruction",
    description:
      "The final layer outputs a 384-dimensional vector. The mean squared difference from the input is the per-event anomaly score.",
  },
];

export function MethodologyPage() {
  const { data, isLoading, error, refetch } = useMethodology();
  const [selectedLayer, setSelectedLayer] = useState(2);
  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const implemented = data.pipeline.filter((step) => step.status === "implemented");
  const planned = data.pipeline.filter((step) => step.status !== "implemented");
  const selected = LAYER_DETAILS[selectedLayer];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Research · Methodology"
        title="Implemented pipeline and model architecture"
        description="The current method converts provenance events into text, encodes them with a frozen sentence transformer, and measures reconstruction error with a benign-trained autoencoder. Planned components are labelled separately."
        actions={<Badge variant="success">Implemented core</Badge>}
      />

      <section>
        <SectionHeading
          title="Research pipeline"
          description="Implemented components are measured by the artifacts in this repository. Future components are not treated as completed."
        />
        <Card>
          <CardContent className="space-y-1.5 pt-4">
            {data.pipeline.map((step, index) => {
              const isImplemented = step.status === "implemented";
              return (
                <div key={step.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded border font-mono text-[9px]",
                        isImplemented
                          ? "border-success/25 bg-success/5 text-success"
                          : "border-border bg-elevated text-muted-foreground",
                      )}
                    >
                      {index + 1}
                    </span>
                    {index < data.pipeline.length - 1 && <div className="h-full w-px bg-border" />}
                  </div>
                  <div className={cn("min-w-0 flex-1 pb-3", index === data.pipeline.length - 1 && "pb-0")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{step.label}</span>
                      <Badge variant={isImplemented ? "success" : "neutral"}>
                        {isImplemented ? "Implemented" : "Planned"}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-success/20 bg-success/5 px-3 py-2 text-[10px] text-muted-foreground">
            <span className="font-medium text-success">{implemented.length} implemented</span> · covers
            event-level detection through alert prioritisation.
          </div>
          <div className="rounded-md border border-border bg-elevated px-3 py-2 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">{planned.length} planned</span> · correlation,
            incident reconstruction, mitigation and human review are future work.
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Lock className="size-3.5" /> Current semantic encoder
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Frozen pretrained language encoder. No fine-tuning is performed.
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded border border-border bg-elevated/60 p-3 font-mono text-xs text-foreground">
              {data.encoder.model}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Parameters", data.encoder.parameters],
                ["Embedding", `${data.encoder.dimensions} dimensions`],
                ["Token limit", `${data.encoder.max_tokens} tokens`],
                ["Normalisation", data.encoder.normalised ? "L2 normalised" : "None"],
                ["Fine-tuning", data.encoder.frozen ? "Frozen" : "Trainable"],
                ["Revision", data.encoder.revision ?? "Not recorded"],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-border px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="mt-0.5 text-[11px] text-foreground">{value}</div>
                </div>
              ))}
            </div>
            <InfoCallout tone="warning" title="Reproducibility gap">
              {data.encoder.note}
            </InfoCallout>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Cpu className="size-3.5" /> Current autoencoder
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Unsupervised reconstruction model trained on benign events only.
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Architecture", data.autoencoder.architecture.join(" → ")],
              ["Trainable parameters", data.autoencoder.trainable_parameters.toLocaleString()],
              ["Loss", data.autoencoder.loss],
              ["Optimiser", data.autoencoder.optimizer],
              ["Learning rate", data.autoencoder.learning_rate.toString()],
              ["Batch size", data.autoencoder.batch_size.toString()],
              ["Training data", data.autoencoder.training_data],
              ["Threshold rule", data.autoencoder.threshold_rule],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 border-b border-border pb-1.5 last:border-0">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="max-w-[60%] text-right text-[11px] text-foreground">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Boxes className="size-3.5" /> Interactive architecture
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Select a layer to understand what it does. Widths are illustrative, not to scale.
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-center gap-1.5 overflow-x-auto pb-2 pt-2 md:gap-3">
            {data.autoencoder.architecture.map((size, index) => (
              <button
                key={`${size}-${index}`}
                type="button"
                onClick={() => setSelectedLayer(index)}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center justify-end gap-1 rounded border px-1 py-2 transition-colors md:w-24",
                  selectedLayer === index
                    ? "border-primary bg-primary/10"
                    : "border-border bg-elevated/60 hover:border-primary/30",
                )}
              >
                <div
                  className={cn(
                    "w-full rounded-sm",
                    index === 2 ? "bg-warning/60" : index === 0 || index === 4 ? "bg-primary/60" : "bg-primary/35",
                  )}
                  style={{ height: `${Math.max(18, size / 6)}px` }}
                />
                <span className="font-mono text-[10px] font-medium text-foreground">{size}</span>
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                  {index === 0 || index === 4 ? "semantic" : index === 2 ? "bottleneck" : "hidden"}
                </span>
              </button>
            ))}
          </div>
          <div className="mx-auto mt-2 max-w-2xl rounded-md border border-border bg-elevated/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                Layer {selected.index + 1}
              </Badge>
              <span className="text-xs font-semibold text-foreground">{selected.role}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                {data.autoencoder.architecture[selected.index]} units
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{selected.description}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-mono">embedding → 128 → 32 → 128 → embedding</span>
            <span className="text-muted-foreground/50">|</span>
            <span>MSE over 384 dimensions = anomaly score</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="font-mono">107,168 parameters</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Sigma className="size-3.5" /> Beginner-friendly metric definitions
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {data.glossary.map((item) => (
              <div key={item.term} className="py-2.5 first:pt-0 last:pb-0">
                <div className="text-[11px] font-semibold text-foreground">{item.term}</div>
                <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{item.plain}</div>
                <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Layers className="size-3.5" /> Training and calibration partitions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(data.training_partitions).map(([partition, description]) => (
                <div key={partition} className="rounded border border-border px-2.5 py-2">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {partition.replace("_", " ")}
                  </div>
                  <div className="mt-0.5 text-[11px] text-foreground">{description}</div>
                </div>
              ))}
              <InfoCallout tone="warning" title="Original vs contextual labels">
                Original positives are edge-derived annotations. Contextual positives are derived from
                connected provenance nodes. They are reported separately and must not be combined into a
                single "malicious event" count.
              </InfoCallout>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Workflow className="size-3.5" /> Experiment link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                The methodology is evaluated through B1–B5 baselines, E2-A–E2-D autoencoder variants, the
                E2-T/E2-R analyses and the E5-A–E5-C representation ablation.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["E2-D", "E5-C", "B5"].map((id) => (
                  <Link key={id} to={`/experiments/${id}`}>
                    <Badge variant="outline" className="font-mono hover:border-primary/40 hover:text-primary">
                      {id}
                    </Badge>
                  </Link>
                ))}
              </div>
              <Separator className="my-2" />
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/comparison">
                  View measured comparison <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
