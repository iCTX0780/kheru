# Archived FastAPI stack

Retired in Phase B cutover. Kheru (`apps/kheru`) is the only runtime app.

Kept for `voice_bakeoff.py` / `generate_voice_samples.py` (Python kokoro-onnx reference).

```bash
cd legacy/fastapi
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```
