"""FastAPI request and response handling."""

from typing import Annotated, Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import service
from models import (
    CareQueueItem,
    EncounterCreate,
    InterventionResponse,
    InterventionUpdate,
    ManagementDashboard,
    OperationsSummary,
    PatientSearchFilters,
    PatientEncounter,
    ReadmissionAnalysis,
    RiskLevel,
)

app = FastAPI(
    title="Diabetes Readmission Care-Management MVP",
    description=(
        "An explainable operational prioritization queue for historical diabetes "
        "encounters. Risk scores do not use the historical readmission outcome."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PageLimit = Annotated[int, Query(ge=1, le=1000)]
PageOffset = Annotated[int, Query(ge=0)]


@app.get("/encounters", response_model=list[PatientEncounter])
def list_encounters(
    limit: PageLimit = 100,
    offset: PageOffset = 0,
    risk_level: RiskLevel | None = None,
) -> list[dict[str, Any]]:
    return service.list_encounters(limit, offset, risk_level)


@app.get("/encounters/{encounter_id}", response_model=PatientEncounter)
def get_encounter(encounter_id: int) -> dict[str, Any]:
    encounter = service.get_encounter(encounter_id)
    if encounter is None:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter


@app.get("/patients/search", response_model=list[PatientEncounter])
def search_patients(
    patient_id: Annotated[
        int | None, Query(ge=0, le=9_223_372_036_854_775_807)
    ] = None,
    risk_score: Annotated[int | None, Query(ge=0, le=8)] = None,
    risk_level: RiskLevel | None = None,
    limit: PageLimit = 100,
    offset: PageOffset = 0,
) -> list[dict[str, Any]]:
    filters = PatientSearchFilters(
        patient_id=patient_id, risk_score=risk_score, risk_level=risk_level
    )
    if not filters.has_criteria:
        raise HTTPException(
            status_code=422,
            detail="At least one of patient_id, risk_score, or risk_level is required",
        )
    return service.search_patients(filters, limit, offset)


@app.post("/encounters", response_model=PatientEncounter, status_code=201)
def create_encounter(encounter: EncounterCreate) -> dict[str, Any]:
    created = service.insert_encounter(encounter)
    if created is None:
        raise HTTPException(
            status_code=409, detail="Encounter ID already exists"
        )
    return created


@app.get("/care-queue", response_model=list[CareQueueItem])
def get_care_queue(
    limit: PageLimit = 100, offset: PageOffset = 0
) -> list[dict[str, Any]]:
    return service.get_care_queue(limit, offset)


@app.get("/care-queue/high", response_model=list[CareQueueItem])
def get_high_risk_queue(
    limit: PageLimit = 100, offset: PageOffset = 0
) -> list[dict[str, Any]]:
    return service.get_care_queue(limit, offset, high_only=True)


@app.patch(
    "/interventions/{encounter_id}", response_model=InterventionResponse
)
def update_intervention(
    encounter_id: int, update: InterventionUpdate
) -> dict[str, Any]:
    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=422, detail="At least one intervention field is required"
        )
    try:
        intervention = service.update_intervention(encounter_id, changes)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if intervention is None:
        raise HTTPException(
            status_code=404, detail="Care-queue intervention not found"
        )
    return intervention


@app.get("/operations/summary", response_model=OperationsSummary)
def get_operations_summary() -> OperationsSummary:
    return service.get_operations_summary()


@app.get(
    "/operations/readmission-analysis", response_model=ReadmissionAnalysis
)
def get_readmission_analysis() -> ReadmissionAnalysis:
    return service.get_readmission_analysis()


@app.get("/management/dashboard", response_model=ManagementDashboard)
def get_management_dashboard() -> ManagementDashboard:
    return service.get_management_dashboard()
