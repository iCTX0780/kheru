import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, FastAPI, HTTPException, Path as PathParam
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import tts

APP_DIR = Path(__file__).parent
OUTPUT_DIR = APP_DIR / "generated_audio"
SPEAKERS_FILE = APP_DIR / "speakers.json"
FRONTEND_DIR = APP_DIR / "frontend"

app = FastAPI(title="VoxLab")
router = APIRouter(prefix="/api", tags=["tts"])


class Turn(BaseModel):
    speaker: str = Field(min_length=1)
    voice: str = Field(min_length=1)
    text: str = Field(min_length=1)
    length_scale: float = Field(default=1.0, ge=0.25, le=4.0)
    gap_after: float = Field(default=0.4, ge=0.0, le=5.0)


class ConversationRequest(BaseModel):
    conversation: list[Turn] = Field(min_length=1)


class SpeakerProfile(BaseModel):
    name: str = Field(min_length=1)
    voice: str = Field(min_length=1)
    length_scale: float = Field(ge=0.25, le=4.0)


class VoiceInfo(BaseModel):
    id: str
    engine: str
    display_name: str
    gender: str
    default_length_scale: float


class VoicesResponse(BaseModel):
    voices: list[VoiceInfo]


class SpeakersResponse(BaseModel):
    profiles: dict[str, dict[str, str | float]]


class SegmentTimestamp(BaseModel):
    index: int
    start: float
    end: float


class GenerateResponse(BaseModel):
    run_id: str
    audio_url: str
    segments: list[SegmentTimestamp] = Field(default_factory=list)


class SuccessResponse(BaseModel):
    success: bool = True


def _load_speakers() -> dict:
    if SPEAKERS_FILE.exists():
        with open(SPEAKERS_FILE) as f:
            return json.load(f)
    return {}


def _save_speakers(speakers: dict) -> None:
    with open(SPEAKERS_FILE, "w") as f:
        json.dump(speakers, f, indent=2)


@router.get("/voices")
def voices() -> VoicesResponse:
    return VoicesResponse(
        voices=[
            VoiceInfo(
                id=v.id,
                engine=v.engine,
                display_name=v.display_name,
                gender=v.gender,
                default_length_scale=v.default_length_scale,
            )
            for v in tts.list_voice_catalog()
        ]
    )


@router.get("/speakers")
def speakers() -> SpeakersResponse:
    return SpeakersResponse(profiles=_load_speakers())


@router.post("/speakers")
def save_speaker(profile: SpeakerProfile) -> SuccessResponse:
    if profile.voice not in tts.list_voices():
        raise HTTPException(status_code=400, detail=f"Unknown voice: {profile.voice}")
    speakers = _load_speakers()
    speakers[profile.name] = {
        "voice": profile.voice,
        "length_scale": profile.length_scale,
    }
    _save_speakers(speakers)
    return SuccessResponse()


@router.delete("/speakers/{name}")
def delete_speaker(name: Annotated[str, PathParam(min_length=1)]) -> SuccessResponse:
    speakers = _load_speakers()
    if name in speakers:
        del speakers[name]
        _save_speakers(speakers)
    return SuccessResponse()


@router.post("/generate")
def generate(req: ConversationRequest) -> GenerateResponse:
    try:
        turns = [t.model_dump() for t in req.conversation]
        run_id, segments = tts.generate_conversation(turns)
        return GenerateResponse(
            run_id=run_id,
            audio_url=f"/api/audio/{run_id}",
            segments=[SegmentTimestamp(**s) for s in segments],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/audio/{run_id}")
def audio(
    run_id: Annotated[str, PathParam(pattern=r"^[0-9a-f]{8}$")],
) -> FileResponse:
    path = OUTPUT_DIR / f"{run_id}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/wav")


app.include_router(router)

if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
