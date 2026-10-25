# Diabetes Patient Management UI

The patient-search page is a React and TypeScript application that searches
patient encounters through `http://127.0.0.1:8000/patients/search`. Search by
patient number, risk level, or risk score, or combine filters. Results are
displayed in pages of 100 encounters.

## Build and run

1. Install dependencies and start the React development server:

   ```powershell
   cd UI
   npm install
   npm run dev
   ```

   To create a production build, run `npm run build`. Vite writes the patient
   search app to `dist/` without removing the separately built high-risk-care
   script.

2. Start the API from the repository root:

   ```powershell
   uvicorn main:app --reload
   ```

3. Open the development URL printed by Vite. For a production build, serve
   `UI/` with a static web server; module scripts are not supported from
   `file://`.

The browser calls the API directly, so the API must be available at the address
above and allow cross-origin requests.

## High-risk care interventions

Open `/high-care/index.html` (or select **High-risk care** in the navigation)
to load the high-risk queue. Select a linked encounter ID to view its current
status, assignee, and notes. Submitting the form sends a PATCH request to
`/interventions/{encounter_id}` and updates the queue with the response.

The React patient-search source is in `src/`, organized into `Components/` and
`hooks/`. The high-risk care page remains a separate TypeScript workflow in
`high-care/`. Keep the API running at `http://127.0.0.1:8000` while using either
page.
