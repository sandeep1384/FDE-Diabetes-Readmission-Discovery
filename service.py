"""Business rules and orchestration for encounter prioritization."""

from typing import Any

import repository
from models import (
    ManagementDashboard,
    OperationsSummary,
    ReadmissionAnalysis,
    RiskGroupAnalysis,
    RiskLevel,
)


def calculate_risk(
    number_inpatient: int,
    number_emergency: int,
    number_outpatient: int,
    time_in_hospital: int,
    num_medications: int,
) -> tuple[int, RiskLevel]:
    """Score an encounter using operational fields only; historical outcomes are excluded."""
    score = (
        (3 if number_inpatient >= 3 else 0)
        + (2 if number_emergency >= 2 else 0)
        + (1 if number_outpatient >= 3 else 0)
        + (1 if time_in_hospital >= 7 else 0)
        + (1 if num_medications >= 20 else 0)
    )
    if score >= 5:
        return score, RiskLevel.HIGH
    if score >= 3:
        return score, RiskLevel.MEDIUM
    return score, RiskLevel.LOW


def list_encounters(
    limit: int, offset: int, risk_level: RiskLevel | None = None
) -> list[dict[str, Any]]:
    return repository.list_encounters(limit, offset, risk_level)


def get_encounter(encounter_id: int) -> dict[str, Any] | None:
    return repository.get_encounter(encounter_id)


def get_care_queue(
    limit: int, offset: int, high_only: bool = False
) -> list[dict[str, Any]]:
    risk_level = RiskLevel.HIGH if high_only else None
    return repository.list_care_queue(limit, offset, risk_level)


def update_intervention(
    encounter_id: int, changes: dict[str, Any]
) -> dict[str, Any] | None:
    if changes.get("status") is None and "status" in changes:
        raise ValueError("status cannot be null")
    if not changes:
        raise ValueError("At least one intervention field must be supplied")
    return repository.update_intervention(encounter_id, changes)


def get_operations_summary() -> OperationsSummary:
    return OperationsSummary(**repository.get_operations_counts())


def _percentage(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 2) if denominator else 0.0


def get_readmission_analysis() -> ReadmissionAnalysis:
    counts = {
        row["risk_level"]: {
            "patients": row["patients"],
            "readmitted_under_30_days": row["readmitted_under_30_days"],
        }
        for row in repository.get_readmission_counts()
    }
    groups = {
        level: counts.get(
            level, {"patients": 0, "readmitted_under_30_days": 0}
        )
        for level in (RiskLevel.HIGH.value, RiskLevel.MEDIUM.value, RiskLevel.LOW.value)
    }
    high = groups[RiskLevel.HIGH.value]
    medium = groups[RiskLevel.MEDIUM.value]
    low = groups[RiskLevel.LOW.value]
    total_patients = sum(group["patients"] for group in groups.values())
    total_readmissions = sum(
        group["readmitted_under_30_days"] for group in groups.values()
    )
    prioritized_patients = high["patients"] + medium["patients"]
    prioritized_readmissions = (
        high["readmitted_under_30_days"] + medium["readmitted_under_30_days"]
    )
    return ReadmissionAnalysis(
        total_encounters=total_patients,
        historical_under_30_readmissions=total_readmissions,
        overall_readmission_rate=_percentage(total_readmissions, total_patients),
        high_risk_patients=high["patients"],
        high_risk_readmitted_under_30_days=high["readmitted_under_30_days"],
        high_risk_readmission_rate=_percentage(
            high["readmitted_under_30_days"], high["patients"]
        ),
        medium_risk=RiskGroupAnalysis(
            **medium,
            readmission_rate=_percentage(
                medium["readmitted_under_30_days"], medium["patients"]
            ),
        ),
        low_risk=RiskGroupAnalysis(
            **low,
            readmission_rate=_percentage(
                low["readmitted_under_30_days"], low["patients"]
            ),
        ),
        prioritized_patients=prioritized_patients,
        prioritized_readmitted_under_30_days=prioritized_readmissions,
        prioritized_readmission_rate=_percentage(
            prioritized_readmissions, prioritized_patients
        ),
        prioritized_readmission_capture_rate=_percentage(
            prioritized_readmissions, total_readmissions
        ),
    )


def get_management_dashboard() -> ManagementDashboard:
    summary = get_operations_summary()
    analysis = get_readmission_analysis()
    return ManagementDashboard(
        **summary.model_dump(),
        prioritized_patients=analysis.prioritized_patients,
        prioritized_readmitted_under_30_days=(
            analysis.prioritized_readmitted_under_30_days
        ),
        prioritized_readmission_rate=analysis.prioritized_readmission_rate,
        prioritized_readmission_capture_rate=(
            analysis.prioritized_readmission_capture_rate
        ),
        overall_readmission_rate=analysis.overall_readmission_rate,
    )
