(function (): void {
const INTERVENTION_STATUSES = [
  "PENDING_REVIEW",
  "ASSIGNED",
  "CONTACTED",
  "FOLLOW_UP_SCHEDULED",
  "CLOSED",
] as const;

type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

function parseInterventionStatus(value: string): InterventionStatus {
  if (
    INTERVENTION_STATUSES.includes(value as InterventionStatus)
  ) {
    return value as InterventionStatus;
  }
  throw new Error(`Unsupported intervention status: ${value}`);
}

interface HighRiskEncounter {
  encounter_id: number;
  patient_nbr: number;
  risk_score: number;
  intervention_status: InterventionStatus | null;
  assigned_to: string | null;
  notes: string | null;
  updated_at: string | null;
}

interface InterventionResponse {
  encounter_id: number;
  status: InterventionStatus;
  assigned_to: string | null;
  notes: string | null;
  updated_at: string;
}

interface InterventionUpdate {
  status: InterventionStatus;
  assigned_to: string | null;
  notes: string | null;
}

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required UI element not found: ${selector}`);
  }
  return element;
}

const API_BASE_URL = "http://127.0.0.1:8000";
const QUEUE_LIMIT = 100;

const form = getElement<HTMLFormElement>("#intervention-form");
const encounterInput = getElement<HTMLInputElement>("#encounter-id");
const patientInput = getElement<HTMLInputElement>("#patient-number");
const statusSelect = getElement<HTMLSelectElement>("#intervention-status");
const assignedInput = getElement<HTMLInputElement>("#assigned-to");
const notesInput = getElement<HTMLTextAreaElement>("#care-notes");
const updateButton = getElement<HTMLButtonElement>("#update-button");
const formMessage = getElement<HTMLParagraphElement>("#form-message");
const queueMessage = getElement<HTMLDivElement>("#queue-message");
const queueRegion = getElement<HTMLDivElement>("#queue-region");
const queueCount = getElement<HTMLSpanElement>("#queue-count");
const queueBody = getElement<HTMLTableSectionElement>("#queue-body");
const queuePagination = getElement<HTMLDivElement>("#queue-pagination");
const previousPageButton =
  getElement<HTMLButtonElement>("#previous-page");
const nextPageButton = getElement<HTMLButtonElement>("#next-page");
const pageLabel = getElement<HTMLSpanElement>("#page-label");

const queue = new Map<number, HighRiskEncounter>();
const PAGE_SIZE = 100;
let pageOffset = 0;
let selectedEncounterId: number | null = null;

function setFormMessage(
  message: string,
  state: "info" | "success" | "error" = "info",
): void {
  formMessage.textContent = message;
  formMessage.dataset.state = state;
}

function setQueueMessage(
  message: string,
  state: "info" | "error" = "info",
): void {
  queueMessage.textContent = message;
  queueMessage.dataset.state = state;
  queueMessage.hidden = false;
  queueRegion.hidden = true;
}

function enableForm(enabled: boolean): void {
  statusSelect.disabled = !enabled;
  assignedInput.disabled = !enabled;
  notesInput.disabled = !enabled;
  updateButton.disabled = !enabled;
}

function formatStatus(status: InterventionStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function selectEncounter(encounterId: number): void {
  const encounter = queue.get(encounterId);
  if (!encounter) return;

  selectedEncounterId = encounterId;
  encounterInput.value = String(encounter.encounter_id);
  patientInput.value = String(encounter.patient_nbr);
  statusSelect.value = encounter.intervention_status ?? "PENDING_REVIEW";
  assignedInput.value = encounter.assigned_to ?? "";
  notesInput.value = encounter.notes ?? "";
  enableForm(true);
  setFormMessage(
    `Current intervention status: ${formatStatus(
      parseInterventionStatus(statusSelect.value),
    )}.`,
  );

  for (const row of queueBody.querySelectorAll("tr")) {
    row.classList.toggle(
      "is-selected",
      Number(row.dataset.encounterId) === selectedEncounterId,
    );
  }
}

function renderQueue(encounters: HighRiskEncounter[]): void {
  queue.clear();
  queueBody.replaceChildren();
  queueCount.textContent = `${encounters.length} ${
    encounters.length === 1 ? "encounter" : "encounters"
  }`;
  queueCount.hidden = false;

  if (encounters.length === 0) {
    selectedEncounterId = null;
    encounterInput.value = "";
    patientInput.value = "";
    enableForm(false);
    setQueueMessage("There are no high-risk care encounters in the queue.");
    return;
  }

  for (const encounter of encounters) {
    queue.set(encounter.encounter_id, encounter);
    const row = document.createElement("tr");
    row.dataset.encounterId = String(encounter.encounter_id);

    const encounterCell = document.createElement("td");
    const encounterLink = document.createElement("a");
    encounterLink.href = "#intervention-form";
    encounterLink.className = "encounter-link";
    encounterLink.textContent = String(encounter.encounter_id);
    encounterLink.setAttribute(
      "aria-label",
      `Open intervention for encounter ${encounter.encounter_id}`,
    );
    encounterLink.addEventListener("click", (event) => {
      event.preventDefault();
      selectEncounter(encounter.encounter_id);
      encounterInput.focus();
    });
    encounterCell.append(encounterLink);
    row.append(encounterCell);

    const values: Array<number | string> = [
      encounter.patient_nbr,
      encounter.risk_score,
      formatStatus(encounter.intervention_status ?? "PENDING_REVIEW"),
      encounter.assigned_to || "—",
      encounter.notes || "—",
      formatTimestamp(encounter.updated_at),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      if (
        typeof value === "string" &&
        [
          "Pending Review",
          "Assigned",
          "Contacted",
          "Follow-up Scheduled",
          "Closed",
        ].includes(value)
      ) {
        cell.className = "intervention-status";
      }
      cell.textContent = String(value);
      row.append(cell);
    }

    queueBody.append(row);
  }

  queuePagination.hidden = false;
  previousPageButton.disabled = pageOffset === 0;
  nextPageButton.disabled = encounters.length < PAGE_SIZE;
  pageLabel.textContent = `Showing ${pageOffset + 1}–${pageOffset + encounters.length}`;
  queueMessage.hidden = true;
  queueRegion.hidden = false;
  selectEncounter(encounters[0].encounter_id);
}

async function loadHighRiskQueue() {
  queueCount.hidden = true;
  queuePagination.hidden = true;
  setQueueMessage("Loading high-risk encounters…");

  try {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(pageOffset),
    });
    const response = await fetch(
      `${API_BASE_URL}/care-queue/high?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );
    const body = await response.json();
    if (!response.ok) {
      const detail =
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail ?? body);
      throw new Error(
        `Could not load the high-risk queue (${response.status}): ${detail}`,
      );
    }
    if (
      !Array.isArray(body) ||
      !body.every(
        (item: unknown) =>
          typeof item === "object" &&
          item !== null &&
          "encounter_id" in item &&
          typeof item.encounter_id === "number" &&
          "patient_nbr" in item &&
          typeof item.patient_nbr === "number" &&
          "risk_score" in item &&
          typeof item.risk_score === "number",
      )
    ) {
      throw new Error("The API returned an invalid high-risk queue response.");
    }
    renderQueue(body as HighRiskEncounter[]);
  } catch (error) {
    const message =
      error instanceof TypeError
        ? "Could not reach the API. Make sure it is running at http://127.0.0.1:8000."
        : error instanceof Error
          ? error.message
          : "An unexpected error occurred while loading the queue.";
    setQueueMessage(message, "error");
  }
}

