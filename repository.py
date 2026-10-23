"""Database access. SQL statements live in this module."""

from collections.abc import Iterable
from itertools import islice
from typing import Any

from database import connect
from models import RiskLevel

ENCOUNTER_COLUMNS = (
    "encounter_id",
    "patient_nbr",
    "age",
    "time_in_hospital",
    "number_inpatient",
    "number_emergency",
    "number_outpatient",
    "num_medications",
    "num_lab_procedures",
    "discharge_disposition_id",
    "admission_type_id",
    "readmitted",
    "risk_score",
    "risk_level",
)

ENCOUNTER_UPSERT = """
    INSERT INTO patient_encounters (
        encounter_id, patient_nbr, age, time_in_hospital, number_inpatient,
        number_emergency, number_outpatient, num_medications,
        num_lab_procedures, discharge_disposition_id, admission_type_id,
        readmitted, risk_score, risk_level
    ) VALUES (
        %(encounter_id)s, %(patient_nbr)s, %(age)s, %(time_in_hospital)s,
        %(number_inpatient)s, %(number_emergency)s, %(number_outpatient)s,
        %(num_medications)s, %(num_lab_procedures)s, %(discharge_disposition_id)s,
        %(admission_type_id)s, %(readmitted)s, %(risk_score)s, %(risk_level)s
    )
    ON CONFLICT (encounter_id) DO UPDATE SET
        patient_nbr = EXCLUDED.patient_nbr,
        age = EXCLUDED.age,
        time_in_hospital = EXCLUDED.time_in_hospital,
        number_inpatient = EXCLUDED.number_inpatient,
        number_emergency = EXCLUDED.number_emergency,
        number_outpatient = EXCLUDED.number_outpatient,
        num_medications = EXCLUDED.num_medications,
        num_lab_procedures = EXCLUDED.num_lab_procedures,
        discharge_disposition_id = EXCLUDED.discharge_disposition_id,
        admission_type_id = EXCLUDED.admission_type_id,
        readmitted = EXCLUDED.readmitted,
        risk_score = EXCLUDED.risk_score,
        risk_level = EXCLUDED.risk_level
"""

ENCOUNTER_INSERT = """
    INSERT INTO patient_encounters (
        encounter_id, patient_nbr, age, time_in_hospital, number_inpatient,
        number_emergency, number_outpatient, num_medications,
        num_lab_procedures, discharge_disposition_id, admission_type_id,
        readmitted, risk_score, risk_level
    ) VALUES (
        %(encounter_id)s, %(patient_nbr)s, %(age)s, %(time_in_hospital)s,
        %(number_inpatient)s, %(number_emergency)s, %(number_outpatient)s,
        %(num_medications)s, %(num_lab_procedures)s, %(discharge_disposition_id)s,
        %(admission_type_id)s, %(readmitted)s, %(risk_score)s, %(risk_level)s
    )
    ON CONFLICT (encounter_id) DO NOTHING
    RETURNING *
"""

CARE_QUEUE_SELECT = """
    SELECT pe.*, ci.status AS intervention_status, ci.assigned_to, ci.notes,
           ci.created_at, ci.updated_at
    FROM patient_encounters AS pe
    LEFT JOIN care_interventions AS ci ON ci.encounter_id = pe.encounter_id
"""


def _encounter_values(row: dict[str, Any]) -> dict[str, Any]:
    return {
        column: (row[column].value if column == "risk_level" else row[column])
        for column in ENCOUNTER_COLUMNS
    }


def load_encounters(rows: Iterable[dict[str, Any]]) -> int:
    """Upsert CSV rows and create missing interventions for prioritized encounters."""
    loaded = 0
    with connect() as connection:
        with connection.cursor() as cursor:
            iterator = iter(rows)
            while batch := list(islice(iterator, 1000)):
                cursor.executemany(
                    ENCOUNTER_UPSERT, [_encounter_values(row) for row in batch]
                )
                prioritized = [
                    {"encounter_id": row["encounter_id"]}
                    for row in batch
                    if row["risk_level"] in (RiskLevel.MEDIUM, RiskLevel.HIGH)
                ]
                if prioritized:
                    cursor.executemany(
                        """
                        INSERT INTO care_interventions (encounter_id, status)
                        VALUES (%(encounter_id)s, 'PENDING_REVIEW')
                        ON CONFLICT (encounter_id) DO NOTHING
                        """,
                        prioritized,
                    )
                loaded += len(batch)
    return loaded


