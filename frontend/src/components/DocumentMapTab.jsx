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
  "#002FA7",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
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
        background: "#FFFFFF",
        border: "1px solid #E4E4E7",
        borderRadius: 4,
        padding: "10px 12px",
        maxWidth: 260,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#002FA7",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 4,
        }}
      >
        {data.doc_name}
      </div>
      <p style={{ fontSize: 11, color: "#52525B", lineHeight: 1.5, margin: 0 }}>
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
              fontSize: 14,
              fontWeight: 700,
              color: "#09090B",
              letterSpacing: "-0.01em",
            }}
          >
            Document Semantic Map
          </div>
          <div style={{ fontSize: 11, color: "#A1A1AA", marginTop: 1 }}>
            {points.length > 0
              ? `${points.length} chunks across ${docGroupEntries.length} document${
                  docGroupEntries.length !== 1 ? "s" : ""
                } · UMAP 2D projection`
              : "Upload 2+ documents to generate the map"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastFetch && (
            <span style={{ fontSize: 10, color: "#A1A1AA" }}>
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
              gap: 5,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: documents.length < 2 ? "#D4D4D8" : "#52525B",
              border: "1px solid #E4E4E7",
              borderRadius: 4,
              background: "#FFFFFF",
              cursor: documents.length < 2 ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
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
              style={{ color: "#002FA7" }}
            />
            <p style={{ color: "#71717A", fontSize: 13 }}>
              Computing UMAP projection of {documents.length} documents...
            </p>
            <p style={{ color: "#A1A1AA", fontSize: 11 }}>
              This may take a moment on first load.
            </p>
          </div>
        )}

        {!isLoading && points.length === 0 && (
          <div className="empty-state" data-testid="map-empty-state">
            <Map size={40} style={{ color: "#D4D4D8" }} />
            <div
              style={{ fontWeight: 600, fontSize: 15, color: "#52525B" }}
            >
              Document Semantic Map
            </div>
            <p
              style={{
                maxWidth: 380,
                lineHeight: 1.6,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {message ||
                "Upload at least 2 documents to visualize their semantic clusters in 2D space."}
            </p>
            <p style={{ fontSize: 11, color: "#A1A1AA" }}>
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
                stroke="#F4F4F5"
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
