from pydantic import BaseModel


class RubricDimension(BaseModel):
    key: str
    weight: float
    description: str


DEFAULT_RUBRIC = [
    RubricDimension(
        key="process_knowledge",
        weight=0.30,
        description="Knowledge of sequence, setup, and garment process steps.",
    ),
    RubricDimension(
        key="defect_awareness",
        weight=0.25,
        description="Ability to recognize stitch defects and quality issues.",
    ),
    RubricDimension(
        key="instruction_following",
        weight=0.20,
        description="Ability to follow instructions and work under supervision.",
    ),
    RubricDimension(
        key="communication",
        weight=0.10,
        description="Ability to answer clearly in the selected language.",
    ),
    RubricDimension(
        key="vision_evidence",
        weight=0.15,
        description="Adjustment based on sewing media evidence from the vision lane.",
    ),
]
