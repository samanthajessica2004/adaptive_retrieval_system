import { useState, useRef } from "react";
import axios from "axios";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckSquare,
  Square,
  Globe,
  Link,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ACCEPTED_TYPES = ".pdf,.docx,.doc,.txt,.md,.csv,.html,.htm,.xml";

const Sidebar = ({
  documents,
  selectedDocIds,
  onToggleDoc,
  onDeleteDoc,
  onUpload,
  uploading,
  onRefreshDocs,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [ingestingUrl, setIngestingUrl] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onUpload(files[0]);
  };
  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) onUpload(files[0]);
    e.target.value = "";
  };

  const handleIngestUrl = async () => {
    const url = urlInput.trim();
    if (!url || ingestingUrl) return;

    setIngestingUrl(true);
    try {
      const res = await axios.post(`${API}/documents/ingest-url`, { url });
      const { toast } = await import("sonner");
      toast.success(`"${res.data.name}" ingested — ${res.data.chunk_count} chunks`);
      setUrlInput("");
      onRefreshDocs();
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error(e.response?.data?.detail || "Failed to ingest URL");
    } finally {
      setIngestingUrl(false);
    }
  };

  const handleUrlKeyDown = (e) => {
    if (e.key === "Enter") handleIngestUrl();
  };

  const getDocColor = (fileType) => {
    const colors = {
      pdf: "#F43F5E",
      docx: "#4F46E5",
      doc: "#4F46E5",
      txt: "#5B6384",
      md: "#10B981",
      csv: "#F59E0B",
      url: "#A855F7",
    };
    return colors[fileType?.toLowerCase()] || "#5B6384";
  };

  return (
    <aside className="sidebar" data-testid="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">RAG System</div>
        <div className="sidebar-subtitle">Adaptive Retrieval</div>
      </div>

      {/* File Upload Zone */}
      <div
        className={`upload-zone ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        data-testid="upload-zone"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileInput}
          style={{ display: "none" }}
          data-testid="file-input"
        />
        {uploading ? (
          <>
            <Loader2
              size={22}
              className="animate-spin"
              style={{ color: "#4F46E5", margin: "0 auto" }}
            />
            <p className="upload-zone-text">Processing document...</p>
          </>
        ) : (
          <>
            <Upload size={22} style={{ color: "#4F46E5", margin: "0 auto" }} />
            <p className="upload-zone-text">
              {isDragging ? "Drop file here" : "Upload Document"}
            </p>
            <p className="upload-zone-hint">PDF, DOCX, TXT, MD, CSV, HTML</p>
          </>
        )}
      </div>

      {/* URL Ingestion */}
      <div
        style={{
          margin: "0 14px 10px",
          padding: "12px",
          background: "rgba(255, 255, 255, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(10px)",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#8890B2",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 8,
          }}
        >
          Ingest URL
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder="https://example.com/article"
            data-testid="url-ingest-input"
            disabled={ingestingUrl}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 11.5,
              border: "1px solid rgba(79, 70, 229, 0.18)",
              borderRadius: 8,
              outline: "none",
              fontFamily: "'IBM Plex Sans', sans-serif",
              color: "#0B1020",
              backgroundColor: ingestingUrl ? "#EEF0FB" : "#FFFFFF",
            }}
          />
          <button
            onClick={handleIngestUrl}
            disabled={!urlInput.trim() || ingestingUrl}
            data-testid="url-ingest-btn"
            title="Ingest this URL"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background:
                !urlInput.trim() || ingestingUrl
                  ? "#C4C8DB"
                  : "linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)",
              color: "#FFFFFF",
              cursor:
                !urlInput.trim() || ingestingUrl ? "not-allowed" : "pointer",
              transition: "transform 0.15s ease, box-shadow 0.2s ease",
              flexShrink: 0,
              boxShadow:
                !urlInput.trim() || ingestingUrl
                  ? "none"
                  : "0 4px 12px rgba(79, 70, 229, 0.3)",
            }}
          >
            {ingestingUrl ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Globe size={13} />
            )}
          </button>
        </div>
        <p
          style={{
            fontSize: 9.5,
            color: "#8890B2",
            marginTop: 6,
            lineHeight: 1.4,
          }}
        >
          Paste any public URL to extract and index its content
        </p>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="doc-list-header">
          {selectedDocIds.length > 0
            ? `${selectedDocIds.length} of ${documents.length} selected`
            : `${documents.length} document${documents.length > 1 ? "s" : ""} — all active`}
        </div>
      )}

      <div className="doc-list" data-testid="document-list">
        {documents.length === 0 && (
          <div
            style={{
              padding: "22px 16px",
              textAlign: "center",
              color: "#8890B2",
              fontSize: 12,
            }}
          >
            <FileText
              size={28}
              style={{ color: "#C4C8DB", margin: "0 auto 8px" }}
            />
            <p>No documents yet.</p>
            <p style={{ marginTop: 4 }}>Upload a file or paste a URL.</p>
          </div>
        )}

        {documents.map((doc) => {
          const isSelected = selectedDocIds.includes(doc.id);
          const isUrl = doc.file_type === "url";
          return (
            <div
              key={doc.id}
              className={`doc-item ${isSelected ? "selected" : ""}`}
              data-testid={`doc-item-${doc.id}`}
            >
              <button
                onClick={() => onToggleDoc(doc.id)}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                title={isSelected ? "Deselect" : "Select for filtering"}
                data-testid={`doc-checkbox-${doc.id}`}
              >
                {isSelected ? (
                  <CheckSquare size={15} style={{ color: "#4F46E5" }} />
                ) : (
                  <Square size={15} style={{ color: "#B4BAD4" }} />
                )}
              </button>

              {/* Type dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: getDocColor(doc.file_type),
                  flexShrink: 0,
                }}
              />

              <div className="doc-item-info">
                <div
                  className="doc-item-name"
                  title={doc.source_url || doc.name}
                >
                  {isUrl && (
                    <Link
                      size={10}
                      style={{
                        display: "inline",
                        marginRight: 4,
                        color: "#A855F7",
                      }}
                    />
                  )}
                  {doc.name}
                </div>
                <div className="doc-item-meta">
                  {doc.chunk_count} chunks ·{" "}
                  {isUrl ? "URL" : doc.file_type?.toUpperCase()}
                </div>
              </div>

              <button
                className="doc-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDoc(doc.id);
                }}
                title="Delete document"
                data-testid={`doc-delete-${doc.id}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Filter hint */}
      {documents.length > 0 && (
        <div
          style={{
            padding: "10px 14px",
            fontSize: 10,
            color: "#8890B2",
            borderTop: "1px solid rgba(255,255,255,0.5)",
            lineHeight: 1.5,
            background: "rgba(255,255,255,0.35)",
          }}
        >
          Check documents to filter queries. Uncheck all to search everything.
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
