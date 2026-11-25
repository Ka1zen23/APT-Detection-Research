import { METHOD_STEPS } from "@/lib/story";

export function MethodTrail() {
  return (
    <>
      <ol className="st-method__steps">
        {METHOD_STEPS.map((step, index) => (
          <li className="st-step" key={step.title}>
            <span className="st-step__num">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <span className="st-step__reading">{step.reading}</span>
          </li>
        ))}
      </ol>
      <div className="st-method__foot">
        <p className="st-note">Frozen encoder. Benign-only training.</p>
        <p className="st-source">
          <code>web/content/methodology.json</code>
        </p>
      </div>
    </>
  );
}
