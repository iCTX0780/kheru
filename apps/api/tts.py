import os
import subprocess
import uuid
import wave
from pathlib import Path

_API_DIR = Path(__file__).resolve().parent
_MONOREPO_VOICES = _API_DIR.parent.parent / "voices"
_LOCAL_VOICES = _API_DIR / "voices"

if os.environ.get("VOICES_DIR"):
    VOICES_DIR = Path(os.environ["VOICES_DIR"])
elif _MONOREPO_VOICES.is_dir():
    VOICES_DIR = _MONOREPO_VOICES
else:
    VOICES_DIR = _LOCAL_VOICES
OUTPUT_DIR = Path(__file__).parent / "generated_audio"
TEMP_DIR = Path(__file__).parent / "temp"
DEFAULT_GAP_SECONDS = 0.4

OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)


def list_voices() -> list[str]:
    """Return sorted list of available voice names (from .onnx files in voices/)."""
    return sorted(p.stem for p in VOICES_DIR.glob("*.onnx"))


def _validate_voice(voice: str) -> None:
    if voice not in list_voices():
        raise ValueError(f"Unknown voice: {voice}")


def _synth_line(text: str, voice: str, out_path: Path, length_scale: float = 1.0) -> None:
    """Generate a single WAV clip for one line using Piper."""
    _validate_voice(voice)
    model = VOICES_DIR / f"{voice}.onnx"
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
    segments: list[dict] = []

    try:
        gaps: list[float] = []
        offset = 0.0
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
