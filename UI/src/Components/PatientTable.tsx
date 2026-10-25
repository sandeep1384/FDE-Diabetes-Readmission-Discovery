import type { PatientEncounter } from "../../patientSearch";
import PatientRow from "./PatientRow";

interface PatientTableProps {
  encounters: PatientEncounter[];
}

function PatientTable({ encounters }: PatientTableProps) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Encounter ID</th>
            <th scope="col">Patient number</th>
            <th scope="col">Age</th>
            <th scope="col">Risk score</th>
            <th scope="col">Risk level</th>
            <th scope="col">Days in hospital</th>
            <th scope="col">Inpatient</th>
            <th scope="col">Emergency</th>
            <th scope="col">Outpatient</th>
            <th scope="col">Medications</th>
            <th scope="col">Lab procedures</th>
            <th scope="col">Readmitted</th>
          </tr>
        </thead>
        <tbody>
          {encounters.map((encounter) => (
            <PatientRow key={encounter.encounter_id} encounter={encounter} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PatientTable;
