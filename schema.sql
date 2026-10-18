CREATE TABLE IF NOT EXISTS patient_encounters (
    encounter_id BIGINT PRIMARY KEY,
    patient_nbr BIGINT NOT NULL,
    age VARCHAR(16) NOT NULL,
    time_in_hospital SMALLINT NOT NULL CHECK (time_in_hospital >= 0),
    number_inpatient INTEGER NOT NULL CHECK (number_inpatient >= 0),
    number_emergency INTEGER NOT NULL CHECK (number_emergency >= 0),
    number_outpatient INTEGER NOT NULL CHECK (number_outpatient >= 0),
    num_medications INTEGER NOT NULL CHECK (num_medications >= 0),
    num_lab_procedures INTEGER NOT NULL CHECK (num_lab_procedures >= 0),
    discharge_disposition_id INTEGER NOT NULL,
    admission_type_id INTEGER NOT NULL,
    readmitted VARCHAR(8) NOT NULL,
    risk_score SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 8),
    risk_level VARCHAR(6) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX IF NOT EXISTS idx_patient_encounters_risk_queue
    ON patient_encounters (risk_level, risk_score DESC, encounter_id);

CREATE INDEX IF NOT EXISTS idx_patient_encounters_readmitted
    ON patient_encounters (readmitted);

CREATE TABLE IF NOT EXISTS care_interventions (
    intervention_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_id BIGINT NOT NULL UNIQUE
        REFERENCES patient_encounters (encounter_id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (
            status IN (
                'PENDING_REVIEW',
                'ASSIGNED',
                'CONTACTED',
                'FOLLOW_UP_SCHEDULED',
                'CLOSED'
            )
        ),
    assigned_to VARCHAR(200),
    notes VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_care_interventions_status
    ON care_interventions (status);
