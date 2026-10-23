# Diabetes Readmission Care-Management MVP

A small FastAPI service that imports the provided diabetes encounter CSV into PostgreSQL, applies an explainable operational prioritization score, and tracks follow-up work for medium- and high-risk encounters.

> The score is a learning assumption for workflow prioritization, not a clinical recommendation or a validated prediction model.

## Requirements

- Python 3.10+
- PostgreSQL 13+

## Setup

1. Create a PostgreSQL database, for example `diabetes_readmission`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Install dependencies and create the tables:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   $env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/diabetes_readmission"
   psql "$env:DATABASE_URL" -f schema.sql
   ```

   Set the PowerShell variable to the same connection string configured in `.env`.

4. Put the supplied `diabetic_data.csv` at `data\diabetic_data.csv` (or pass its path to the loader), then import it:

   ```powershell
   python data_loader.py
   # Or: python data_loader.py --csv-path "C:\path\to\diabetic_data.csv"
   ```

   Importing is repeatable: encounters are upserted by `encounter_id`, while existing intervention workflow state is preserved. An initial `PENDING_REVIEW` intervention is created only for MEDIUM/HIGH encounters.

5. Start the API:

   ```powershell
   uvicorn main:app --reload
   ```

   Open `http://127.0.0.1:8000/docs` for Swagger UI.

## Risk rule and leakage boundary

The stored score is computed only from the five operational predictors below. The historical `readmitted` value is stored for retrospective evaluation, but is never passed to the scoring function.

| Condition | Points |
| --- | ---: |
| `number_inpatient >= 3` | 3 |
| `number_emergency >= 2` | 2 |
| `number_outpatient >= 3` | 1 |
| `time_in_hospital >= 7` | 1 |
| `num_medications >= 20` | 1 |

Scores map to LOW (0-2), MEDIUM (3-4), and HIGH (5+). The care queue contains MEDIUM and HIGH encounters. The dataset's `<30` outcome label is used only in `/operations/readmission-analysis` and `/management/dashboard`.

## Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/encounters` | Create an encounter; risk is calculated by the API |
| GET | `/encounters?limit=100&offset=0` | Paginated encounters |
| GET | `/encounters/{encounter_id}` | One encounter |
| GET | `/care-queue?limit=100&offset=0` | MEDIUM/HIGH queue, highest score first |
| GET | `/care-queue/high?limit=100&offset=0` | HIGH-only queue |
| PATCH | `/interventions/{encounter_id}` | Update status, owner, and/or notes |
| GET | `/operations/summary` | Encounter and intervention counts |
| GET | `/operations/readmission-analysis` | Retrospective `<30` rates by risk group and in the care queue |
| GET | `/management/dashboard` | Operational summary with historical prioritization metrics |

Workflow statuses are `PENDING_REVIEW`, `ASSIGNED`, `CONTACTED`, `FOLLOW_UP_SCHEDULED`, and `CLOSED`. The PATCH request may change any subset of `status`, `assigned_to`, and `notes`. Set owner or notes to `null` to clear them. Only encounters with a care-queue intervention can be updated.

The POST request accepts the encounter source fields (without `risk_score` or `risk_level`), for example:

```json
{
  "encounter_id": 2278392,
  "patient_nbr": 8222157,
  "age": "[0-10)",
  "time_in_hospital": 1,
  "number_inpatient": 0,
  "number_emergency": 0,
  "number_outpatient": 0,
  "num_medications": 1,
  "num_lab_procedures": 41,
  "discharge_disposition_id": 25,
  "admission_type_id": 6,
  "readmitted": "NO"
}
```

It returns the created encounter with its computed risk fields and HTTP 201. A repeated `encounter_id` returns HTTP 409. Medium- and high-risk encounters also receive a `PENDING_REVIEW` care intervention.

Example:

```json
{
  "status": "CONTACTED",
  "assigned_to": "Care Team A",
  "notes": "Follow-up appointment scheduled"
}
```

The readmission analysis reports counts, rates as percentages, and queue capture rate. Its historical metrics are retrospective and must not be interpreted as prospective model performance or clinical guidance.

## Data and table setup

`data_loader.py` selects only the requested dataset fields and stores age as the dataset's original bucket label (for example, `[70-80)`). `schema.sql` defines `patient_encounters` and `care_interventions`; `seed_or_setup.sql` is a psql convenience wrapper for applying that schema.
