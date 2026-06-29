# Docker

Run 9Router in a container. Published image: [`decolua/toprouter`](https://hub.docker.com/r/decolua/toprouter) — multi-platform `linux/amd64` + `linux/arm64`.

---

# 👤 For Users

## Quick start

```bash
docker run -d \
  -p 20128:20128 \
  -v "$HOME/.toprouter:/app/data" \
  -e DATA_DIR=/app/data \
  --name toprouter \
  decolua/toprouter:latest
```

App listens on port `20128`. Open: http://localhost:20128

## Manage container

```bash
docker logs -f toprouter        # view logs
docker stop toprouter           # stop
docker start toprouter          # start again
docker rm -f toprouter          # remove
```

## Data persistence

```bash
-v "$HOME/.toprouter:/app/data" \
-e DATA_DIR=/app/data
```

Without `DATA_DIR`, the app falls back to `~/.toprouter/` (macOS/Linux) or `%APPDATA%\toprouter\` (Windows). In the container, `DATA_DIR=/app/data` makes the bind mount work.

Data layout under `$DATA_DIR/`:

```text
$DATA_DIR/
├── db/
│   ├── data.sqlite       # main SQLite database
│   └── backups/          # auto backups
└── ...                   # certs, logs, runtime configs
```

Host path: `$HOME/.toprouter/db/data.sqlite`
Container path: `/app/data/db/data.sqlite`

## Optional env vars

```bash
docker run -d \
  -p 20128:20128 \
  -v "$HOME/.toprouter:/app/data" \
  -e DATA_DIR=/app/data \
  -e PORT=20128 \
  -e HOSTNAME=0.0.0.0 \
  -e DEBUG=true \
  --name toprouter \
  decolua/toprouter:latest
```

## Update to latest

```bash
docker pull decolua/toprouter:latest
docker rm -f toprouter
# re-run the quick start command
```

---

# 🛠 For Developers

## Build image locally (test)

```bash
cd app && docker build -t toprouter .

docker run --rm -p 20128:20128 \
  -v "$HOME/.toprouter:/app/data" \
  -e DATA_DIR=/app/data \
  toprouter
```

## Publish (automatic via CI)

Push a git tag `v*` → GitHub Actions builds multi-platform (amd64+arm64) and pushes to:
- `ghcr.io/decolua/toprouter:v{version}` + `:latest`
- `decolua/toprouter:v{version}` + `:latest`

```bash
# Use scripts/release.js (recommended)
node scripts/release.js "Release title" "Notes"

# Or manually
git tag v0.4.x && git push origin v0.4.x
```

Workflow: `app/.github/workflows/docker-publish.yml`
