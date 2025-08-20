RAG Netscanner

Minimal Django + React app that scans a local directory, chunks and embeds readable files, and provides a simple RAG chat.

## Prereqs
- Python 3.11+
- Node 18+
- On Windows, use PowerShell or Git Bash

## Backend setup

PowerShell (Windows):
```powershell
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
# If you do NOT already have OPENAI_API_KEY in your system env, create .env with it:
# New-Item -Path . -Name ".env" -ItemType "file" -Value "OPENAI_API_KEY=sk-..."
python manage.py migrate
python manage.py runserver 8001
```

Bash (macOS/Linux):
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# If you do NOT already have OPENAI_API_KEY in your environment, create .env with it:
# echo "OPENAI_API_KEY=sk-..." > .env
python manage.py migrate
python manage.py runserver 8001
```

## Frontend setup
```bash
cd frontend
npm install
npm run dev
```
Vite dev server runs on http://localhost:5173 and proxies `/api` to `http://127.0.0.1:8001`.

### Visualizations page
- After pulling updates, run `npm install` in `frontend/` to fetch new deps (`chart.js`, `react-chartjs-2`).
- Open `http://localhost:5173/visuals` for database charts:
  - File types by total size (pie)
  - Top 5 projects by size (bar)
  - Top 5 contractors by size (bar)
  - Top 5 descriptive words from document descriptions (bar)
  - Files modified per day timeline (bar)
- Header shows total file count and aggregated size.

## Environment variables
The app reads environment variables from your system and `.env` (if present). If `OPENAI_API_KEY` is already set in your system, you can skip `.env`.

Minimal:
```
OPENAI_API_KEY=sk-...
```

Optional overrides (defaults are good for local dev):
```
SECRET_KEY=change-me
DEBUG=true
ALLOWED_HOSTS=*
CORS_ALLOWED_ORIGINS=http://localhost:5173
SCAN_MAX_BYTES=10485760
SCAN_MAX_CHUNKS=64
SCAN_IGNORE_DIRS=node_modules,.git,.venv,__pycache__,dist,build,.next,.idea,.vscode
```

Optional: install `faiss-cpu` to enable FAISS index persistence (commented in `requirements.txt`).

## API
- POST `/api/scan/`
  - body: `{ "directory": string, "contractor"?: string, "project"?: string, "cutoff"?: ISO8601, "mode"?: "concise"|"detailed"|"creative" }`
- GET `/api/documents/`
  - optional query: `?q=...` (search name/description/project/contractor)
- POST `/api/ask/`
  - body: `{ "question": string, "k"?: number, "project"?: string, "contractor"?: string }`
- GET `/api/export/` → export JSON (without embeddings)
- POST `/api/import/` → import JSON `{ data: [...] }` and re-embed if key is set
- POST `/api/clear/` → delete all documents and chunks
- POST `/api/open/` → `{ file_path }` opens a file on the OS (local dev convenience)

## Notes
- Supports text and PDF extraction. Other binaries are cataloged but not chunked.
- Large files and noisy folders are skipped/capped by `SCAN_MAX_BYTES` and `SCAN_IGNORE_DIRS`.
- If FAISS is not installed, search falls back to in-DB cosine similarity.

