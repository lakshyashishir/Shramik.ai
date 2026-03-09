from pydantic import BaseModel


class StagePrompt(BaseModel):
    key: str
    label: str
    objective: str


DEFAULT_STAGES = [
    StagePrompt(
        key="intro",
        label="Introduction",
        objective="Verify identity, preferred language, and target garment role.",
    ),
    StagePrompt(
        key="machine",
        label="Machine familiarity",
        objective="Assess sewing machine setup, threading, and basic maintenance knowledge.",
    ),
    StagePrompt(
        key="quality",
        label="Quality checks",
        objective="Assess defect recognition, rework awareness, and process discipline.",
    ),
    StagePrompt(
        key="readiness",
        label="Work readiness",
        objective="Assess shift readiness, instruction following, and supervision fit.",
    ),
]
