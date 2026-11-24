# APT Research Lab — Research Dashboard

Read-only research intelligence dashboard for the Master's project **AI-based solution to detect and mitigate APT malware** at Universiti Teknologi Brunei.

The dashboard presents existing CICAPT-IIoT provenance experiments. It does **not** train models, load checkpoints, retrain models or modify research artifacts.

## Architecture

```text
web/
├── frontend/        React + TypeScript + Vite + Tailwind v4 + Recharts
├── backend/         FastAPI + Pydantic + Pandas + PyArrow
├── content/         Editable experiment registry, roadmap, findings, journal, reports
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

API documentation: <http://127.0.0.1:8000/api/docs>

### Production preview

The preview server proxies `/api` to the local backend, so the default build works without
additional configuration:

```bash
cd web/frontend
npm run build
npm run preview
```

For a separately hosted API, set `VITE_API_BASE_URL` **before building** because Vite inlines
environment variables at build time:

```bash
VITE_API_BASE_URL=https://example.edu/api/v1 npm run build
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
- journal/findings/roadmap/report/environment content

Frontend build and typecheck:

```bash
cd web/frontend
npm run build
```

## Data sources

| View | Source |
|---|---|
| B1–B4 | `results/baselines/baseline_comparison.csv`, `baseline_summary.json` |
| E2-A–D | `results/autoencoder_comparison/ranking_summary.csv`, `threshold_comparison.csv` |
| Alert budgets | `results/autoencoder_comparison/alert_budget_comparison.csv` |
| E5 / B5 | `results/ablation_comparison/ablation_comparison.csv` |
| Curves | stored `*_predictions.parquet` attack-test scores |
| Dataset | `data/processed/cicapt-iiot-v2/*.parquet`, `data/splits/cicapt-iiot/*` |
| Raw distributions | `data/raw/cicapt-iiot/Provenance_Logs/*.csv` |
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
- `GET /health`
- `POST /cache/refresh` — clears in-memory caches only; no filesystem changes
- `GET /artifacts/figures/{run}/{filename}`
- `GET /artifacts/documents/{key}`

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

## Research limitations

This dashboard does not establish production-ready APT detection or effective mitigation. The underlying research currently has one seed, one attack scenario, 70 original positive events, low absolute precision, derived contextual labels and no independent validation. See the Limitations page and `web/content/limitations.json`.
