"""API request and response models."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class InterventionStatus(str, Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    ASSIGNED = "ASSIGNED"
    CONTACTED = "CONTACTED"
    FOLLOW_UP_SCHEDULED = "FOLLOW_UP_SCHEDULED"
    CLOSED = "CLOSED"


class PatientEncounter(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    encounter_id: int
    patient_nbr: int
    age: str
    time_in_hospital: int
    number_inpatient: int
    number_emergency: int
    number_outpatient: int
    num_medications: int
    num_lab_procedures: int
    discharge_disposition_id: int
    admission_type_id: int
    readmitted: str
    risk_score: int
    risk_level: RiskLevel


class EncounterCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    encounter_id: int = Field(ge=0, le=9_223_372_036_854_775_807)
    patient_nbr: int = Field(ge=0, le=9_223_372_036_854_775_807)
    age: str = Field(min_length=1, max_length=16)
    time_in_hospital: int = Field(ge=0, le=32_767)
    number_inpatient: int = Field(ge=0, le=2_147_483_647)
    number_emergency: int = Field(ge=0, le=2_147_483_647)
    number_outpatient: int = Field(ge=0, le=2_147_483_647)
    num_medications: int = Field(ge=0, le=2_147_483_647)
    num_lab_procedures: int = Field(ge=0, le=2_147_483_647)
    discharge_disposition_id: int = Field(
        ge=-2_147_483_648, le=2_147_483_647
    )
    admission_type_id: int = Field(ge=-2_147_483_648, le=2_147_483_647)
    readmitted: str = Field(min_length=1, max_length=8)


class PatientSearchFilters(BaseModel):
    patient_id: int | None = Field(
        default=None, ge=0, le=9_223_372_036_854_775_807
    )
    risk_score: int | None = Field(default=None, ge=0, le=8)
    risk_level: RiskLevel | None = None

    @property
    def has_criteria(self) -> bool:
        return any(
            value is not None
            for value in (self.patient_id, self.risk_score, self.risk_level)
        )


class CareQueueItem(PatientEncounter):
    intervention_status: InterventionStatus | None = None
    assigned_to: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class InterventionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: InterventionStatus | None = None
    assigned_to: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)


class InterventionResponse(BaseModel):
    encounter_id: int
    status: InterventionStatus
    assigned_to: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class OperationsSummary(BaseModel):
    total_encounters: int
    high_risk: int
    medium_risk: int
    low_risk: int
    pending_interventions: int
    completed_interventions: int


class RiskGroupAnalysis(BaseModel):
    patients: int
    readmitted_under_30_days: int
    readmission_rate: float


class ReadmissionAnalysis(BaseModel):
    total_encounters: int
    historical_under_30_readmissions: int
    overall_readmission_rate: float
    high_risk_patients: int
    high_risk_readmitted_under_30_days: int
    high_risk_readmission_rate: float
    medium_risk: RiskGroupAnalysis
    low_risk: RiskGroupAnalysis
    prioritized_patients: int
    prioritized_readmitted_under_30_days: int
    prioritized_readmission_rate: float
    prioritized_readmission_capture_rate: float


class ManagementDashboard(OperationsSummary):
    prioritized_patients: int
    prioritized_readmitted_under_30_days: int
    prioritized_readmission_rate: float
    prioritized_readmission_capture_rate: float
    overall_readmission_rate: float
