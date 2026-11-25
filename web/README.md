# APT Research Lab — Interactive Research Publication

Read-only research publication for the Master's project **AI-based solution to detect and mitigate APT malware** at Universiti Teknologi Brunei.

The dashboard presents existing CICAPT-IIoT provenance experiments. It does **not** train models, load checkpoints, retrain models or modify research artifacts.

## Architecture

```text
web/
├── frontend/        React + TypeScript + Vite + Tailwind v4 + Recharts
│   ├── public/data/ Aggregate JSON snapshot for the static deployment
│   ├── public/artifacts/ Figures and allowlisted report texts
│   └── vercel.json  Vercel build, SPA routing and security headers
├── backend/         FastAPI + Pydantic + Pandas + PyArrow (local API)
│   └── scripts/     Static exporter and dataset-profile generator
├── content/         Editable experiment registry, roadmap, findings, journal, reports
├── deploy/          Static Vercel deployment guide
├── README.md
└── .env.example
```

The backend resolves the repository root from `web/backend/app/config.py` and reads only:

- `results/`
- `data/processed/`
- `data/splits/`
- `data/raw/`
- `web/content/`

The frontend never supplies filesystem paths. Figures and text documents are served through fixed allowlists.

## Requirements

- Python 3.12
- Node.js 20+ (tested with Node 22)
- Existing research artifacts in `results/`, `data/processed/`, `data/splits/` and `data/raw/`

## Setup

### 1. Backend

```bash
cd web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd web/frontend
npm install
```

### 3. Environment (optional)

```bash
cd web
cp .env.example .env
```

Defaults are intentionally local:

- API: `127.0.0.1:8000`
- Frontend dev server: `127.0.0.1:5173`
- Vite proxies `/api` to the backend during development.

## Run

Terminal 1:

```bash
cd web/backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:

```bash
cd web/frontend
npm run dev
```

Open <http://127.0.0.1:5173>.

The overview at `/` introduces the project; `/understand` is the 12-chapter guided
tour. `/findings` presents the preliminary observations, `/experiments` offers
Guided and Technical views, `/progress` follows the roadmap, and `/documentation`
indexes the reference material. The old `/overview` link forwards to the detailed
evidence overview at `/experiments/evidence`.

The publication uses Newsreader, Inter and JetBrains Mono, follows the device theme
by default, and saves manually selected themes and experiment reading modes locally.
The learning examples are labelled separately from measured research outputs.
The glossary is at `/documentation/glossary`.

Research steppers read the existing roadmap and experiment artifacts. The roadmap
keeps work on the demonstration platform separate from dissertation progress.
An experiment step without supporting evidence is pending or unverified, rather
than assumed complete. Tour chapters can be marked read and resumed on the same
browser; this personal progress does not change the research roadmap.

The Experiments section includes model, training, threshold, alert-budget and E5
ablation charts with numeric tables and CSV downloads. Training histories come
from saved E2 CSVs. Score distributions use aggregate counts in common,
log-spaced bins within each model; the export does not include per-event scores.
The E5 token-length profile shows saved summary statistics, not a histogram.

The visual lab lives at `/understand/pipeline` and
`/understand/provenance-explorer`. The public site includes an educational
provenance example and a keyboard-accessible 2D view; the Three.js renderer
loads only when a visitor opens 3D. In local API mode, recorded event IDs can
open an excerpt of up to 24 directed relationships. Turning on the recorded
pair in the E5 explainer retrieves an exact operation-only match across original
labels in the attack-test partition. These endpoints are local-only and are not
included in the public snapshot. Autoencoder reconstruction values in the tour
are explicitly illustrative; the browser does not run the research model.

API documentation: <http://127.0.0.1:8000/api/docs>

### Production preview

The default production build uses the static snapshot and does not need a backend:

```bash
cd web/frontend
npm run build
npm run preview
```

For a separately hosted API, set `VITE_API_BASE_URL` **before building** because Vite inlines
environment variables at build time:

```bash
VITE_DATA_MODE=api VITE_API_BASE_URL=https://example.edu/api/v1 npm run build
```

## Deployment

The public cloud deployment is a **static Vercel site** with aggregate data only:

- no runtime API
- no Fly.io container
- no event-level provenance
- no `data/processed/` or `data/raw/`

Generate the snapshot:

```bash
python web/backend/scripts/export_static_site.py
cd web/frontend
npm run build
```

Vercel project settings:

```text
Root Directory: web/frontend
Framework: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

No environment variables or secrets are required. Full setup instructions are in
[`web/deploy/VERCEL.md`](deploy/VERCEL.md); broader privacy, maintenance and troubleshooting notes are
in [`web/deploy/README.md`](deploy/README.md).

### Static data modes

- `npm run dev` uses the local FastAPI API by default.
- Production builds use the exported static snapshot by default.
- Force either mode with `VITE_DATA_MODE=api` or `VITE_DATA_MODE=static`.

The event explorer is not part of the static deployment. Dataset aggregates remain visible.

