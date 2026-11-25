import { useId, useState, type CSSProperties } from "react";
import { REPRESENTATIONS } from "@/lib/story";

const MAX_AP = Math.max(...REPRESENTATIONS.map((item) => item.averagePrecision));

export function ProvenanceLens() {
  const [active, setActive] = useState(2);
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const representation = REPRESENTATIONS[active];

  return (
    <div className="st-lens">
      <div className="st-lens__left">
        <div className="st-lens__top">
          <div className="st-seg" role="group" aria-label="Event representation">
            {REPRESENTATIONS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={index === active}
                aria-controls={descriptionId}
                onClick={() => {
                  setActive(index);
                  setExpanded(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            className={expanded ? "st-lens__desc st-lens__desc--open" : "st-lens__desc"}
            id={descriptionId}
            role="region"
            aria-label={`Event 246 written as ${representation.label}`}
            tabIndex={0}
          >
            <p>{expanded ? representation.description : representation.preview}</p>
          </div>

          <div
            className="st-lens__levels"
            role="group"
            aria-label="What this representation includes"
          >
            {[
              {
                label: "Operations",
                included: representation.contains.includes("System operation names"),
              },
              {
                label: "Entities",
                included: representation.contains.some((item) =>
                  item.includes("attributes"),
                ),
              },
              {
                label: "Relationships",
                included: representation.contains.some((item) =>
                  item.includes("relationships"),
                ),
              },
            ].map((level) => (
              <div className="st-lens__level" key={level.label}>
                <span className="st-lens__level-label">{level.label}</span>
                <span className="st-lens__level-track" aria-hidden="true">
                  <span
                    className={
                      level.included
                        ? "st-lens__level-fill"
                        : "st-lens__level-fill is-off"
                    }
                  />
                </span>
                <span
                  className={
                    level.included
                      ? "st-lens__level-state"
                      : "st-lens__level-state is-off"
                  }
                >
                  {level.included ? "included" : "omitted"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="st-text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide the raw description" : "Show the raw description"}
        </button>
      </div>

      <div className="st-lens__right">
        <div className="st-lens__group">
          <div className="st-lens__group-head">
            <b>Average precision</b>
            <span>higher is better</span>
          </div>
          <div className="st-compare">
            {REPRESENTATIONS.map((item) => (
              <div
                key={item.id}
                className={
                  item.id === representation.id
                    ? "st-compare__row st-compare__row--lead"
                    : "st-compare__row"
                }
              >
                <span className="st-compare__label">{item.id}</span>
                <span className="st-bar" aria-hidden="true">
                  <span
                    className="st-bar__fill"
                    style={{ "--v": item.averagePrecision / MAX_AP } as CSSProperties}
                  />
                </span>
                <span className="st-compare__value">{item.averagePrecision.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="st-lens__conflict">
          <div>
            <div className="st-reading" aria-live="polite">
              {representation.conflictRecords.toLocaleString("en-US")}
            </div>
            <p className="st-reading-label">
              records share one exact description
            </p>
          </div>
          <div>
            <div className="st-reading">
              {representation.conflictDescriptions}
            </div>
            <p className="st-reading-label">
              conflicting descriptions
            </p>
          </div>
        </div>

        <div className="st-lens__group">
          <div className="st-lens__group-head">
            <b>ROC-AUC</b>
            <span>attack test</span>
          </div>
          <div className="st-lens__rocs">
            {REPRESENTATIONS.map((item) => (
              <div
                key={item.id}
                className={
                  item.id === representation.id
                    ? "st-lens__roc is-active"
                    : "st-lens__roc"
                }
              >
                <span>{item.id}</span>
                <b>{item.rocAuc.toFixed(3)}</b>
              </div>
            ))}
          </div>
        </div>

        <p className="st-interpretation" aria-live="polite">
          {representation.interpretation}
        </p>

        <p className="st-source">
          Descriptions: <code>web/content/ablation_examples.json</code>
          <br />
          Metrics: <code>results/ablation_comparison/ablation_comparison.csv</code>
        </p>
      </div>
    </div>
  );
}
