# Project Setup Guide

## Prerequisites

### Install Node.js using nvm
```bash
nvm use
# If nvm shows you have not installed the required version:
nvm install 22.12.0
nvm use 22.12.0
```

### Install Python
- Python 3.11 or higher
- Check version: `python --version`

---

## Frontend Setup
```bash
cd frontend
npm install  # (first time only)
cp .env.example .env  # (if needed)
npm run dev
```
**Access the frontend at:** http://localhost:5173

---

## Backend Setup
```bash
cd backend_py
pip install -r requirements.txt  # (first time only)
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
**You should see:**
```
✅ INFO: Uvicorn running on http://127.0.0.1:8000
```
**Access the backend at:** http://localhost:8000

---

## Local LLM Setup
```bash
ollama --version
ollama pull llama3.1:8b
ollama serve
```
---

## Quick run
```bash
# Frontend
cd frontend
npm run lint
npm run build

# Backend
cd backend_py
black .
pylint main.py
pytest tests/
```

---

## Need Help?
See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development guide.