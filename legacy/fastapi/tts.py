import os
import subprocess
import uuid
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np

from voice_catalog import CURATED_VOICE_IDS, VOICE_BY_ID, Voice

_API_DIR = Path(__file__).resolve().parent
_MONOREPO_ROOT = _API_DIR.parent.parent.parent
_MONOREPO_VOICES = _MONOREPO_ROOT / "voices"
_LOCAL_VOICES = _API_DIR / "voices"
_KOKORO_MODELS = _MONOREPO_ROOT / "kokoro-models"

if os.environ.get("VOICES_DIR"):
    VOICES_DIR = Path(os.environ["VOICES_DIR"])
elif _MONOREPO_VOICES.is_dir():
    VOICES_DIR = _MONOREPO_VOICES
else:
    VOICES_DIR = _LOCAL_VOICES

OUTPUT_DIR = Path(__file__).parent / "generated_audio"
TEMP_DIR = Path(__file__).parent / "temp"
DEFAULT_GAP_SECONDS = 0.4
TARGET_SAMPLE_RATE = 22050

OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)


def list_voices() -> list[str]:
    """Return curated voice ids (piper:* and kokoro:*)."""
    return list(CURATED_VOICE_IDS)


def list_voice_catalog() -> list[Voice]:
    return list(VOICE_BY_ID.values())


def _validate_voice(voice_id: str) -> Voice:
    voice = VOICE_BY_ID.get(voice_id)
    if voice is None:
        raise ValueError(f"Unknown voice: {voice_id}")
    return voice


def _resample_audio(data: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    if orig_sr == target_sr:
        return data.astype(np.float32)
    duration = len(data) / orig_sr
    target_len = int(duration * target_sr)
    x_old = np.linspace(0, duration, num=len(data), endpoint=False)
    x_new = np.linspace(0, duration, num=target_len, endpoint=False)
    return np.interp(x_new, x_old, data).astype(np.float32)


def _write_wav(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    import soundfile as sf

    sf.write(str(path), samples, sample_rate, subtype="PCM_16")


@lru_cache(maxsize=1)
def _kokoro_engine():
    from kokoro_onnx import Kokoro

    model_path = _KOKORO_MODELS / "kokoro-v1.0.onnx"
    voices_path = _KOKORO_MODELS / "voices-v1.0.bin"
    if not model_path.exists() or not voices_path.exists():
        raise RuntimeError(
            "Kokoro models not found. Run `make voice-bakeoff` once to download them."
        )
    return Kokoro(str(model_path), str(voices_path))


def _synth_piper(text: str, voice_key: str, out_path: Path, length_scale: float) -> None:
    model = VOICES_DIR / f"{voice_key}.onnx"
    if not model.exists():
        raise ValueError(f"Piper model not found: {voice_key}")
    cmd = [
        "piper",
        "--model",
        str(model),
        "--output_file",
        str(out_path),
        "--length_scale",
        str(length_scale),
    ]
    proc = subprocess.run(cmd, input=text, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Piper failed for '{text[:40]}...': {proc.stderr}")


def _synth_kokoro(text: str, voice_key: str, out_path: Path, speed: float) -> None:
    kokoro = _kokoro_engine()
    samples, sample_rate = kokoro.create(
        text,
        voice=voice_key,
        speed=max(0.5, min(2.0, speed)),
        lang="en-us",
    )
    samples = _resample_audio(samples, sample_rate, TARGET_SAMPLE_RATE)
    _write_wav(out_path, samples, TARGET_SAMPLE_RATE)


def _synth_line(
    text: str,
    voice_id: str,
    out_path: Path,
    length_scale: float = 1.0,
) -> None:
    """Generate a single WAV clip for one line."""
    voice = _validate_voice(voice_id)
    if voice.engine == "piper":
        _synth_piper(text, voice.voice_key, out_path, length_scale)
    else:
        # UI stores Piper-style length_scale (higher = slower). Kokoro speed is direct (higher = faster).
        _synth_kokoro(text, voice.voice_key, out_path, speed=1.0 / length_scale)


def _concat(clips: list[Path], output_file: Path, gaps: list[float]) -> None:
    """Concatenate WAV clips into one file, inserting per-clip silent gaps."""
    if not clips:
        raise ValueError("No clips to concatenate.")

    with wave.open(str(clips[0]), "rb") as first:
        params = first.getparams()
        framerate = first.getframerate()
        sampwidth = first.getsampwidth()
        channels = first.getnchannels()

    with wave.open(str(output_file), "wb") as out:
        out.setparams(params)
        for i, clip in enumerate(clips):
            with wave.open(str(clip), "rb") as w:
                out.writeframes(w.readframes(w.getnframes()))
            if i < len(clips) - 1:
                gap = gaps[i] if i < len(gaps) else DEFAULT_GAP_SECONDS
                silence = b"\x00" * int(framerate * gap) * sampwidth * channels
                out.writeframes(silence)


def _clip_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def generate_conversation(turns: list[dict]) -> tuple[str, list[dict]]:
    """
    Generate audio from a list of turns.
    turns: [{"speaker", "voice", "text", "length_scale", "gap_after"}, ...]
    Returns: (run_id, segments) where segments are {index, start, end} in seconds.
    """
    run_id = uuid.uuid4().hex[:8]
    clips: list[Path] = []

    try:
        gaps: list[float] = []
        offset = 0.0
        segments: list[dict] = []
        for idx, turn in enumerate(turns):
            clip_path = TEMP_DIR / f"{run_id}_{idx:03d}.wav"
            length_scale = turn.get("length_scale", 1.0)
            _synth_line(turn["text"], turn["voice"], clip_path, length_scale=length_scale)
            clips.append(clip_path)
            duration = _clip_duration_seconds(clip_path)
            segments.append({"index": idx, "start": offset, "end": offset + duration})
            gap = turn.get("gap_after", DEFAULT_GAP_SECONDS)
            gaps.append(gap)
            offset += duration
            if idx < len(turns) - 1:
                offset += gap

        _concat(clips, OUTPUT_DIR / f"{run_id}.wav", gaps)
    finally:
        for clip in clips:
            clip.unlink(missing_ok=True)

    return run_id, segments
