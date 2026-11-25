# Vercel setup — static research dashboard

Step-by-step deployment guide for the aggregate-only Vercel site.

**Deployment type:** static Vite site  
**Runtime API:** none  
**Database:** none  
**Environment secrets:** none  
**Provenance events:** excluded

---

## 1. What Vercel will serve

```text
Vercel project
├── index.html + compiled assets
├── /data/*.json                    aggregate research snapshot
├── /artifacts/figures/*            measured evaluation figures
└── /artifacts/documents/*.txt      approved report texts
```

The dashboard uses exported JSON instead of a live FastAPI API. The public bundle does not include:

- individual provenance events or descriptions
- event-level anomaly scores
- node IDs or graph event details
- `data/processed/` or `data/raw/`
- the event explorer

---

## 2. Prerequisites

- Node.js 20.19+ locally
- Python 3.12 and the backend virtual environment for exporting data
- A Vercel account
- The repository pushed to GitHub if using Git integration

The frontend build is defined in `web/frontend/vercel.json`; Vercel should not need manual framework
changes beyond selecting the correct root directory.

---

## 3. Generate the latest static snapshot

From the repository root:

```bash
python web/backend/scripts/export_static_site.py
```

This regenerates:

```text
web/frontend/public/data/
web/frontend/public/artifacts/figures/
web/frontend/public/artifacts/documents/
```

Confirm the snapshot is aggregate-only:

```bash
python - <<'PY'
import json
from pathlib import Path

manifest = json.loads(Path("web/frontend/public/data/manifest.json").read_text())
print("provenance_included:", manifest["provenance_included"])
print("event_explorer_included:", manifest["event_explorer_included"])
PY
```

Expected:

```text
provenance_included: False
event_explorer_included: False
```

The generated snapshot is committed with the frontend because Vercel builds from the repository.
For a CLI deployment, Vercel uploads the local working tree and the commit is optional.

---

## 4. Verify the build locally

```bash
cd web/frontend
npm ci
npm run build
npm run preview
```

Open the preview URL and check:

- `/` — research story
- `/overview` — research dashboard
- `/dataset` — aggregate dataset overview, no event explorer
- `/experiments/E2-D` — experiment detail
- `/comparison` — model comparison and charts
- `/reports` — report previews
- figures under `/artifacts/figures/`
- deep links survive a browser refresh
- the browser makes **no requests to `/api`**

---

## 5. Deploy with GitHub integration

This is the recommended long-term setup because every push can trigger a deployment.

### 5.1 Commit the generated snapshot

```bash
cd /home/wajien/projects/APT-Detection-Research
git add web/frontend/public/data web/frontend/public/artifacts
git commit -m "Refresh static research snapshot"
git push
```

### 5.2 Import the repository

1. Open <https://vercel.com/new>.
2. Import the GitHub repository.
3. Configure the project:

| Setting | Value |
|---|---|
| Project Name | `apt-research-dashboard` or another name |
| Framework Preset | **Vite** |
| Root Directory | `web/frontend` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. Do **not** add environment variables.
5. Deploy.

### 5.3 Enable automatic deployments

The default Git integration deploys on pushes to the production branch. Preview deployments are
created for branches and pull requests.

Each deployment runs only the frontend build; it does not run the research pipeline.

---

## 6. Deploy with the Vercel CLI

Use this when you want to deploy the current local working tree without committing.

```bash
npx vercel login
cd web/frontend
npx vercel --prod
```

First-run prompts:

- Scope: your Vercel account or team
- Project: create a new project
- Project name: e.g. `apt-research-dashboard`
- Root directory: current directory (`web/frontend`)

The build settings are read from `web/frontend/vercel.json`.

No secrets or environment variables are required.

---

## 7. Verify the deployed site

Replace `<project>` with the generated Vercel URL:

```text
https://<project>.vercel.app/
https://<project>.vercel.app/overview
https://<project>.vercel.app/dataset
https://<project>.vercel.app/experiments/E2-D
https://<project>.vercel.app/comparison
https://<project>.vercel.app/reports
https://<project>.vercel.app/data/overview.json
https://<project>.vercel.app/data/manifest.json
https://<project>.vercel.app/artifacts/figures/e2d/attack_test_original_label_roc_curve.png
```

