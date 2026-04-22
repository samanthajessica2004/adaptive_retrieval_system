import { useState } from "react";
import axios from "axios";
import { Loader2, GitCompare, FileText } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DOC_COLORS = [
  "#002FA7",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
];

const CompareTab = ({ documents }) => {
  const [query, setQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleDoc = (docId) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!query.trim() || selectedDocs.length < 1) return;
    setIsLoading(true);
    setResults(null);
    try {
      const res = await axios.post(`${API}/compare`, {
        query: query.trim(),
        doc_ids: selectedDocs,
      });
      setResults(res.data.results);
    } catch (e) {
      console.error("Compare failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocColor = (docId) => {
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
              color: "#A1A1AA",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: 6,
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
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: 4,
                      border: `1.5px solid ${isSelected ? getDocColor(doc.id) : "#E4E4E7"}`,
                      background: isSelected ? `${getDocColor(doc.id)}12` : "#FFFFFF",
                      color: isSelected ? getDocColor(doc.id) : "#52525B",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <FileText size={12} />
                    {doc.name.length > 20 ? doc.name.slice(0, 20) + "…" : doc.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#A1A1AA",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: 6,
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
                padding: "8px 12px",
                fontSize: 13,
                border: "1px solid #D4D4D8",
                borderRadius: 4,
                outline: "none",
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: "#09090B",
              }}
            />
          </div>
          <button
            onClick={handleCompare}
            disabled={!query.trim() || selectedDocs.length < 1 || isLoading}
            data-testid="compare-submit-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor:
                !query.trim() || selectedDocs.length < 1
                  ? "#D4D4D8"
                  : "#002FA7",
              border: "none",
              borderRadius: 4,
              cursor:
                !query.trim() || selectedDocs.length < 1 ? "not-allowed" : "pointer",
              transition: "background-color 0.15s ease",
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
        {!results && !isLoading && (
          <div className="empty-state" data-testid="compare-empty-state">
            <GitCompare size={36} style={{ color: "#D4D4D8" }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: "#52525B" }}>
              Side-by-Side Document Comparison
            </div>
            <p style={{ maxWidth: 400, lineHeight: 1.6, fontSize: 13 }}>
              Select two or more documents above and enter a question to see
              how each document answers it. Great for comparing perspectives,
              dates, or facts across sources.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="empty-state" data-testid="compare-loading">
            <Loader2
              size={30}
              className="animate-spin"
              style={{ color: "#002FA7" }}
            />
            <p style={{ fontSize: 14, color: "#71717A" }}>
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
                    <span style={{ fontSize: 13 }}>
                      {result.doc_name.length > 30
                        ? result.doc_name.slice(0, 30) + "…"
                        : result.doc_name}
                    </span>
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
