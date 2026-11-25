import type { AblationData, AlertBudgetPayload, ModelRow, ThresholdPayload } from "@/types/api";

export interface FindingChartData {
  ablation?: AblationData;
  comparison?: { models: ModelRow[] };
  budgets?: AlertBudgetPayload;
  thresholds?: ThresholdPayload;
}

interface Bar {
  label: string;
  value: number;
  display: string;
  highlight?: boolean;
  muted?: boolean;
}

function MiniBars({
  title,
  bars,
  caption,
}: {
  title: string;
  bars: Bar[];
  caption: string;
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="w-full">
      <div className="text-[12px] font-medium text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-1.5" aria-hidden="true">
        {bars.map((bar) => (
          <div
            key={bar.label}
            className="grid grid-cols-[52px_minmax(0,1fr)_58px] items-center gap-2"
          >
            <span className="truncate text-[12px] text-muted-foreground">{bar.label}</span>
            <span className="h-2 overflow-hidden rounded bg-elevated">
              <span
                className="block h-full rounded"
                style={{
                  width: `${(bar.value / max) * 100}%`,
                  backgroundColor: bar.muted
                    ? "var(--chart-5)"
                    : bar.highlight
                      ? "var(--chart-2)"
                      : "var(--chart-1)",
                }}
              />
            </span>
            <span className="text-right font-mono text-[12px] tabular text-foreground">
              {bar.display}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}

export function FindingMiniChart({ id, data }: { id: string; data: FindingChartData }) {
  if (id === "F01") {
    const conflicts = data.ablation?.conflicts;
    const bars: Bar[] = [
      {
        label: "E5-A",
        value: conflicts?.operation_only?.original.conflicting_records ?? 0,
        display: (conflicts?.operation_only?.original.conflicting_records ?? 0).toLocaleString(),
        highlight: true,
      },
      {
        label: "E5-B",
        value: conflicts?.operation_entities?.original.conflicting_records ?? 0,
        display: (conflicts?.operation_entities?.original.conflicting_records ?? 0).toLocaleString(),
      },
      {
        label: "E5-C",
        value: conflicts?.full_provenance?.original.conflicting_records ?? 0,
        display: (conflicts?.full_provenance?.original.conflicting_records ?? 0).toLocaleString(),
      },
    ];
    return (
      <MiniBars
        title="Records sharing one exact description"
        bars={bars}
        caption="Operations alone collapse every labelled positive into one description. Entity attributes remove the collision."
      />
    );
  }

  if (id === "F02") {
    return (
      <MiniBars
        title="Share of the benign training set"
        bars={[
          { label: "Template", value: 73.23, display: "73.23%", highlight: true },
          { label: "Other", value: 26.77, display: "26.77%", muted: true },
        ]}
        caption="72,986 of 99,665 training events use one description. Only 13,029 descriptions are unique."
      />
    );
  }

  if (id === "F03") {
    const models = data.comparison?.models ?? [];
    const e2a = models.find((model) => model.id === "E2-A")?.average_precision ?? 0;
    const e2d = models.find((model) => model.id === "E2-D")?.average_precision ?? 0;
    const ratio = e2a > 0 ? e2d / e2a : null;
    return (
      <MiniBars
        title="Average precision, same attack test"
        bars={[
          {
            label: "E2-A",
            value: e2a,
            display: e2a.toFixed(4),
            muted: true,
          },
          {
            label: "E2-D",
            value: e2d,
            display: e2d.toFixed(4),
            highlight: true,
          },
        ]}
        caption={`E2-D reaches ${e2d.toFixed(4)} against ${e2a.toFixed(4)} for E2-A${ratio ? `, about ${ratio.toFixed(1)} times higher` : ""}.`}
      />
    );
  }

  if (id === "F04") {
    const rows = data.budgets?.rows ?? [];
    const points = [100, 200, 500, 1000];
    const bars = points.map((budget) => {
      const row = rows.find((item) => item.budget === budget);
      return {
        label: budget >= 1000 ? `${budget / 1000}k` : String(budget),
        value: row?.expected_true_positives ?? 0,
        display: String(row?.expected_true_positives ?? 0),
        highlight: budget === 500,
      };
    });
    const at500 = rows.find((item) => item.budget === 500)?.expected_true_positives ?? 0;
    return (
      <MiniBars
        title="Original positives found inside the budget"
        bars={bars}
        caption={`At 500 alerts, E2-D finds ${at500} of 70. E2-B finds 7 and E2-C finds none.`}
      />
    );
  }

  if (id === "F05") {
    const models = data.ablation?.models ?? [];
    const apB = models.find((item) => item.id === "E5-B")?.average_precision ?? 0;
    const apC = models.find((item) => item.id === "E5-C")?.average_precision ?? 0;
    const uplift = data.ablation?.derived.e5c_over_e5b_ap_uplift_percent;
    const rows = ["E5-A", "E5-B", "E5-C"].map((experiment) => {
      const model = models.find((item) => item.id === experiment);
      return {
        label: experiment,
        value: model?.average_precision ?? 0,
        display: (model?.average_precision ?? 0).toFixed(4),
        highlight: experiment === "E5-C",
        muted: experiment === "E5-A",
      };
    });
    return (
      <MiniBars
        title="Average precision by representation"
        bars={rows}
        caption={`Full provenance reaches ${apC.toFixed(4)} against ${apB.toFixed(4)} for entities${uplift !== null && uplift !== undefined ? `, a ${uplift.toFixed(1)}% relative gain` : ""}.`}
      />
    );
  }

  const p99 = data.thresholds?.rows.find((row) => row.percentile === 99);
  const p9995 = data.thresholds?.rows.find((row) => row.percentile === 99.95);
  const fp99 = p99?.false_positives ?? 0;
  const fp9995 = p9995?.false_positives ?? 0;
  const recall99 = (p99?.contextual_recall ?? 0) * 100;
  const recall9995 = (p9995?.contextual_recall ?? 0) * 100;
  return (
    <MiniBars
      title="False positives at two thresholds"
      bars={[
        {
          label: "P99",
          value: fp99,
          display: fp99.toLocaleString(),
          muted: true,
        },
        {
          label: "P99.95",
          value: fp9995,
          display: fp9995.toLocaleString(),
          highlight: true,
        },
      ]}
      caption={`The stricter threshold cuts false positives from ${fp99.toLocaleString()} to ${fp9995.toLocaleString()}, and contextual recall from ${recall99.toFixed(2)}% to ${recall9995.toFixed(2)}%.`}
    />
  );
}
