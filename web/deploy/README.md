# Deployment guide — Vercel frontend + Fly.io API

This deployment keeps the research artifacts on a persistent Fly.io container and
serves the Vite dashboard from a protected Vercel project.

```text
Supervisor browser
   │  Vercel Authentication (All Deployments)
   ▼
Vercel project
   ├── static React/Vite dashboard
   └── /api/v1/* serverless proxy
          │  X-API-Key
          ▼
Fly.io FastAPI container
   └── results/, data/processed/cicapt-iiot-v2/, data/splits/, web/content/
```

## Why the API is separate

- `data/processed/` and `data/raw/` are intentionally not tracked in Git.
- The event index needs roughly 600 MB of process memory; a persistent 1–2 GB
  container is a better fit than a serverless function.
- The API cache remains warm, avoiding repeated event-index and dataset-summary
  work.
- The Vercel proxy is the only public path to the API.

## 1. Build and test the API image locally

From the repository root:

```bash
docker build -f web/backend/Dockerfile -t apt-research-api:local .

docker run --rm -p 8001:8000 \
  -e APT_API_KEY=local-test-key \
  apt-research-api:local
```

Verify:

```bash
curl -i http://127.0.0.1:8001/api/v1/health
curl -i http://127.0.0.1:8001/api/v1/overview        # 401
curl -i -H "X-API-Key: local-test-key" \
  http://127.0.0.1:8001/api/v1/overview              # 200
```

The image excludes `data/raw`, `data/embeddings`, `models`, the frontend, and
duplicate processed datasets. `web/content/dataset_profile.json` supplies the
raw-data distributions used by the Dataset Explorer.

Regenerate that profile after changing the raw provenance files:

```bash
python web/backend/scripts/build_dataset_profile.py
```

## 2. Deploy the API to Fly.io

Install and authenticate the Fly CLI, then:

```bash
fly auth login
fly apps create apt-research-api
```

Change the `app` value in the repository-root `fly.toml` if your app name differs.

Generate a production API key and store it as a Fly secret:

```bash
openssl rand -hex 32
fly secrets set APT_API_KEY=<generated-key> -a apt-research-api
```

Deploy using the local Docker build so ignored research artifacts are included:

```bash
fly deploy --local-only
```

Check the release:

```bash
fly status -a apt-research-api
fly logs -a apt-research-api
curl -i https://apt-research-api.fly.dev/api/v1/health
```

The Fly configuration uses:

- Singapore (`sin`) primary region
- 2 GB RAM, 1 shared CPU
- always-on machine (`auto_stop_machines = "off"`)
- HTTP health check at `/api/v1/health`
- the full repository build context so processed artifacts can be copied

The first deploy uploads a roughly 1.2 GB image and may take a few minutes.

## 3. Deploy the frontend to Vercel

Import the repository into Vercel and configure:

| Setting | Value |
|---|---|
| Root Directory | `web/frontend` |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variables for **Production** and **Preview**:

```text
API_ORIGIN=https://apt-research-api.fly.dev
APT_API_KEY=<the same key stored in Fly>
```

`VITE_API_BASE_URL` is intentionally omitted. The browser calls same-origin
`/api/v1/*`, and Vercel rewrites that path to the server-side proxy.

The Vercel project also uses:

- `regions: ["sin1"]` for the proxy
- SPA fallback through `web/frontend/vercel.json`
- `noindex` and security headers
- a 30-second proxy timeout and 4 MB response cap

Deploy:

```bash
cd web/frontend
npx vercel link
npx vercel --prod
```

Or connect the Git repository and let Vercel build on push.

## 4. Protect supervisor access

In Vercel:

1. Open the frontend project.
2. Go to **Settings → Deployment Protection**.
3. Select **All Deployments**.
4. Select **Vercel Authentication**.
5. Invite supervisors to the Vercel project/team with view access.

Supervisors will sign in with a Vercel account. Vercel Authentication is
available on all plans, but Password Protection is a Pro feature. If a
supervisor cannot use a Vercel account, choose a different access method before
sharing the URL.

The Fly API remains publicly addressable but requires `X-API-Key`. The key is
injected only by the Vercel proxy; it is never shipped to the browser.

## 5. Verify the protected deployment

Through the Vercel deployment:

```text
/                         → dashboard
/experiments/E2-D         → SPA deep link
/robots.txt               → disallow all
/api/v1/health            → public health JSON
/api/v1/overview          → proxied API data after Vercel sign-in
```

Directly against Fly:

```bash
curl -i https://apt-research-api.fly.dev/api/v1/overview  # 401
curl -i -H "X-API-Key: <key>" \
  https://apt-research-api.fly.dev/api/v1/overview        # 200
```

Local proxy test:

```bash
cd web/frontend
API_ORIGIN=http://127.0.0.1:8001 \
APT_API_KEY=local-test-key \
npx vercel dev --local --listen 127.0.0.1:3002
```

Then check `/`, `/experiments/E2-D`, and `/api/v1/health`.

## 6. Updating research artifacts

1. Regenerate the dataset profile if raw CSVs changed:
   ```bash
   python web/backend/scripts/build_dataset_profile.py
   ```
2. Rebuild and redeploy the Fly API:
   ```bash
   fly deploy --local-only
   ```
3. Redeploy Vercel only when frontend code or deployment configuration changes.

The API's in-memory cache is per container process. The dashboard's refresh
button clears that cache, but it cannot discover files that were never included
in the image.

## 7. Security and data handling

- Do not commit `.env`, API keys, raw CICAPT-IIoT files, embeddings, or model
  checkpoints.
- Confirm the CICAPT-IIoT licence and repository visibility before sharing the
  deployment. Vercel protection does not hide data committed to a public GitHub
  repository.
- Rotate the API key if it is exposed:
  ```bash
  fly secrets set APT_API_KEY=<new-key> -a apt-research-api
  ```
  Update the Vercel environment variable and redeploy the frontend.
- The API serves aggregate metrics, allowlisted figures/logs, and event-level
  descriptions through authenticated requests. It does not serve raw CSV files.

## 8. Troubleshooting

| Symptom | Check |
|---|---|
| Vercel 500 from `/api/v1/*` | `API_ORIGIN` and `APT_API_KEY` are set for the environment |
| Vercel 502 | Fly app is running and the public URL is correct |
| Vercel 504 | Fly machine is healthy; proxy timeout is 25 s |
| Direct Fly 401 | Expected; the proxy adds `X-API-Key` |
| Dataset Explorer shows zero events | Processed V2 Parquet files are missing from the image |
| Missing-value/distribution panels empty | Regenerate `web/content/dataset_profile.json` |
| Vercel deep link 404 | Verify the `rewrites` block in `web/frontend/vercel.json` |
| Fly OOM | Keep 2 GB memory or reduce the event index |

## 9. Rollback

- Vercel: promote the previous deployment from the dashboard, or redeploy a
  previous Git commit.
- Fly: `fly releases`, then `fly deploy --image <previous-image>` or revert the
  commit and redeploy locally.

## 10. Known deployment limitations

- The Fly image is built locally because processed/raw artifacts are ignored by Git.
- New research outputs require an API image rebuild/redeploy.
- The Vercel proxy adds a small amount of latency and has a 4 MB response cap.
- Vercel Deployment Protection requires supervisor Vercel accounts for the free
  Vercel Authentication path.
- No CI pipeline can rebuild the full API image until artifacts are moved to
  approved external storage or a private deployment bundle.
