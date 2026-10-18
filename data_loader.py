"""Load the selected diabetes dataset fields into PostgreSQL."""

import argparse
import csv
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import repository
from service import calculate_risk

DEFAULT_CSV_PATH = Path(__file__).resolve().parent / "data" / "diabetic_data.csv"
REQUIRED_COLUMNS = {
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
}
INTEGER_COLUMNS = (
    "encounter_id",
    "patient_nbr",
    "time_in_hospital",
    "number_inpatient",
    "number_emergency",
    "number_outpatient",
    "num_medications",
    "num_lab_procedures",
    "discharge_disposition_id",
    "admission_type_id",
)


def iter_encounters(csv_path: Path) -> Iterator[dict[str, Any]]:
    """Parse selected columns and calculate risk without passing the outcome to scoring."""
    with csv_path.open("r", newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        missing_columns = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing_columns:
            raise ValueError(
                f"CSV is missing required columns: {', '.join(sorted(missing_columns))}"
            )
        for line_number, source_row in enumerate(reader, start=2):
            row: dict[str, Any] = {}
            try:
                for column in INTEGER_COLUMNS:
                    value = source_row[column]
                    if value in (None, "", "?"):
                        raise ValueError(f"{column} is missing")
                    row[column] = int(value)
                age = source_row["age"]
                readmitted = source_row["readmitted"]
                if not age or not readmitted:
                    raise ValueError("age or readmitted is missing")
                row["age"] = age
                row["readmitted"] = readmitted
            except (TypeError, ValueError) as error:
                raise ValueError(
                    f"Invalid data on CSV line {line_number}: {error}"
                ) from error

            risk_score, risk_level = calculate_risk(
                number_inpatient=row["number_inpatient"],
                number_emergency=row["number_emergency"],
                number_outpatient=row["number_outpatient"],
                time_in_hospital=row["time_in_hospital"],
                num_medications=row["num_medications"],
            )
            row["risk_score"] = risk_score
            row["risk_level"] = risk_level
            yield row


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Load diabetes encounters and initialize care-queue interventions."
    )
    parser.add_argument(
        "--csv-path",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help=f"Input CSV (default: {DEFAULT_CSV_PATH})",
    )
    arguments = parser.parse_args()
    if not arguments.csv_path.is_file():
        raise FileNotFoundError(f"Dataset file not found: {arguments.csv_path}")
    loaded = repository.load_encounters(iter_encounters(arguments.csv_path))
    print(f"Loaded {loaded} encounters from {arguments.csv_path}")


if __name__ == "__main__":
    main()
