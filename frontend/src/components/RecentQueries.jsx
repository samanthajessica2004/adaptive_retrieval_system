import { History, X } from "lucide-react";

const RecentQueries = ({ items, onPick, onRemove, onClear, testIdPrefix = "recent" }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="recent-queries" data-testid={`${testIdPrefix}-container`}>
      <div className="recent-queries-label">
        <History size={11} />
        Recent
      </div>
      <div className="recent-queries-chips">
        {items.map((q) => (
          <div
            key={q}
            className="recent-chip"
            data-testid={`${testIdPrefix}-chip`}
          >
            <button
              type="button"
              className="recent-chip-text"
              onClick={() => onPick(q)}
              data-testid={`${testIdPrefix}-pick`}
              title={q}
            >
              {q.length > 42 ? q.slice(0, 42) + "…" : q}
            </button>
            <button
              type="button"
              className="recent-chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(q);
              }}
              data-testid={`${testIdPrefix}-remove`}
              title="Remove"
              aria-label={`Remove ${q}`}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="recent-clear-btn"
          onClick={onClear}
          data-testid={`${testIdPrefix}-clear`}
          title="Clear all recent queries"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default RecentQueries;
