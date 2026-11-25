import { Link } from "react-router-dom";
import { FINDINGS, type FindingStory } from "@/lib/story";

function FindingRow({
  finding,
  lead = false,
}: {
  finding: FindingStory;
  lead?: boolean;
}) {
  return (
    <article className={lead ? "st-finding st-finding--lead" : "st-finding"}>
      <div className="st-finding__read">
        <div className="st-finding__id">
          <span>{finding.id}</span>
          {lead && <span className="st-chip">strongest observed</span>}
        </div>
        {finding.struck && (
          <div className="st-reading st-reading--before">
            <span className="st-reading__model">{finding.struckBy}</span>
            {finding.struck}
          </div>
        )}
        <div className="st-reading">
          {finding.readingBy && <span className="st-reading__model">{finding.readingBy}</span>}
          {finding.reading}
        </div>
        <p className="st-reading-label">{finding.readingLabel}</p>
      </div>

      <div className="st-finding__body">
        <h3 className="st-finding__claim">{finding.claim}</h3>

        <details className="st-details">
          <summary>Details</summary>
          <div className="st-details__body">
            <p>
              <strong>Evidence.</strong> {finding.detailEvidence}
            </p>
            <p>
              <strong>Limit.</strong> {finding.detailLimit}
            </p>
            <p>
              <Link className="st-link" to={`/experiments/${finding.experiments[0]}`}>
                {finding.experimentsLabel}
              </Link>
            </p>
          </div>
        </details>
      </div>
    </article>
  );
}

export function Findings() {
  const [lead, ...rest] = FINDINGS;

  return (
    <>
      <div className="st-findings">
        <FindingRow finding={lead} lead />
        {rest.map((finding) => (
          <FindingRow key={finding.id} finding={finding} />
        ))}
      </div>
      <div className="st-method__foot">
        <Link className="st-link" to="/findings">
          Open the findings register
        </Link>
      </div>
    </>
  );
}
