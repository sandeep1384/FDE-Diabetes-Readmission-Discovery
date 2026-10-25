export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PatientEncounter {
  encounter_id: number;
  patient_nbr: number;
  age: string;
  time_in_hospital: number;
  number_inpatient: number;
  number_emergency: number;
  number_outpatient: number;
  num_medications: number;
  num_lab_procedures: number;
  discharge_disposition_id: number;
  admission_type_id: number;
  readmitted: string;
  risk_score: number;
  risk_level: RiskLevel;
}

export interface PatientSearchOptions {
  patient_id?: number;
  risk_score?: number;
  risk_level?: RiskLevel;
  limit?: number;
  offset?: number;
  baseUrl?: string;
  signal?: AbortSignal;
}

function isPatientEncounter(value: unknown): value is PatientEncounter {
  if (typeof value !== "object" || value === null) return false;

  const encounter = value as Record<string, unknown>;
  return (
    typeof encounter.encounter_id === "number" &&
    typeof encounter.patient_nbr === "number" &&
    typeof encounter.age === "string" &&
    typeof encounter.time_in_hospital === "number" &&
    typeof encounter.number_inpatient === "number" &&
    typeof encounter.number_emergency === "number" &&
    typeof encounter.number_outpatient === "number" &&
    typeof encounter.num_medications === "number" &&
    typeof encounter.num_lab_procedures === "number" &&
    typeof encounter.discharge_disposition_id === "number" &&
    typeof encounter.admission_type_id === "number" &&
    typeof encounter.readmitted === "string" &&
    typeof encounter.risk_score === "number" &&
    (encounter.risk_level === "LOW" ||
      encounter.risk_level === "MEDIUM" ||
      encounter.risk_level === "HIGH")
  );
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export class PatientSearchApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PatientSearchApiError";
    this.status = status;
  }
}

export async function searchPatients(
  options: PatientSearchOptions,
): Promise<PatientEncounter[]> {
  const { patient_id, risk_score, risk_level, limit = 100, offset = 0 } = options;

  if (
    patient_id === undefined &&
    risk_score === undefined &&
    risk_level === undefined
  ) {
    throw new TypeError("Provide at least one patient search filter.");
  }
  if (
    patient_id !== undefined &&
    (!Number.isSafeInteger(patient_id) || patient_id < 0)
  ) {
    throw new RangeError("patient_id must be a non-negative safe integer.");
  }
  if (
    risk_score !== undefined &&
    (!Number.isInteger(risk_score) || risk_score < 0 || risk_score > 8)
  ) {
    throw new RangeError("risk_score must be an integer from 0 to 8.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new RangeError("limit must be an integer from 1 to 1000.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RangeError("offset must be a non-negative integer.");
  }

  const baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/patients/search`);
  if (patient_id !== undefined) url.searchParams.set("patient_id", String(patient_id));
  if (risk_score !== undefined) url.searchParams.set("risk_score", String(risk_score));
  if (risk_level !== undefined) url.searchParams.set("risk_level", risk_level);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url, { signal: options.signal });
  const body = await response.text();

  if (!response.ok) {
    let detail: unknown = body;
    try {
      const parsed: unknown = JSON.parse(body);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "detail" in parsed
      ) {
        detail = parsed.detail;
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    const message =
      typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new PatientSearchApiError(
      `Patient search failed (${response.status}): ${message}`,
      response.status,
    );
  }

  const result: unknown = JSON.parse(body);
  if (!Array.isArray(result) || !result.every(isPatientEncounter)) {
    throw new Error("Patient search API returned an invalid response.");
  }
  return result;
}