def insert_encounter(row: dict[str, Any]) -> dict[str, Any] | None:
    """Insert one encounter and initialize its intervention when prioritized."""
    values = _encounter_values(row)
    with connect() as connection:
        encounter = connection.execute(ENCOUNTER_INSERT, values).fetchone()
        if encounter is None:
            return None
        if values["risk_level"] in (RiskLevel.MEDIUM.value, RiskLevel.HIGH.value):
            connection.execute(
                """
                INSERT INTO care_interventions (encounter_id, status)
                VALUES (%s, 'PENDING_REVIEW')
                """,
                (values["encounter_id"],),
            )
        return encounter


def list_encounters(
    limit: int, offset: int, risk_level: RiskLevel | None = None
) -> list[dict[str, Any]]:
    query = "SELECT * FROM patient_encounters"
    parameters: list[Any] = []
    if risk_level is not None:
        query += " WHERE risk_level = %s"
        parameters.append(risk_level.value)
    query += " ORDER BY encounter_id LIMIT %s OFFSET %s"
    parameters.extend((limit, offset))
    with connect() as connection:
        return list(connection.execute(query, parameters).fetchall())


def get_encounter(encounter_id: int) -> dict[str, Any] | None:
    with connect() as connection:
        return connection.execute(
            "SELECT * FROM patient_encounters WHERE encounter_id = %s",
            (encounter_id,),
        ).fetchone()


def list_care_queue(
    limit: int, offset: int, risk_level: RiskLevel | None = None
) -> list[dict[str, Any]]:
    query = CARE_QUEUE_SELECT
    parameters: list[Any] = []
    if risk_level is None:
        query += " WHERE pe.risk_level IN ('MEDIUM', 'HIGH')"
    else:
        query += " WHERE pe.risk_level = %s"
        parameters.append(risk_level.value)
    query += " ORDER BY pe.risk_score DESC, pe.encounter_id LIMIT %s OFFSET %s"
    parameters.extend((limit, offset))
    with connect() as connection:
        return list(connection.execute(query, parameters).fetchall())


def update_intervention(
    encounter_id: int, changes: dict[str, Any]
) -> dict[str, Any] | None:
    allowed_columns = {"status", "assigned_to", "notes"}
    if not changes or not changes.keys() <= allowed_columns:
        raise ValueError("At least one valid intervention field must be supplied")
    assignments = []
    parameters: list[Any] = []
    for column, value in changes.items():
        assignments.append(f"{column} = %s")
        parameters.append(value.value if column == "status" else value)
    assignments.append("updated_at = CURRENT_TIMESTAMP")
    parameters.append(encounter_id)
    query = f"""
        UPDATE care_interventions
        SET {", ".join(assignments)}
        WHERE encounter_id = %s
        RETURNING encounter_id, status, assigned_to, notes, created_at, updated_at
    """
    with connect() as connection:
        return connection.execute(query, parameters).fetchone()


def get_operations_counts() -> dict[str, int]:
    query = """
        SELECT
            COUNT(pe.encounter_id)::int AS total_encounters,
            COUNT(*) FILTER (WHERE pe.risk_level = 'HIGH')::int AS high_risk,
            COUNT(*) FILTER (WHERE pe.risk_level = 'MEDIUM')::int AS medium_risk,
            COUNT(*) FILTER (WHERE pe.risk_level = 'LOW')::int AS low_risk,
            COUNT(*) FILTER (WHERE ci.status = 'PENDING_REVIEW')::int
                AS pending_interventions,
            COUNT(*) FILTER (WHERE ci.status = 'CLOSED')::int
                AS completed_interventions
        FROM patient_encounters AS pe
        LEFT JOIN care_interventions AS ci ON ci.encounter_id = pe.encounter_id
    """
    with connect() as connection:
        result = connection.execute(query).fetchone()
        if result is None:
            raise RuntimeError("Database returned no row for operation counts")
        return result


def get_readmission_counts() -> list[dict[str, Any]]:
    query = """
        SELECT risk_level,
               COUNT(*)::int AS patients,
               COUNT(*) FILTER (WHERE readmitted = '<30')::int
                   AS readmitted_under_30_days
        FROM patient_encounters
        GROUP BY risk_level
    """
    with connect() as connection:
        return list(connection.execute(query).fetchall())
