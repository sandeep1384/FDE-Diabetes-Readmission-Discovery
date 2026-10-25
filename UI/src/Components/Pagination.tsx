interface PaginationProps {
  currentPage: number;
  hasNextPage: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
}

function Pagination({
  currentPage,
  hasNextPage,
  loading,
  onPageChange,
}: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Search results pages">
      <button
        className="pagination-button"
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={loading || currentPage === 0}
      >
        Previous
      </button>
      <span aria-live="polite">Page {currentPage + 1}</span>
      <button
        className="pagination-button"
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={loading || !hasNextPage}
      >
        Next
      </button>
    </nav>
  );
}

export default Pagination;
