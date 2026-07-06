"""Curated en_US Kokoro voice catalog."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Engine = Literal["kokoro"]
Gender = Literal["male", "female"]


@dataclass(frozen=True)
class Voice:
    id: str
    engine: Engine
    voice_key: str
    display_name: str
    gender: Gender
    default_length_scale: float

    @property
    def preview_filename(self) -> str:
        return f"{self.id.replace(':', '_')}.wav"


CURATED_VOICES: list[Voice] = [
    Voice(
        id="kokoro:af_heart",
        engine="kokoro",
        voice_key="af_heart",
        display_name="Heart",
        gender="female",
        default_length_scale=1.0,
    ),
    Voice(
        id="kokoro:af_bella",
        engine="kokoro",
        voice_key="af_bella",
        display_name="Bella",
        gender="female",
        default_length_scale=1.0,
    ),
    Voice(
        id="kokoro:af_sarah",
        engine="kokoro",
        voice_key="af_sarah",
        display_name="Sarah",
        gender="female",
        default_length_scale=1.0,
    ),
    Voice(
        id="kokoro:am_michael",
        engine="kokoro",
        voice_key="am_michael",
        display_name="Michael",
        gender="male",
        default_length_scale=1.0,
    ),
    Voice(
        id="kokoro:am_fenrir",
        engine="kokoro",
        voice_key="am_fenrir",
        display_name="Fenrir",
        gender="male",
        default_length_scale=1.0,
    ),
    Voice(
        id="kokoro:am_adam",
        engine="kokoro",
        voice_key="am_adam",
        display_name="Adam",
        gender="male",
        default_length_scale=1.0,
    ),
]

CURATED_VOICE_IDS = [v.id for v in CURATED_VOICES]
VOICE_BY_ID = {v.id: v for v in CURATED_VOICES}

DEFAULT_VOICE_ID = "kokoro:am_michael"
