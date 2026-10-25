import type { PatientEncounter } from "../../patientSearch";

interface PatientRowProps {
  encounter: PatientEncounter;
}

function PatientRow({ encounter }: PatientRowProps) {
  return (
    <tr>
      <td>{encounter.encounter_id}</td>
      <td>{encounter.patient_nbr}</td>
      <td>{encounter.age}</td>
      <td>{encounter.risk_score}</td>
      <td>
        <span className={`risk-badge risk-${encounter.risk_level.toLowerCase()}`}>
          {encounter.risk_level}
        </span>
      </td>
      <td>{encounter.time_in_hospital}</td>
      <td>{encounter.number_inpatient}</td>
      <td>{encounter.number_emergency}</td>
      <td>{encounter.number_outpatient}</td>
      <td>{encounter.num_medications}</td>
      <td>{encounter.num_lab_procedures}</td>
      <td>{encounter.readmitted}</td>
    </tr>
  );
}

export default PatientRow;
