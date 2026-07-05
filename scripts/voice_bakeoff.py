#!/usr/bin/env python3
"""Generate paired Piper + Kokoro WAV samples for voice comparison."""

from __future__ import annotations

import html
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "legacy" / "fastapi"))

import tts  # noqa: E402

SAMPLE_TEXT = (
    "Thanks for making the time. I wanted to walk through some important ideas with you."
)
PIPER_LENGTH_SCALE = 1.2
OUTPUT_DIR = ROOT / "voice-bakeoff"
KOKORO_MODELS_DIR = ROOT / "kokoro-models"

KOKORO_VOICES = [
    "af_heart",
    "af_bella",
    "af_sarah",
    "am_michael",
    "am_fenrir",
    "am_adam",
]

KOKORO_MODEL_URLS = {
    "kokoro-v1.0.onnx": (
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
        "model-files-v1.0/kokoro-v1.0.onnx"
    ),
    "voices-v1.0.bin": (
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
        "model-files-v1.0/voices-v1.0.bin"
    ),
}


def _ensure_kokoro_models() -> tuple[Path, Path]:
    KOKORO_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
    voices_path = KOKORO_MODELS_DIR / "voices-v1.0.bin"

    missing = [name for name, path in [
        ("kokoro-v1.0.onnx", model_path),
        ("voices-v1.0.bin", voices_path),
    ] if not path.exists()]

    if missing:
        try:
            import urllib.request
        except ImportError as exc:
            raise RuntimeError("urllib required to download Kokoro models") from exc

        for name in missing:
            url = KOKORO_MODEL_URLS[name]
            dest = KOKORO_MODELS_DIR / name
            print(f"Downloading {name}...")
            urllib.request.urlretrieve(url, dest)

    return model_path, voices_path


def _synth_piper(voice: str, out_path: Path) -> None:
    tts._synth_line(SAMPLE_TEXT, voice, out_path, length_scale=PIPER_LENGTH_SCALE)


def _synth_kokoro(voice: str, out_path: Path, kokoro) -> None:
    import soundfile as sf

    samples, sample_rate = kokoro.create(
        SAMPLE_TEXT,
        voice=voice,
        speed=1.0,
        lang="en-us",
    )
    sf.write(str(out_path), samples, sample_rate)


def _write_index(rows: list[tuple[str, str, str]]) -> None:
    """Write HTML table: engine, voice id, relative wav path."""
    lines = [
        "<!DOCTYPE html>",
        "<html><head><meta charset='utf-8'><title>Voice bake-off</title>",
        "<style>body{font-family:system-ui;max-width:960px;margin:2rem auto}",
        "table{width:100%;border-collapse:collapse}",
        "td,th{border:1px solid #ccc;padding:.5rem;text-align:left}",
        "th{background:#f4f4f4}</style></head><body>",
        f"<h1>Voice bake-off</h1><p>{html.escape(SAMPLE_TEXT)}</p>",
        "<table><tr><th>Engine</th><th>Voice</th><th>Preview</th></tr>",
    ]
    for engine, voice_id, rel_path in rows:
        lines.append(
            f"<tr><td>{html.escape(engine)}</td>"
            f"<td><code>{html.escape(voice_id)}</code></td>"
            f"<td><audio controls src='{html.escape(rel_path)}'></audio></td></tr>"
        )
    lines.append("</table></body></html>")
    (OUTPUT_DIR / "index.html").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    piper_dir = OUTPUT_DIR / "piper"
    kokoro_dir = OUTPUT_DIR / "kokoro"
    piper_dir.mkdir(parents=True, exist_ok=True)
    kokoro_dir.mkdir(parents=True, exist_ok=True)

    rows: list[tuple[str, str, str]] = []
    piper_voices = tts.list_voices()
    if not piper_voices:
        print("No Piper voices found in voices/. Run download_voices.py first.")
    else:
        print(f"Piper — {len(piper_voices)} voice(s)")
        for voice in piper_voices:
            out_path = piper_dir / f"{voice}.wav"
            print(f"  {voice}...")
            try:
                _synth_piper(voice, out_path)
                rows.append(("Piper", voice, f"piper/{voice}.wav"))
                print(f"    ✓ {out_path.name}")
            except Exception as exc:
                print(f"    ✗ {exc}")

    try:
        from kokoro_onnx import Kokoro
    except ImportError:
        print("\nKokoro skipped — install: pip install kokoro-onnx soundfile")
    else:
        model_path, voices_path = _ensure_kokoro_models()
        kokoro = Kokoro(str(model_path), str(voices_path))
        available = set(kokoro.get_voices())
        print(f"\nKokoro — testing {len(KOKORO_VOICES)} US voice(s)")
        for voice in KOKORO_VOICES:
            if voice not in available:
                print(f"  ✗ {voice} not in model")
                continue
            out_path = kokoro_dir / f"{voice}.wav"
            print(f"  {voice}...")
            try:
                _synth_kokoro(voice, out_path, kokoro)
                rows.append(("Kokoro", voice, f"kokoro/{voice}.wav"))
                print(f"    ✓ {out_path.name}")
            except Exception as exc:
                print(f"    ✗ {exc}")

    _write_index(rows)
    print(f"\nDone — {len(rows)} sample(s) in {OUTPUT_DIR}")
    print(f"Open {OUTPUT_DIR / 'index.html'} in a browser to compare.")


if __name__ == "__main__":
    main()