function changePage(offset: number): void {
  pageOffset = Math.max(0, offset);
  selectedEncounterId = null;
  encounterInput.value = "";
  patientInput.value = "";
  statusSelect.value = "PENDING_REVIEW";
  assignedInput.value = "";
  notesInput.value = "";
  enableForm(false);
  setFormMessage("Select an encounter below to review its intervention.");
  loadHighRiskQueue();
}

previousPageButton.addEventListener("click", () =>
  changePage(pageOffset - PAGE_SIZE),
);
nextPageButton.addEventListener("click", () =>
  changePage(pageOffset + PAGE_SIZE),
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (selectedEncounterId === null) return;

  updateButton.disabled = true;
  setFormMessage("Saving intervention…");
  const payload: InterventionUpdate = {
    status: parseInterventionStatus(statusSelect.value),
    assigned_to: assignedInput.value.trim() || null,
    notes: notesInput.value.trim() || null,
  };

  try {
    const response = await fetch(
      `${API_BASE_URL}/interventions/${selectedEncounterId}`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const body: unknown = await response.json();
    if (!response.ok) {
      const errorBody = body as { detail?: unknown };
      const detail =
        typeof errorBody.detail === "string"
          ? errorBody.detail
          : JSON.stringify(errorBody.detail ?? body);
      throw new Error(`Update failed (${response.status}): ${detail}`);
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("status" in body) ||
      !("updated_at" in body) ||
      typeof body.status !== "string" ||
      typeof body.updated_at !== "string"
    ) {
      throw new Error("The API returned an invalid intervention response.");
    }
    const intervention = body as InterventionResponse;

    const encounter = queue.get(selectedEncounterId);
    if (!encounter) {
      throw new Error("The selected encounter is no longer in the queue.");
    }
    Object.assign(encounter, {
      intervention_status: intervention.status,
      assigned_to: intervention.assigned_to,
      notes: intervention.notes,
      updated_at: intervention.updated_at,
    });
    renderQueue([...queue.values()]);
    selectEncounter(selectedEncounterId);
    setFormMessage("Intervention updated successfully.", "success");
  } catch (error) {
    const message =
      error instanceof TypeError
        ? "Could not reach the API. Check that it is running and try again."
        : error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating the intervention.";
    setFormMessage(message, "error");
  } finally {
    updateButton.disabled = selectedEncounterId === null;
  }
});

enableForm(false);
loadHighRiskQueue();
})();
