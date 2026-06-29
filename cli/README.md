# TopRouter - FREE AI Router & Token Saver

**Never stop coding. Save 20-40% tokens with RTK + auto-fallback to FREE & cheap AI models.**

**Connect All AI Code Tools (Claude Code, Cursor, Antigravity, Copilot, Codex, Gemini, OpenCode, Cline, OpenClaw...) to 40+ AI Providers & 100+ Models.**

[![npm](https://img.shields.io/npm/v/toprouter.svg)](https://www.npmjs.com/package/toprouter)
[![Downloads](https://img.shields.io/npm/dm/toprouter.svg)](https://www.npmjs.com/package/toprouter)
[![Docker Pulls](https://img.shields.io/docker/pulls/decolua/toprouter.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/decolua/toprouter)
[![GHCR](https://img.shields.io/badge/GHCR-decolua%2Ftoprouter-blue?logo=github)](https://github.com/decolua/toprouter/pkgs/container/toprouter)
[![License](https://img.shields.io/npm/l/toprouter.svg)](https://github.com/decolua/toprouter/blob/main/LICENSE)

<a href="https://trendshift.io/repositories/22628" target="_blank"><img src="https://trendshift.io/api/badge/repositories/22628" alt="decolua%2Ftoprouter | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

[🌐 Website](https://toprouter.com) • [📖 Full Docs](https://github.com/decolua/toprouter)

---

## 🤔 Why TopRouter?

**Stop wasting money, tokens and hitting limits:**

- ❌ Subscription quota expires unused every month
- ❌ Rate limits stop you mid-coding
- ❌ Tool outputs (git diff, grep, ls...) burn tokens fast
- ❌ Expensive APIs ($20-50/month per provider)

**TopRouter solves this:**

- ✅ **RTK Token Saver** - Auto-compress tool_result, save 20-40% tokens
- ✅ **Maximize subscriptions** - Track quota, use every bit before reset
- ✅ **Auto fallback** - Subscription → Cheap → Free, zero downtime
- ✅ **Multi-account** - Round-robin between accounts per provider
- ✅ **Universal** - Works with any OpenAI/Claude-compatible CLI

---

## ⚡ Quick Start

**Option 1 — npm (recommended for desktop):**

```bash
npm install -g toprouter
toprouter

# Or run directly with npx
npx toprouter
```

**Option 2 — Docker (server/VPS):**

```bash
docker run -d --name toprouter -p 20128:20128 \
  -v "$HOME/.toprouter:/app/data" -e DATA_DIR=/app/data \
  decolua/toprouter:latest
```

Published images: [Docker Hub](https://hub.docker.com/r/decolua/toprouter) • [GHCR](https://github.com/decolua/toprouter/pkgs/container/toprouter) (multi-platform amd64/arm64).

🎉 Dashboard opens at `http://localhost:20128`

**2. Connect a FREE provider (no signup needed):**

Dashboard → Providers → Connect **Kiro AI** (free Claude unlimited) or **OpenCode Free** (no auth) → Done!

**3. Use in your CLI tool:**

```
Claude Code/Codex/OpenClaw/Cursor/Cline Settings:
  Endpoint: http://localhost:20128/v1
  API Key:  [copy from dashboard]
  Model:    kr/claude-sonnet-4.5
```

That's it! Start coding with FREE AI models.

---

## 🚀 CLI Options

```bash
toprouter                    # Start with default settings
toprouter --port 8080        # Custom port
toprouter --no-browser       # Don't open browser
toprouter --skip-update      # Skip auto-update check
toprouter --help             # Show all options
```

**Dashboard**: `http://localhost:20128/dashboard`

---

## 🛠️ Supported CLI Tools

Claude-Code • OpenClaw • Codex • OpenCode • Cursor • Antigravity • Cline • Continue • Droid • Roo • Copilot • Kilo Code • Gemini CLI • Qwen Code • iFlow • Crush • Crusher • Aider

Any tool supporting OpenAI/Claude-compatible API works.

---

## 💾 Data Location

- **macOS/Linux**: `~/.toprouter/db/data.sqlite`
- **Windows**: `%APPDATA%/toprouter/db/data.sqlite`
- **Docker**: `/app/data/db/data.sqlite` (mount `$HOME/.toprouter` to persist)

---

## 📚 Documentation

Full docs, advanced setup, video tutorials & development guide:

- **GitHub**: https://github.com/decolua/toprouter
- **Full README**: https://github.com/decolua/toprouter/blob/main/app/README.md
- **Website**: https://toprouter.com

---

## 🙏 Acknowledgments

- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** - Original Go implementation

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
