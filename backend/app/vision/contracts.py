from pydantic import BaseModel


class EvidenceArtifact(BaseModel):
    candidate_id: str
    media_type: str
    storage_url: str


class VisionEvidenceResult(BaseModel):
    candidate_id: str
    evidence_flags: list[str]
    confidence: float
    score_adjustment: float
