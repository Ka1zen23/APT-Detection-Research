# Deployment guide — static Vercel snapshot

> **Step-by-step Vercel setup:** [VERCEL.md](VERCEL.md) — project settings, GitHub/CLI deployment,
> verification, protection, custom domains and troubleshooting.

The public research dashboard is deployed as a **static Vercel site** with aggregate data only.
It does not include event-level provenance, a runtime API, a database, or a server container.

```text
Vercel
├── dist/index.html + assets
├── public/data/*.json          aggregate snapshots
├── public/artifacts/figures/   measured figures
└── public/artifacts/documents/ allowlisted text reports
```

## What is excluded

- Individual provenance events and descriptions
- Event-level anomaly scores
- Node IDs and graph event details
- `data/processed/` and `data/raw/`
- Dataset event explorer and related API endpoints

Dataset aggregates and experiment metrics remain available.

## 1. Export the snapshot

From the repository root:

```bash
python web/backend/scripts/export_static_site.py
```

This writes:

- `web/frontend/public/data/`
- `web/frontend/public/artifacts/figures/`
- `web/frontend/public/artifacts/documents/`

The exporter refuses to include event rows and replaces the ablation event example with a redacted
illustrative template. Regenerate the snapshot whenever research artifacts or maintained content change.

## 2. Verify locally

```bash
cd web/frontend
npm run build
npm run preview
```

The production build defaults to static data mode. Development (`npm run dev`) continues to use the
local FastAPI API unless `VITE_DATA_MODE=static` is set.

Check:

- `/` and `/overview`
- `/dataset` — aggregate overview only
- `/experiments/E2-D`
- `/comparison`, `/thresholds`, `/alerts`, `/ablation`
- figures and reports
- deep links and browser refresh
- no network requests to `/api/v1/dataset/events`

## 3. Deploy to Vercel

Import the repository into Vercel:

| Setting | Value |
|---|---|
| Root Directory | `web/frontend` |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

No API URL, API key, or Fly secret is required.

Deploy:

```bash
cd web/frontend
npx vercel link
npx vercel --prod
```

Or connect the Git repository and let Vercel build on push.

## 4. Access and privacy

This deployment is public by default. If supervisor-only access is required, enable Vercel
Authentication separately in **Settings → Deployment Protection**. Vercel Authentication is free
but requires viewers to have Vercel accounts; Password Protection requires Vercel Pro.

`X-Robots-Tag: noindex` and `robots.txt` are included, but they are not access control.

Confirm the CICAPT-IIoT licence and dataset redistribution policy before sharing the URL. The static
bundle contains aggregate counts, metrics, figures and text reports — not raw provenance events.

## 5. Updating the public snapshot

```bash
python web/backend/scripts/export_static_site.py
cd web/frontend
npm run build
npx vercel --prod
```

The deployed site is a snapshot and cannot detect new research artifacts without a new export and
deployment.

## 6. Verification checklist

- `web/frontend/public/data/manifest.json` has `provenance_included: false`
- no `web/frontend/public/data/dataset-events.json`
- search exported JSON and documents for known provenance markers
- all dashboard routes load with FastAPI stopped
- figures and report previews resolve from `/artifacts/`
- `npm run build` succeeds
- backend tests still pass

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| Blank dashboard or 404 data | Run the static exporter and rebuild |
| `No static snapshot exists` error | The endpoint is not part of the aggregate snapshot |
| Dataset page requests `/api` | Build with the default static mode, or set `VITE_DATA_MODE=static` |
| Figure missing | Re-run the exporter and verify `public/artifacts/figures` |
| Report preview missing | Verify the report is referenced in `web/content/reports.json` and copied to `public/artifacts/documents` |
| Deep link 404 on Vercel | Verify the `rewrites` block in `web/frontend/vercel.json` |

## 8. Local full-API mode

The FastAPI backend remains available for local research use:

```bash
cd web/backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd web/frontend
VITE_DATA_MODE=api npm run dev
```

The cloud deployment does not use this API.
