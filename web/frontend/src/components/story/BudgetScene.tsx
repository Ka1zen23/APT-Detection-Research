import { useState } from "react";
import { BUDGETS, SELECTABLE_BUDGETS } from "@/lib/story";

const WIDTH = 640;
const HEIGHT = 340;
const LEFT = 48;
const RIGHT = 16;
const TOP = 28;
const BOTTOM = 44;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const Y_MAX = 70;

const xFor = (index: number) => LEFT + (index / (BUDGETS.length - 1)) * PLOT_WIDTH;
const yFor = (value: number) => TOP + (1 - value / Y_MAX) * PLOT_HEIGHT;

const linePath = (key: "e2d" | "e2a") =>
  BUDGETS.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index)} ${yFor(point[key])}`).join(" ");

const formatPercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);

const formatBudget = (budget: number) =>
  budget >= 1000 ? `${budget / 1000}k` : String(budget);

function BudgetChart({ selectedBudget }: { selectedBudget: number }) {
  const selectedIndex = BUDGETS.findIndex((point) => point.budget === selectedBudget);
  const selected = BUDGETS[selectedIndex] ?? BUDGETS[3];
  const markerX = xFor(selectedIndex);
  const markerY = yFor(selected.e2d);

  return (
    <svg
      className="st-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Labelled attacks found against alert budget. At ${selected.budget} alerts, E2-D finds ${selected.e2d} of 70 and E2-A finds ${selected.e2a}.`}
    >
      <title>Labelled attacks found against the alert budget</title>

      {[0, 20, 40, 60, 70].map((value) => (
        <g key={value}>
          <line
            className="st-chart__grid"
            x1={LEFT}
            x2={WIDTH - RIGHT}
            y1={yFor(value)}
            y2={yFor(value)}
          />
          <text className="st-chart__axis" x={LEFT - 10} y={yFor(value) + 4} textAnchor="end">
            {value}
          </text>
        </g>
      ))}

      <text className="st-chart__axis-label" x={LEFT} y={14}>
        labelled attacks found
      </text>

      {BUDGETS.map((point, index) => (
        <text
          key={point.budget}
          className="st-chart__axis"
          x={xFor(index)}
          y={HEIGHT - 16}
          textAnchor="middle"
        >
          {formatBudget(point.budget)}
        </text>
      ))}

      <path
        className="st-chart__line st-chart__line--base st-chart__draw"
        d={linePath("e2a")}
        pathLength={1}
      />
      <path
        className="st-chart__line st-chart__line--main st-chart__draw"
        d={linePath("e2d")}
        pathLength={1}
      />

      {BUDGETS.map((point, index) => (
        <g key={`base-${point.budget}`}>
          <circle
            className="st-chart__dot--base"
            cx={xFor(index)}
            cy={yFor(point.e2a)}
            r={3}
          />
        </g>
      ))}

      {BUDGETS.map((point, index) => (
        <g key={`main-${point.budget}`}>
          <circle
            className="st-chart__dot--main"
            cx={xFor(index)}
            cy={yFor(point.e2d)}
            r={3.5}
          />
        </g>
      ))}

      <g className="st-chart__marker" style={{ transform: `translateX(${markerX}px)` }}>
        <line x1={0} x2={0} y1={TOP} y2={HEIGHT - BOTTOM} />
      </g>
      <g
        className="st-chart__marker-dot-group"
        style={{ transform: `translate(${markerX}px, ${markerY}px)` }}
      >
        <circle className="st-chart__marker-dot" cx={0} cy={0} r={5} />
      </g>
    </svg>
  );
}

export function BudgetScene() {
  const [budget, setBudget] = useState(500);
  const selected = BUDGETS.find((point) => point.budget === budget) ?? BUDGETS[3];

  return (
    <div className="st-budget">
      <div>
        <div className="st-budget__read st-swap" key={selected.budget}>
          <b>{selected.e2d}</b>
          <span>/ 70</span>
        </div>
        <p className="st-budget__label">
          labelled attacks found within {selected.budget.toLocaleString("en-US")} alerts
        </p>

        <div className="st-seg st-budget__controls" role="group" aria-label="Alert budget">
          {SELECTABLE_BUDGETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === budget}
              onClick={() => setBudget(value)}
            >
              {value.toLocaleString("en-US")}
            </button>
          ))}
        </div>

        <p className="st-budget__precision">
          <b>{formatPercent(selected.precision)}</b> of the {selected.budget.toLocaleString("en-US")}{" "}
          alerts were true positives. Recall <b>{formatPercent(selected.recall)}</b>.
        </p>
      </div>

      <figure className="st-budget__figure">
        <BudgetChart selectedBudget={budget} />
        <div className="st-chart__legend" aria-hidden="true">
          <span>
            <i className="st-chart__swatch" />
            E2-D, frequency balanced
          </span>
          <span>
            <i className="st-chart__swatch st-chart__swatch--base" />
            E2-A, frequency preserving
          </span>
        </div>
        <figcaption className="st-source">
          E2-A stays at zero until 1,000 alerts and reaches 69 at 2,000. Tie-aware
          simulation from <code>results/autoencoder_comparison/alert_budget_comparison.csv</code>.
        </figcaption>
      </figure>
    </div>
  );
}
