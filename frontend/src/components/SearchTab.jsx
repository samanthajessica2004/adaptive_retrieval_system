import { useState } from "react";
import axios from "axios";
import { Search, Loader2, FileText } from "lucide-react";
import RecentQueries from "./RecentQueries";
import { useRecentQueries } from "../hooks/useRecentQueries";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HighlightedSnippet = ({ snippet }) => (
  <span>
    <span style={{ color: "#5B6384" }}>{snippet.before}</span>
    <mark
      style={{
        background: "linear-gradient(180deg, transparent 55%, rgba(250, 204, 21, 0.55) 55%)",
        color: "#0B1020",
        fontWeight: 600,
        padding: "0 1px",
      }}
    >
      {snippet.match}
    </mark>
    <span style={{ color: "#5B6384" }}>{snippet.after}</span>
  </span>
);

const SearchTab = ({ documents }) => {
  const [query, setQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const recent = useRecentQueries("rag_recent_search");

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (query.trim().length < 2 || isLoading) return;
    const q = query.trim();
    recent.push(q);
    setIsLoading(true);
    setError("");
    setResults(null);
    try {
      const res = await axios.post(`${API}/search`, {
        query: q,
        doc_ids: selectedDocs,
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDoc = (id) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="search-container" data-testid="search-tab">
      {/* Toolbar */}
      <div className="search-toolbar">
        <form
          onSubmit={handleSearch}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              maxWidth: 520,
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#8890B2",
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search keywords within your documents…"
              data-testid="search-query-input"
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                fontSize: 14,
                border: "1px solid rgba(79, 70, 229, 0.2)",
                borderRadius: 999,
                outline: "none",
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: "#0B1020",
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(10px)",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={query.trim().length < 2 || isLoading}
            data-testid="search-submit-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              background:
                query.trim().length < 2 || isLoading
                  ? "#C4C8DB"
                  : "linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)",
              border: "none",
              borderRadius: 999,
              cursor:
                query.trim().length < 2 || isLoading ? "not-allowed" : "pointer",
              transition: "transform 0.15s ease, box-shadow 0.2s ease",
              boxShadow:
                query.trim().length < 2 || isLoading
                  ? "none"
                  : "0 6px 18px rgba(79, 70, 229, 0.3)",
            }}
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}
            Search
          </button>
        </form>
      </div>

      {/* Recent queries */}
      {recent.items.length > 0 && (
        <div className="search-recent-wrap">
          <RecentQueries
            items={recent.items}
            onPick={(q) => setQuery(q)}
            onRemove={recent.remove}
            onClear={recent.clear}
            testIdPrefix="search-recent"
          />
        </div>
      )}

      {/* Doc filter chips */}
      {documents.length > 0 && (
        <div className="search-filter-row">
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#8890B2",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginRight: 8,
            }}
          >
            Filter:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {documents.map((d) => {
              const active = selectedDocs.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDoc(d.id)}
                  data-testid={`search-filter-${d.id}`}
                  style={{
                    padding: "4px 12px",
                    fontSize: 11.5,
                    fontWeight: 500,
                    borderRadius: 999,
                    border: `1px solid ${active ? "#4F46E5" : "rgba(79,70,229,0.15)"}`,
                    background: active ? "rgba(79, 70, 229, 0.12)" : "rgba(255,255,255,0.75)",
                    color: active ? "#4F46E5" : "#5B6384",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {d.name.length > 22 ? d.name.slice(0, 22) + "…" : d.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="search-results">
        {error && (
          <div className="search-error" data-testid="search-error">
            {error}
          </div>
        )}

        {!results && !isLoading && !error && (
          <div className="empty-state" data-testid="search-empty-state">
            <Search size={40} style={{ color: "#C4C8DB" }} />
            <div
              style={{
                fontWeight: 700,
                fontSize: 17,
                color: "#2D3250",
                fontFamily: "'Cabinet Grotesk', sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              Search within your documents
            </div>
            <p
              style={{
                maxWidth: 440,
                lineHeight: 1.7,
                fontSize: 13.5,
                color: "#5B6384",
              }}
            >
              Find exact keywords or phrases across everything you&rsquo;ve uploaded.
              Highlighted snippets show context around each match.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="empty-state" data-testid="search-loading">
            <Loader2 size={30} className="animate-spin" style={{ color: "#4F46E5" }} />
            <p style={{ fontSize: 14, color: "#5B6384" }}>Searching chunks…</p>
          </div>
        )}

        {results && !isLoading && (
          <>
            <div
              style={{
                fontSize: 12,
                color: "#5B6384",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              data-testid="search-summary"
            >
              <strong style={{ color: "#2D3250", fontWeight: 600 }}>
                {results.total_matches}
              </strong>
              match{results.total_matches === 1 ? "" : "es"} across{" "}
              <strong style={{ color: "#2D3250", fontWeight: 600 }}>
                {results.doc_count}
              </strong>
              document{results.doc_count === 1 ? "" : "s"} for &ldquo;
              <span style={{ color: "#4F46E5" }}>{results.query}</span>&rdquo;
            </div>

            {results.doc_count === 0 && (
              <div
                className="empty-state"
                style={{ padding: "32px 20px" }}
                data-testid="search-no-results"
              >
                <FileText size={36} style={{ color: "#C4C8DB" }} />
                <p style={{ fontSize: 13.5, color: "#5B6384" }}>
                  No matches found. Try a different keyword.
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {results.results.map((doc) => (
                <div
                  key={doc.doc_id}
                  className="search-doc-card"
                  data-testid={`search-doc-${doc.doc_id}`}
                >
                  <div className="search-doc-header">
                    <FileText size={13} style={{ color: "#4F46E5" }} />
                    <span className="search-doc-name">{doc.doc_name}</span>
                    <span className="search-match-pill">
                      {doc.match_count} match{doc.match_count === 1 ? "" : "es"}
                    </span>
                  </div>
                  <div className="search-hits">
                    {doc.hits.map((hit, hi) => (
                      <div key={hi} className="search-hit">
                        {hit.snippets.map((s, si) => (
                          <p key={si} className="search-snippet">
                            <HighlightedSnippet snippet={s} />
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SearchTab;
