import { useState, type FormEvent } from "react";
import Header from "./Components/Header";
import PatientTable from "./Components/PatientTable";
import Pagination from "./Components/Pagination";
import { usePatientSearch } from "./hooks/usePatientSearch";
import type { RiskLevel } from "../patientSearch";
import type { PatientSearchFilters } from "./hooks/usePatientSearch";

function App() {
  const {
    encounters,
    error,
    hasSearched,
    hasNextPage,
    loading,
    page,
    search,
    setPage,
  } = usePatientSearch();
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const patientId = String(formData.get("patient_id") ?? "").trim();
    const riskLevel = String(formData.get("risk_level") ?? "");
    const riskScore = String(formData.get("risk_score") ?? "").trim();

    if (!patientId && !riskLevel && !riskScore) {
      setValidationError("Enter a patient number or choose a risk filter.");
      return;
    }

    const filters: PatientSearchFilters = {};
    if (patientId) filters.patient_id = Number(patientId);
    if (riskLevel) filters.risk_level = riskLevel as RiskLevel;
    if (riskScore) filters.risk_score = Number(riskScore);

    setValidationError(null);
    search(filters);
  }

  const statusMessage = loading
    ? "Searching patient encounters…"
    : validationError ??
      error ??
      (!hasSearched
        ? "Enter a patient number or choose a risk filter to get started."
        : "No encounters matched your search.");
  const statusIsError = Boolean(validationError ?? error);
  const showResults =
    hasSearched &&
    !loading &&
    !error &&
    !validationError &&
    encounters.length > 0;

  return (
    <>
      <Header />
      <main className="page">
        <section className="search-card" aria-labelledby="page-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PATIENT LOOKUP</p>
              <h1 id="page-title">Search patients</h1>
              <p className="intro">
                Find encounters by patient number, risk level, or risk score.
              </p>
            </div>
            <span className="heading-icon" aria-hidden="true">⌕</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="filters">
              <label className="field" htmlFor="patient-number">
                <span>Patient number</span>
                <input
                  id="patient-number"
                  name="patient_id"
                  type="number"
                  min="0"
                  max="9007199254740991"
                  step="1"
                  inputMode="numeric"
                  placeholder="e.g. 333"
                />
              </label>

              <label className="field" htmlFor="risk-level">
                <span>Risk level</span>
                <select id="risk-level" name="risk_level" defaultValue="">
                  <option value="">All risk levels</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </label>

              <label className="field" htmlFor="risk-score">
                <span>Risk score</span>
                <input
                  id="risk-score"
                  name="risk_score"
                  type="number"
                  min="0"
                  max="8"
                  step="1"
                  inputMode="numeric"
                  placeholder="0–8"
                />
              </label>

              <button className="search-button" type="submit" disabled={loading}>
                <span>{loading ? "Searching…" : "Search patients"}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </section>

        <section className="results-card" aria-labelledby="results-title">
          <div className="results-heading">
            <div>
              <p className="eyebrow">PATIENT RECORDS</p>
              <h2 id="results-title">Search results</h2>
            </div>
            {showResults && (
              <span className="result-count" aria-live="polite">
                {encounters.length} {encounters.length === 1 ? "encounter" : "encounters"}
              </span>
            )}
          </div>

          {!showResults ? (
            <div className="status-message" role="status" data-state={statusIsError ? "error" : "info"}>
              {statusMessage}
            </div>
          ) : (
            <>
              <PatientTable encounters={encounters} />
              <Pagination
                currentPage={page}
                hasNextPage={hasNextPage}
                loading={loading}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
        <p className="page-note">
          Risk scores support operational prioritization and are not clinical
          recommendations.
        </p>
      </main>
    </>
  );
}

export default App;
