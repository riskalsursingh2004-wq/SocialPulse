import { Database, FilterX, SearchX } from 'lucide-react';
import EmptyState from './EmptyState.jsx';

/**
 * Shared "no data" / "no results" banner used at the top of every page.
 *  - no-data      → dataset is empty (offer demo data)
 *  - no-results   → dataset exists but filters hide everything (offer clear)
 */
export default function DataStateBanner({ kind, onResetDemo, onClearFilters }) {
  if (!kind) return null;

  if (kind === 'no-data') {
    return (
      <div className="card">
        <EmptyState
          icon={Database}
          title="Your dataset is empty"
          message="Import a CSV file on the Data Management page, or load the built-in demo dataset with 120 realistic posts."
          action={
            <button type="button" className="btn-primary" onClick={onResetDemo}>
              Load demo data
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="card">
      <EmptyState
        icon={SearchX}
        title="No posts match the current filters"
        message="Try widening the date range, choosing another platform/sentiment, or clearing the search."
        action={
          <button type="button" className="btn-secondary" onClick={onClearFilters}>
            <FilterX size={15} /> Clear filters
          </button>
        }
      />
    </div>
  );
}
