# Family House Assistant

Local LLM chat for the family, served over the home LAN.
No cloud, no accounts, no data leaving the house.

## Layout

    server/               Go backend: static files + Ollama proxy + context CRUD
    server/context/       Markdown house knowledge files (the source of truth)
    front/                Static frontend: HTML + CSS + ES modules, no build step
    front/i18n/           UI translations (en, be)
    front/js/             JavaScript modules
    front/vendor/         Optional: local copies of marked + DOMPurify

## Requirements

- Go 1.21+
- Ollama running with a chat model (e.g. `llama3.1:8b`)

## First run

    cd server
    go mod tidy
    go run .

Ollama must be reachable from the Go server only (loopback), not from the LAN:

    OLLAMA_HOST=127.0.0.1:11434 ollama serve

Then open http://localhost:8283/ on the machine running the server,
or http://<lan-ip>:8283/ from any device on the home WiFi.

## Adding house facts

Two ways:

1. **Form view** (Context tab) — labeled sections, plain text, best for non-programmers
2. **Raw view** (Context tab) — markdown editor, one file per section

Both write to `server/context/*.md`. Edit there directly too, if you prefer.

Files starting with `_` or `.` are ignored by the assistant
(useful for `_issues.md`, `.draft.md`).

## What not to do

Do not expose port 8283 to the internet.
Do not put real passwords in files the assistant can read
if guests or IoT devices share your WiFi.
