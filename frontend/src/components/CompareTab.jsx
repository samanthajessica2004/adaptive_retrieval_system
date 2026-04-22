import { useState } from "react";
import axios from "axios";
import { Loader2, GitCompare, FileText, Globe, X } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DOC_COLORS = [
  "#4F46E5",
  "#06B6D4",
  "#A855F7",
  "#F59E0B",
  "#10B981",
  "#F43F5E",
  "#EC4899",
];

const CompareTab = ({ documents }) => {
  const [query, setQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [compareUrl, setCompareUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleDoc = (docId) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const hasUrl = showUrlInput && compareUrl.trim().length > 0;
  const canSubmit =
    query.trim().length > 0 &&
    !isLoading &&
    (selectedDocs.length > 0 || hasUrl);

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setResults(null);
    setError("");
    try {
      const payload = {
        query: query.trim(),
        doc_ids: selectedDocs,
      };
      if (hasUrl) payload.url = compareUrl.trim();
      const res = await axios.post(`${API}/compare`, payload);
      setResults(res.data.results);
    } catch (e) {
      const msg =
        e.response?.data?.detail ||
        e.message ||
        "Comparison failed. Please try again.";
      setError(msg);
      console.error("Compare failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocColor = (docId) => {
    if (docId.startsWith("__url__")) return "#A855F7";
    const idx = documents.findIndex((d) => d.id === docId);
    return DOC_COLORS[idx % DOC_COLORS.length];
  };

  return (
    <div className="compare-container" data-testid="compare-tab">
      {/* Toolbar */}
      <div className="compare-toolbar">
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#8890B2",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginBottom: 8,
            }}
          >
            Select documents to compare
          </div>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
            data-testid="compare-doc-selector"
          >
            {documents.length === 0 ? (
              <span style={{ fontSize: 12, color: "#A1A1AA" }}>
                No documents uploaded yet.
              </span>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocs.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    data-testid={`compare-select-${doc.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: 999,
                      border: `1.5px solid ${isSelected ? getDocColor(doc.id) : "rgba(79, 70, 229, 0.15)"}`,
                      background: isSelected ? `${getDocColor(doc.id)}18` : "rgba(255,255,255,0.75)",
                      color: isSelected ? getDocColor(doc.id) : "#5B6384",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <FileText size={12} />
                    {doc.name.length > 20 ? doc.name.slice(0, 20) + "…" : doc.name}
                  </button>
                );
              })
            )}

            {/* Compare vs URL chip / input */}
            {!showUrlInput ? (
              <button
                type="button"
                onClick={() => setShowUrlInput(true)}
                data-testid="compare-add-url-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 999,
                  border: "1.5px dashed rgba(168, 85, 247, 0.4)",
                  background: "rgba(168, 85, 247, 0.08)",
                  color: "#A855F7",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title="Compare against a live URL (not persisted)"
              >
                <Globe size={12} />
                + Compare vs URL
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 4px 3px 10px",
                  borderRadius: 999,
                  border: "1.5px solid rgba(168, 85, 247, 0.5)",
                  background: "rgba(168, 85, 247, 0.08)",
                  backdropFilter: "blur(10px)",
                }}
                data-testid="compare-url-pill"
              >
                <Globe size={12} style={{ color: "#A855F7", flexShrink: 0 }} />
                <input
                  type="url"
                  value={compareUrl}
                  onChange={(e) => setCompareUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCompare(e)}
                  placeholder="https://example.com/article"
                  data-testid="compare-url-input"
                  autoFocus
                  style={{
                    width: 260,
                    padding: "4px 2px",
                    fontSize: 12,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    color: "#2D3250",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowUrlInput(false);
                    setCompareUrl("");
                  }}
                  data-testid="compare-url-remove"
                  title="Remove URL"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(168, 85, 247, 0.15)",
                    color: "#A855F7",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#8890B2",
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                marginBottom: 8,
              }}
            >
              Query
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompare(e)}
              placeholder="What aspect do you want to compare?"
              data-testid="compare-query-input"
              style={{
                width: 340,
                padding: "9px 14px",
                fontSize: 13,
                border: "1px solid rgba(79, 70, 229, 0.2)",
                borderRadius: 10,
                outline: "none",
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: "#0B1020",
                background: "rgba(255,255,255,0.8)",
                backdropFilter: "blur(10px)",
              }}
            />
          </div>
          <button
            onClick={handleCompare}
            disabled={!canSubmit}
            data-testid="compare-submit-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              background: !canSubmit
                ? "#C4C8DB"
                : "linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)",
              border: "none",
              borderRadius: 10,
              cursor: !canSubmit ? "not-allowed" : "pointer",
              transition: "transform 0.15s ease, box-shadow 0.2s ease",
              boxShadow: !canSubmit
                ? "none"
                : "0 6px 18px rgba(79, 70, 229, 0.3)",
            }}
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <GitCompare size={15} />
            )}
            Compare
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="compare-results">
        {error && (
          <div
            data-testid="compare-error"
            style={{
              padding: "12px 16px",
              marginBottom: 16,
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              borderLeft: "3px solid #F43F5E",
              borderRadius: 10,
              color: "#881337",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {!results && !isLoading && !error && (
          <div className="empty-state" data-testid="compare-empty-state">
            <GitCompare size={40} style={{ color: "#C4C8DB" }} />
            <div style={{ fontWeight: 700, fontSize: 17, color: "#2D3250", fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.02em" }}>
              Side-by-Side Document Comparison
            </div>
            <p style={{ maxWidth: 440, lineHeight: 1.7, fontSize: 13.5, color: "#5B6384" }}>
              Select two or more documents above and enter a question to see
              how each document answers it. Great for comparing perspectives,
              dates, or facts across sources.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="empty-state" data-testid="compare-loading">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "#4F46E5" }}
            />
            <p style={{ fontSize: 14, color: "#5B6384" }}>
              Retrieving and generating answers per document...
            </p>
          </div>
        )}

        {results && !isLoading && (
          <>
            <div
              style={{
                fontSize: 12,
                color: "#71717A",
                marginBottom: 12,
                fontStyle: "italic",
              }}
            >
              Comparing {Object.keys(results).length} document
              {Object.keys(results).length !== 1 ? "s" : ""} on: &ldquo;
              {query}&rdquo;
            </div>
            <div
              className="compare-grid"
              data-testid="compare-results-grid"
              style={{
                gridTemplateColumns: `repeat(${Math.min(Object.keys(results).length, 3)}, 1fr)`,
              }}
            >
              {Object.entries(results).map(([docId, result], idx) => (
                <div key={docId} className="compare-pane">
                  <div className="compare-pane-header">
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: getDocColor(docId),
                        flexShrink: 0,
                      }}
                    />
                    {result.is_external && (
                      <Globe size={12} style={{ color: "#A855F7" }} />
                    )}
                    <span style={{ fontSize: 13 }}>
                      {result.doc_name.length > 30
                        ? result.doc_name.slice(0, 30) + "…"
                        : result.doc_name}
                    </span>
                    {result.is_external && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: "0.1em",
                          color: "#A855F7",
                          background: "rgba(168, 85, 247, 0.12)",
                          padding: "2px 7px",
                          borderRadius: 999,
                          marginLeft: "auto",
                        }}
                      >
                        EXTERNAL
                      </span>
                    )}
                  </div>
                  <p
                    className="compare-answer"
                    data-testid={`compare-answer-${idx}`}
                  >
                    {result.answer}
                  </p>
                  {result.source_chunks?.map((chunk, i) => (
                    <div key={i} className="compare-source-chunk">
                      {chunk.slice(0, 200)}
                      {chunk.length > 200 ? "..." : ""}
                    </div>
                  ))}
                  {result.is_external && result.source_url && (
                    <a
                      href={result.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 10,
                        fontSize: 11,
                        color: "#A855F7",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      <Globe size={10} />
                      {result.source_url.length > 50
                        ? result.source_url.slice(0, 50) + "…"
                        : result.source_url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CompareTab;
