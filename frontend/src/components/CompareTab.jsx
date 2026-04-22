import { useState } from "react";
import axios from "axios";
import { Loader2, GitCompare, FileText } from "lucide-react";

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
            disabled={!query.trim() || selectedDocs.length < 1 || isLoading}
            data-testid="compare-submit-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              background:
                !query.trim() || selectedDocs.length < 1
                  ? "#C4C8DB"
                  : "linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)",
              border: "none",
              borderRadius: 10,
              cursor:
                !query.trim() || selectedDocs.length < 1 ? "not-allowed" : "pointer",
              transition: "transform 0.15s ease, box-shadow 0.2s ease",
              boxShadow:
                !query.trim() || selectedDocs.length < 1
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
        {!results && !isLoading && (
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
