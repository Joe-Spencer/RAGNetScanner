RAG Netscanner

Minimal Django + React app that scans a local directory, chunks and embeds readable files, and provides a simple RAG chat.

## Prereqs
- Python 3.11+
- Node 18+
- On Windows, use PowerShell or Git Bash

## Backend setup
```bash
python -m venv .venv
. .venv/Scripts/Activate.ps1  # PowerShell
pip install -r requirements.txt
copy .env.example .env  # or create .env with OPENAI_API_KEY
python manage.py migrate
python manage.py runserver 8001
```

## Frontend setup
```bash
cd frontend
npm install
npm run dev
```
Vite dev server proxies `/api` to `http://127.0.0.1:8001`.

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
Create `.env` in project root:
```
OPENAI_API_KEY=sk-...
```

Optional: install `faiss-cpu` to enable FAISS index persistence (commented in `requirements.txt`).

## API
- POST `/api/scan/` with JSON `{ directory, contractor?, project?, cutoff? }`
- GET `/api/documents/`
- POST `/api/ask/` with JSON `{ question, k? }`

## Notes
- Supports text and PDF extraction. Other binary files are skipped for chunking but still cataloged.
- If FAISS is not installed, similarity falls back to brute-force in-DB cosine.

