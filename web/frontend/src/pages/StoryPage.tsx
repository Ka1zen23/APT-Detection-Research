import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HeroPanel } from "@/components/story/HeroPanel";
import { MethodTrail } from "@/components/story/MethodTrail";
import { ProvenanceLens } from "@/components/story/ProvenanceLens";
import { Findings } from "@/components/story/Findings";
import { BudgetScene } from "@/components/story/BudgetScene";
import { ThresholdScene } from "@/components/story/ThresholdScene";
import { LIMITS } from "@/lib/story";

function StoryNav() {
  return (
    <header className="st-nav">
      <div className="st-container st-nav__inner">
        <Link className="st-wordmark" to="/" aria-label="APT Research Lab home">
          APT Research Lab <span>UTB</span>
        </Link>
        <nav className="st-nav__links" aria-label="Story sections">
          <a href="#method">The method</a>
          <a href="#lens">The lens</a>
          <a href="#findings">Findings</a>
          <a href="#limits">Limits</a>
        </nav>
        <div className="st-nav__actions">
          <Link className="st-btn st-btn--quiet" to="/overview">
            Open dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}

function StoryFooter() {
  return (
    <footer className="st-footer">
      <div className="st-container">
        <div className="st-footer__grid">
          <div>
            <div className="st-footer__mark">APT Research Lab</div>
            <p className="st-footer__line">
              A read-only MSc research record from Universiti Teknologi Brunei.
            </p>
          </div>

          <div>
            <div className="st-footer__title">Evidence</div>
            <ul className="st-footer__links">
              <li>
                <Link to="/findings">Findings</Link>
              </li>
              <li>
                <Link to="/experiments">Experiments</Link>
              </li>
              <li>
                <Link to="/limitations">Limitations</Link>
              </li>
              <li>
                <Link to="/journal">Journal</Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="st-footer__title">Open</div>
            <ul className="st-footer__links">
              <li>
                <Link to="/overview">Evidence dashboard</Link>
              </li>
              <li>
                <Link to="/methodology">Methodology</Link>
              </li>
              <li>
                <Link to="/architecture">Architecture</Link>
              </li>
              <li>
                <Link to="/reports">Reports</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="st-footer__base">
          <p>Last reviewed 25 November 2026. Defensive research only.</p>
          <p>Metrics come from saved results, data and content files.</p>
        </div>
      </div>
    </footer>
  );
}

export function StoryPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Same operation. Different intent. · APT Research Lab";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="story-root">
      <a className="st-skip" href="#main">
        Skip to content
      </a>
      <StoryNav />

      <main id="main">
        <section className="st-hero">
          <div className="st-container st-hero__grid">
            <div className="st-hero__copy">
              <h1>Same operation. Different intent.</h1>
              <p className="st-lede st-hero__lede">
                Seventy attack events share one description with 8,393
                negative events.
              </p>
              <div className="st-actions">
                <a className="st-btn st-btn--primary" href="#lens">
                  Open the provenance lens
                </a>
                <Link className="st-btn" to="/overview">
                  Open the dashboard
                </Link>
              </div>
              <p className="st-hero__meta">
                <strong>Preliminary.</strong> One scenario, one seed.
              </p>
            </div>

            <HeroPanel />
          </div>
        </section>

        <section className="st-section" id="method" aria-labelledby="method-title">
          <div className="st-container">
            <div className="st-head">
              <h2 id="method-title">How an event becomes a reading</h2>
              <p className="st-lede st-head__lede">
                Records become descriptions, vectors and reconstruction errors.
              </p>
            </div>
            <MethodTrail />
          </div>
        </section>

        <section className="st-section" id="lens" aria-labelledby="lens-title">
          <div className="st-container">
            <div className="st-head">
              <h2 id="lens-title">Event 246, three descriptions</h2>
              <p className="st-lede st-head__lede">
                Phase 2, same graph, three representations.
              </p>
            </div>
            <ProvenanceLens />
          </div>
        </section>

        <section
          className="st-section st-band"
          id="findings"
          aria-labelledby="findings-title"
        >
          <div className="st-container">
            <div className="st-head st-head--stacked">
              <h2 id="findings-title">Six findings, six saved artifacts</h2>
              <p className="st-lede st-head__lede">
                Each traceable to a registered experiment.
              </p>
            </div>
            <Findings />
          </div>
        </section>

        <section className="st-section" id="budget" aria-labelledby="budget-title">
          <div className="st-container">
            <div className="st-head">
              <h2 id="budget-title">Where the analyst looks first</h2>
              <p className="st-lede st-head__lede">
                At 500 alerts, E2-D finds 46 of 70 labelled attacks. E2-A finds
                none.
              </p>
            </div>
            <BudgetScene />
          </div>
        </section>

        <section
          className="st-section"
          id="threshold"
          aria-labelledby="threshold-title"
        >
          <div className="st-container">
            <div className="st-head">
              <h2 id="threshold-title">The cost of a quieter threshold</h2>
              <p className="st-lede st-head__lede">
                P99 is the primary operating point. P99.95 is retrospective.
              </p>
            </div>
            <ThresholdScene />
          </div>
        </section>

        <section
          className="st-section st-limits"
          id="limits"
          aria-labelledby="limits-title"
        >
          <div className="st-container">
            <div className="st-head">
              <h2 id="limits-title">What this does not prove</h2>
            </div>

            <p className="st-limits__statement">
              One scenario, one seed, no mitigation.
            </p>

            <div className="st-limits__rows">
              {LIMITS.map((limit) => (
                <div className="st-limit" key={limit.title}>
                  <h3>{limit.title}</h3>
                  <p>{limit.body}</p>
                </div>
              ))}
            </div>

            <div className="st-limits__foot">
              <Link className="st-link" to="/limitations">
                Read all six limitations
              </Link>
            </div>
          </div>
        </section>
      </main>

      <StoryFooter />
    </div>
  );
}
