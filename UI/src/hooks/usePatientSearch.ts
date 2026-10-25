import { useEffect, useState } from "react";
import {
  searchPatients,
  type PatientEncounter,
  type PatientSearchOptions,
} from "../../patientSearch";

const PAGE_SIZE = 100;

export type PatientSearchFilters = Pick<
  PatientSearchOptions,
  "patient_id" | "risk_level" | "risk_score"
>;

interface PatientSearchState {
  encounters: PatientEncounter[];
  error: string | null;
  hasSearched: boolean;
  hasNextPage: boolean;
  loading: boolean;
  page: number;
  search: (filters: PatientSearchFilters) => void;
  setPage: (page: number) => void;
}

export function usePatientSearch(): PatientSearchState {
  const [filters, setFilters] = useState<PatientSearchFilters | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const [page, setPage] = useState(0);
  const [encounters, setEncounters] = useState<PatientEncounter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filters) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    searchPatients({
      ...filters,
      limit: PAGE_SIZE + 1,
      offset: page * PAGE_SIZE,
      signal: controller.signal,
    })
      .then((results) => {
        setEncounters(results.slice(0, PAGE_SIZE));
        setHasNextPage(results.length > PAGE_SIZE);
      })
      .catch((searchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          searchError instanceof TypeError
            ? "Could not reach the API. Make sure it is running at http://127.0.0.1:8000."
            : searchError instanceof Error
              ? searchError.message
              : "An unexpected error occurred while searching.",
        );
        setEncounters([]);
        setHasNextPage(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, page, searchVersion]);

  function search(nextFilters: PatientSearchFilters) {
    setFilters(nextFilters);
    setPage(0);
    setSearchVersion((version) => version + 1);
  }

  return {
    encounters,
    error,
    hasSearched: filters !== null,
    hasNextPage,
    loading,
    page,
    search,
    setPage,
  };
}
