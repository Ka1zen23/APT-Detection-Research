import { useState, type CSSProperties } from "react";
import { THRESHOLDS } from "@/lib/story";

const formatPercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);

const formatPrecision = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
  }).format(value);

const formatCount = (value: number) => value.toLocaleString("en-US");

export function ThresholdScene() {
  const [state, setState] = useState<"p99" | "p9995">("p99");
  const threshold = THRESHOLDS[state];

  return (
    <div className="st-threshold">
      <div>
        <div className="st-seg" role="group" aria-label="Validation percentile">
          <button
            type="button"
            aria-pressed={state === "p99"}
            onClick={() => setState("p99")}
          >
            P99
          </button>
          <button
            type="button"
            aria-pressed={state === "p9995"}
            onClick={() => setState("p9995")}
          >
            P99.95
          </button>
        </div>

        <p className="st-note" style={{ marginTop: "var(--space-lg)" }}>
          P99 is the primary operating point. P99.95 is shown for the trade-off,
          not as a deployment threshold.
        </p>

        <p className="st-source" style={{ marginTop: "var(--space-md)" }}>
          E2-D threshold comparison,{" "}
          <code>results/autoencoder_comparison/threshold_comparison.csv</code>
        </p>
      </div>

      <div className="st-panel st-threshold__panel">
        <div className="st-threshold__rows">
          <div className="st-threshold__row">
            <div className="st-threshold__row-head">
              <span>False positives</span>
              <b className="st-swap" key={`fp-${threshold.id}`}>
                {formatCount(threshold.falsePositives)}
              </b>
            </div>
            <div className="st-threshold__track" aria-hidden="true">
              <div
                className="st-threshold__fill"
                style={
                  {
                    "--v": threshold.falsePositives / THRESHOLDS.p99.falsePositives,
                  } as CSSProperties
                }
              />
            </div>
          </div>

          <div className="st-threshold__row">
            <div className="st-threshold__row-head">
              <span>Contextual recall</span>
              <b className="st-swap" key={`cr-${threshold.id}`}>
                {formatPercent(threshold.contextualRecall)}
              </b>
            </div>
            <div className="st-threshold__track" aria-hidden="true">
              <div
                className="st-threshold__fill"
                style={{ "--v": threshold.contextualRecall } as CSSProperties}
              />
            </div>
          </div>

          <div className="st-threshold__row">
            <div className="st-threshold__row-head">
              <span>Original recall</span>
              <b>{formatPercent(threshold.originalRecall)}</b>
            </div>
            <div className="st-threshold__track" aria-hidden="true">
              <div
                className="st-threshold__fill"
                style={{ "--v": threshold.originalRecall } as CSSProperties}
              />
            </div>
          </div>
        </div>

        <p className="st-threshold__note">
          Precision {formatPrecision(threshold.precision)}, benign false-positive
          rate {formatPrecision(threshold.benignFpr)}. Original recall is unchanged
          because every labelled positive is above both thresholds. Contextual
          labels are derived indicators, not independent ground truth.
        </p>
      </div>
    </div>
  );
}
