import json
import subprocess
import wave
from pathlib import Path

VOICES_DIR = Path("voices")
TEMP_DIR = Path("temp")
GAP_SECONDS = 0.4  # pause inserted between speaker turns


def synth_line(text: str, voice: str, out_path: Path) -> None:
    """Generate a single WAV clip for one line using Piper."""
    model = VOICES_DIR / f"{voice}.onnx"
    if not model.exists():
        raise FileNotFoundError(
            f"Voice model not found: {model}\n"
            f"Download voices with: python download_voices.py\n"
            f"Or manually download from: https://github.com/rhasspy/piper/releases"
        )
    cmd = ["piper", "--model", str(model), "--output_file", str(out_path)]
    proc = subprocess.run(cmd, input=text, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Piper failed for '{text[:40]}...': {proc.stderr}")


def concat_wavs(clips: list[Path], output_file: Path, gap: float = GAP_SECONDS) -> None:
    """Concatenate WAV clips into one file, inserting a short silent gap."""
    if not clips:
        raise ValueError("No clips to concatenate.")

    with wave.open(str(clips[0]), "rb") as first:
        params = first.getparams()
        framerate = first.getframerate()
        sampwidth = first.getsampwidth()
        channels = first.getnchannels()

    silence = b"\x00" * int(framerate * gap) * sampwidth * channels

    with wave.open(str(output_file), "wb") as out:
        out.setparams(params)
        for i, clip in enumerate(clips):
            with wave.open(str(clip), "rb") as w:
                out.writeframes(w.readframes(w.getnframes()))
            if i < len(clips) - 1:
                out.writeframes(silence)


def generate(conversation_file: str, output_file: str = "rehearsal.wav") -> None:
    TEMP_DIR.mkdir(exist_ok=True)

    with open(conversation_file) as f:
        data = json.load(f)

    clips = []
    for idx, turn in enumerate(data["conversation"]):
        clip_path = TEMP_DIR / f"turn_{idx:03d}.wav"
        print(f"[{turn['speaker']}] {turn['text'][:60]}...")
        synth_line(turn["text"], turn["voice"], clip_path)
        clips.append(clip_path)

    concat_wavs(clips, Path(output_file))
    print(f"\nDone → {output_file}")

    for clip in clips:
        clip.unlink()


if __name__ == "__main__":
    generate("conversation.json", "rehearsal.wav")
