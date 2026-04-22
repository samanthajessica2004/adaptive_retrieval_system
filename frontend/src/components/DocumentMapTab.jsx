import { useState, useEffect } from "react";
import axios from "axios";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { RefreshCw, Loader2, Map } from "lucide-react";

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
  "#84CC16",
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(16px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.9)",
        borderRadius: 12,
        padding: "11px 14px",
        maxWidth: 280,
        boxShadow: "0 12px 30px rgba(31, 38, 135, 0.15)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#4F46E5",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 5,
        }}
      >
        {data.doc_name}
      </div>
      <p style={{ fontSize: 11.5, color: "#2D3250", lineHeight: 1.55, margin: 0 }}>
        {data.text_preview}
      </p>
    </div>
  );
};

const DocumentMapTab = ({ documents }) => {
  const [points, setPoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(() => {
    if (documents.length >= 2) {
      fetchVisualization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length]);

  const fetchVisualization = async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const res = await axios.get(`${API}/visualize`);
      setPoints(res.data.points || []);
      setMessage(res.data.message || "");
      setLastFetch(new Date());
    } catch (e) {
      console.error("Failed to load visualization", e);
      setMessage("Failed to load visualization. Please try refreshing.");
    } finally {
      setIsLoading(false);
    }
  };

  // Group points by doc_id
  const docGroups = {};
  points.forEach((p) => {
    if (!docGroups[p.doc_id]) {
      docGroups[p.doc_id] = { name: p.doc_name, data: [] };
    }
    docGroups[p.doc_id].data.push({
      x: p.x,
      y: p.y,
      doc_name: p.doc_name,
      text_preview: p.text_preview,
    });
  });

  const docGroupEntries = Object.entries(docGroups);

  return (
    <div className="map-container" data-testid="document-map-tab">
      {/* Toolbar */}
      <div className="map-toolbar">
        <div>
          <div
            style={{
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              color: "#0B1020",
              letterSpacing: "-0.02em",
            }}
          >
            Document Semantic Map
          </div>
          <div style={{ fontSize: 11, color: "#8890B2", marginTop: 2, letterSpacing: "0.02em" }}>
            {points.length > 0
              ? `${points.length} chunks across ${docGroupEntries.length} document${
                  docGroupEntries.length !== 1 ? "s" : ""
                } · UMAP 2D projection`
              : "Upload 2+ documents to generate the map"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastFetch && (
            <span style={{ fontSize: 10, color: "#8890B2" }}>
              Last updated: {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchVisualization}
            disabled={isLoading || documents.length < 2}
            data-testid="refresh-map-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: documents.length < 2 ? "#C4C8DB" : "#4F46E5",
              border: "1px solid rgba(79, 70, 229, 0.2)",
              borderRadius: 999,
              background: "rgba(255,255,255,0.7)",
              cursor: documents.length < 2 ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              backdropFilter: "blur(10px)",
            }}
          >
            {isLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="map-chart-area">
        {isLoading && (
          <div className="empty-state" data-testid="map-loading">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "#4F46E5" }}
            />
            <p style={{ color: "#5B6384", fontSize: 13 }}>
              Computing UMAP projection of {documents.length} documents...
            </p>
            <p style={{ color: "#8890B2", fontSize: 11 }}>
              This may take a moment on first load.
            </p>
          </div>
        )}

        {!isLoading && points.length === 0 && (
          <div className="empty-state" data-testid="map-empty-state">
            <Map size={44} style={{ color: "#C4C8DB" }} />
            <div
              style={{ fontWeight: 700, fontSize: 17, color: "#2D3250", fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.02em" }}
            >
              Document Semantic Map
            </div>
            <p
              style={{
                maxWidth: 420,
                lineHeight: 1.7,
                fontSize: 13.5,
                textAlign: "center",
                color: "#5B6384",
              }}
            >
              {message ||
                "Upload at least 2 documents to visualize their semantic clusters in 2D space."}
            </p>
            <p style={{ fontSize: 11, color: "#8890B2", maxWidth: 380, lineHeight: 1.5 }}>
              Each dot represents a text chunk. Nearby dots share similar
              meaning. Clusters reveal topical structure.
            </p>
          </div>
        )}

        {!isLoading && points.length > 0 && (
          <div style={{ width: "100%", height: "100%" }} data-testid="umap-scatter-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="rgba(79, 70, 229, 0.08)"
                strokeWidth={1}
              />
              <XAxis
                type="number"
                dataKey="x"
                name="x"
                hide
                domain={["auto", "auto"]}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="y"
                hide
                domain={["auto", "auto"]}
              />
              <ZAxis range={[50, 50]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              {docGroupEntries.map(([docId, group], i) => (
                <Scatter
                  key={docId}
                  name={
                    group.name.length > 25
                      ? group.name.slice(0, 25) + "…"
                      : group.name
                  }
                  data={group.data}
                  fill={DOC_COLORS[i % DOC_COLORS.length]}
                  opacity={0.75}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentMapTab;
