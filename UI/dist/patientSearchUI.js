"use strict";
(function () {
    function getElement(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            throw new Error(`Required UI element not found: ${selector}`);
        }
        return element;
    }
    const API_BASE_URL = "http://127.0.0.1:8000";
    const SEARCH_LIMIT = 100;
    const form = getElement("#search-form");
    const searchButton = getElement("#search-button");
    const searchButtonText = getElement("#search-button > span:first-child");
    const statusMessage = getElement("#status-message");
    const resultCount = getElement("#result-count");
    const resultsRegion = getElement("#results-region");
    const resultsBody = getElement("#results-body");
    const columns = [
        ["encounter_id", "Encounter ID"],
        ["patient_nbr", "Patient number"],
        ["age", "Age"],
        ["risk_score", "Risk score"],
        ["risk_level", "Risk level"],
        ["time_in_hospital", "Days in hospital"],
        ["number_inpatient", "Inpatient"],
        ["number_emergency", "Emergency"],
        ["number_outpatient", "Outpatient"],
        ["num_medications", "Medications"],
        ["num_lab_procedures", "Lab procedures"],
        ["readmitted", "Readmitted"],
    ];
    function showStatus(message, state = "info") {
        statusMessage.textContent = message;
        statusMessage.dataset.state = state;
        statusMessage.hidden = false;
        resultsRegion.hidden = true;
    }
    function renderResults(encounters) {
        resultsBody.replaceChildren();
        resultCount.textContent = `${encounters.length} ${encounters.length === 1 ? "encounter" : "encounters"}`;
        resultCount.hidden = false;
        if (encounters.length === 0) {
            showStatus("No encounters matched your search.");
            return;
        }
        for (const encounter of encounters) {
            const row = document.createElement("tr");
            for (const [key] of columns) {
                const cell = document.createElement("td");
                const value = encounter[key] ?? "—";
                if (key === "risk_level") {
                    const badge = document.createElement("span");
                    badge.className = `risk-badge risk-${String(value).toLowerCase()}`;
                    badge.textContent = String(value);
                    cell.append(badge);
                }
                else {
                    cell.textContent = String(value);
                }
                row.append(cell);
            }
            resultsBody.append(row);
        }
        statusMessage.hidden = true;
        resultsRegion.hidden = false;
    }
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const patientId = String(formData.get("patient_id") ?? "").trim();
        const riskLevel = String(formData.get("risk_level") ?? "");
        const riskScore = String(formData.get("risk_score") ?? "").trim();
        if (!patientId && !riskLevel && !riskScore) {
            resultCount.hidden = true;
            showStatus("Enter a patient number or choose a risk filter.", "error");
            return;
        }
        const params = new URLSearchParams({
            limit: String(SEARCH_LIMIT),
            offset: "0",
        });
        if (patientId)
            params.set("patient_id", patientId);
        if (riskLevel)
            params.set("risk_level", riskLevel);
        if (riskScore)
            params.set("risk_score", riskScore);
        searchButton.disabled = true;
        searchButtonText.textContent = "Searching…";
        resultCount.hidden = true;
        showStatus("Searching patient encounters…");
        try {
            const response = await fetch(`${API_BASE_URL}/patients/search?${params.toString()}`, { headers: { Accept: "application/json" } });
            const body = await response.json();
            if (!response.ok) {
                const errorBody = typeof body === "object" && body !== null
                    ? body
                    : {};
                const detail = typeof errorBody.detail === "string"
                    ? errorBody.detail
                    : JSON.stringify(errorBody.detail ?? body);
                throw new Error(`Search failed (${response.status}): ${detail}`);
            }
            if (!Array.isArray(body) ||
                !body.every((item) => typeof item === "object" &&
                    item !== null &&
                    "encounter_id" in item &&
                    typeof item.encounter_id === "number" &&
                    "patient_nbr" in item &&
                    typeof item.patient_nbr === "number" &&
                    "risk_score" in item &&
                    typeof item.risk_score === "number" &&
                    "risk_level" in item &&
                    ["LOW", "MEDIUM", "HIGH"].includes(String(item.risk_level)))) {
                throw new Error("The API returned an invalid patient search response.");
            }
            renderResults(body);
        }
        catch (error) {
            const message = error instanceof TypeError
                ? "Could not reach the API. Make sure it is running at http://127.0.0.1:8000."
                : error instanceof Error
                    ? error.message
                    : "An unexpected error occurred while searching.";
            resultCount.hidden = true;
            showStatus(message, "error");
        }
        finally {
            searchButton.disabled = false;
            searchButtonText.textContent = "Search patients";
        }
    });
})();