### Dataset profile

The static exporter can use the aggregate raw-data profile when `data/raw/` is unavailable:

```bash
python web/backend/scripts/build_dataset_profile.py
```

## Verification

Backend tests:

```bash
cd web/backend
.venv/bin/pytest -q
```

Current suite covers:

- health and read-only flags
- overview KPI values
- registry completeness
- E2-D ROC-AUC/AP traceability
- E2-D P99 vs P99.95 threshold values
- alert-budget values
- real ROC/PR curve computation from Parquet scores
- dataset counts, partitions and event pagination
- filter correctness and page-size caps
- figure/document allowlists and traversal rejection
- graceful unavailable states
- API-key authentication and public health checks
- precomputed dataset-profile consistency and raw-data fallback
- static snapshot manifest and provenance-exclusion checks
- journal/findings/roadmap/report/environment content

Frontend build and typecheck:

```bash
cd web/frontend
npm run build
```

Browser tests start a production preview with the aggregate snapshot:

```bash
cd web/frontend
npx playwright install chromium
npm run test:e2e
```

The browser suite checks the tour demonstrations, measured references, technical
views, legacy routes, document and figure links, mobile navigation, and automated
accessibility in light and dark modes.

## Data sources

| View | Source |
|---|---|
| B1–B4 | `results/baselines/baseline_comparison.csv`, `baseline_summary.json` |
| E2-A–D | `results/autoencoder_comparison/ranking_summary.csv`, `threshold_comparison.csv` |
| Alert budgets | `results/autoencoder_comparison/alert_budget_comparison.csv` |
| E5 / B5 | `results/ablation_comparison/ablation_comparison.csv` |
| Curves | stored `*_predictions.parquet` attack-test scores |
| Dataset | `data/processed/cicapt-iiot-v2/*.parquet`, `data/splits/cicapt-iiot/*` |
| Raw distributions (local) | `data/raw/cicapt-iiot/Provenance_Logs/*.csv` |
| Raw distributions (deployed) | `web/content/dataset_profile.json` |
| Environment | `requirements.txt`, per-run `training_summary.json` |

Manually maintained content:

- `web/content/experiments.json`
- `web/content/roadmap.json`
- `web/content/findings.json`
- `web/content/journal/2026-11-25.md`
- `web/content/reports.json`
- `web/content/limitations.json`
- `web/content/methodology.json`
- `web/content/architecture.json`
- `web/content/research_status.json`
- `web/content/objectives.json`
- `web/content/ablation_examples.json`

## API

Versioned under `/api/v1`:

- `GET /overview`, `/status`, `/objectives`
- `GET /experiments`, `/experiments/{id}`, `/metrics`, `/thresholds`, `/alert-budgets`, `/curves`, `/figures`
- `GET /comparisons/models`, `/comparisons/ablation`, `/comparisons/description-overlap`
- `GET /dataset/summary`, `/dataset/events`, `/dataset/events/{phase}/{event_id}`
- `GET /findings`, `/roadmap`, `/journal`, `/reports`, `/environment`, `/methodology`, `/limitations`, `/architecture`
- `GET /health` — public even when API-key authentication is enabled
- `POST /cache/refresh` — clears in-memory caches only; no filesystem changes
- All data-bearing `/api/v1/*` routes require `X-API-Key` when `APT_API_KEY` is set.
- `GET /artifacts/figures/{run}/{filename}`
- `GET /artifacts/documents/{key}`

The cloud deployment is static and does not call these API routes. The local FastAPI API remains
available for full research exploration, including event-level pages that are excluded from the
public snapshot.

## Data integrity rules

- Original edge-derived positives and contextual connected-node indicators are displayed separately.
- P99 is the primary experimental operating point.
- P99.95 is marked retrospective/exploratory and is not presented as a deployment threshold.
- Unavailable artifacts render unavailable states; metrics are never estimated.
- Best ROC-AUC, Average Precision and recall are accompanied by their experiment IDs; recall ties are shown explicitly.
- No dissertation completion percentage is estimated.

## Known limitations of the dashboard

- Some analyses only exist as per-run figures/text logs, not as structured JSON.
- Event-level anomaly scores are joined from E2-D and therefore exist only for the attack-test partition.
- The ablation event-level Parquet outputs are not retained; the representation comparison uses the saved statistics, conflicts and predictions.
- Report entries without an actual repository artifact are shown as planned or unavailable.
- The frontend displays repository-relative artifact paths for traceability; the browser never reads those paths directly.
- The cloud deployment is a static aggregate snapshot; event-level provenance is intentionally excluded.
- New research outputs require re-running the exporter and redeploying the static site.
- The static site is public unless Vercel Authentication is enabled separately.

## Research limitations

This dashboard does not establish production-ready APT detection or effective mitigation. The underlying research currently has one seed, one attack scenario, 70 original positive events, low absolute precision, derived contextual labels and no independent validation. See the Limitations page and `web/content/limitations.json`.