Expected behavior:

- all dashboard routes return the SPA
- `/data/*.json` returns JSON
- `/artifacts/*` returns the copied assets
- Dataset Overview shows no event table or event descriptions
- report previews load text documents
- no `/api` request is made in the browser

### Privacy spot-check

```bash
curl -s https://<project>.vercel.app/data/manifest.json | python3 -m json.tool
```

Check that `provenance_included` and `event_explorer_included` are both `false`.

Optionally scan the deployed data for known event markers:

```bash
curl -s https://<project>.vercel.app/data/overview.json | grep -i "ethtool"
```

The command should return no output.

---

## 8. Access control

The site is public by default.

For supervisor-only access:

1. Open the Vercel project.
2. Go to **Settings → Deployment Protection**.
3. Select **All Deployments**.
4. Select **Vercel Authentication**.
5. Invite supervisors to the Vercel project/team.

Notes:

- Vercel Authentication is available on all plans, but viewers need Vercel accounts.
- Password Protection is a paid Pro feature.
- `robots.txt` and `X-Robots-Tag: noindex` discourage indexing but are not access control.
- Confirm the CICAPT-IIoT licence and redistribution policy before making the dashboard public.

---

## 9. Custom domain

1. Open **Project → Settings → Domains**.
2. Add the domain or subdomain.
3. Follow Vercel's DNS instructions.
4. Redeploy only if you change the deployment configuration.

The static site does not need CORS changes or API secrets for a custom domain.

---

## 10. Update the research snapshot

Research outputs are not live. Update the static snapshot whenever results or content change:

```bash
python web/backend/scripts/export_static_site.py
cd web/frontend
npm run build
```

For GitHub integration:

```bash
git add web/frontend/public/data web/frontend/public/artifacts
git commit -m "Refresh static research snapshot"
git push
```

For CLI deployment:

```bash
cd web/frontend
npx vercel --prod
```

---

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| Build fails on Vercel | Confirm Root Directory is `web/frontend` and the build command is `npm run build` |
| Blank dashboard | Check that `public/data/overview.json` exists in the deployed site |
| `No static snapshot exists` | The route is not part of the aggregate snapshot |
| Deep link 404 | Verify the `rewrites` block in `web/frontend/vercel.json` |
| `/data/*.json` returns HTML | The Vercel rewrite is incorrectly catching `/data`; verify the rewrites config |
| Figure missing | Re-run the exporter and verify `public/artifacts/figures` |
| Report preview missing | Verify the document is referenced in `web/content/reports.json` |
| Dataset shows event explorer | The build is not using the latest `DatasetPage`; redeploy after `npm run build` |
| Browser requests `/api` | Rebuild the frontend and confirm production static mode |
| Old data after deployment | Re-run the exporter, commit the new `public/data`, and redeploy |

---

## 12. Files involved

| File | Purpose |
|---|---|
| `web/backend/scripts/export_static_site.py` | Generates aggregate JSON/figures/documents |
| `web/frontend/public/data/` | Deployed aggregate snapshot |
| `web/frontend/public/artifacts/` | Deployed figures and report texts |
| `web/frontend/vercel.json` | Vercel build, SPA routing, security headers |
| `web/frontend/src/services/api.ts` | Static/API data-source adapter |
| `web/frontend/src/pages/DatasetPage.tsx` | Aggregate-only dataset overview |
| `web/deploy/README.md` | Broader deployment and maintenance notes |

---

## 13. Quick command summary

```bash
# Generate static data
python web/backend/scripts/export_static_site.py

# Build and preview locally
cd web/frontend
npm ci
npm run build
npm run preview

# Deploy from local working tree
npx vercel login
npx vercel --prod
```

Vercel project settings:

```text
Root Directory:   web/frontend
Framework:        Vite
Install Command:  npm ci
Build Command:    npm run build
Output Directory: dist
Environment:      none
```
