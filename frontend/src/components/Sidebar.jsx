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
      pdf: "#EF4444",
      docx: "#2563EB",
      doc: "#2563EB",
      txt: "#71717A",
      md: "#10B981",
      csv: "#F59E0B",
      url: "#8B5CF6",
    };
    return colors[fileType?.toLowerCase()] || "#71717A";
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
              style={{ color: "#002FA7", margin: "0 auto" }}
            />
            <p className="upload-zone-text">Processing document...</p>
          </>
        ) : (
          <>
            <Upload size={22} style={{ color: "#002FA7", margin: "0 auto" }} />
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
          margin: "0 12px 8px",
          padding: "10px",
          background: "#FAFAFA",
          border: "1px solid #E4E4E7",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#A1A1AA",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 6,
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
              padding: "5px 8px",
              fontSize: 11,
              border: "1px solid #D4D4D8",
              borderRadius: 4,
              outline: "none",
              fontFamily: "'IBM Plex Sans', sans-serif",
              color: "#09090B",
              backgroundColor: ingestingUrl ? "#F4F4F5" : "#FFFFFF",
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
              width: 30,
              height: 30,
              borderRadius: 4,
              border: "none",
              backgroundColor:
                !urlInput.trim() || ingestingUrl ? "#D4D4D8" : "#002FA7",
              color: "#FFFFFF",
              cursor:
                !urlInput.trim() || ingestingUrl ? "not-allowed" : "pointer",
              transition: "background-color 0.15s ease",
              flexShrink: 0,
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
            fontSize: 9,
            color: "#A1A1AA",
            marginTop: 4,
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
              padding: "20px 16px",
              textAlign: "center",
              color: "#A1A1AA",
              fontSize: 12,
            }}
          >
            <FileText
              size={28}
              style={{ color: "#D4D4D8", margin: "0 auto 8px" }}
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
                  <CheckSquare size={15} style={{ color: "#002FA7" }} />
                ) : (
                  <Square size={15} style={{ color: "#D4D4D8" }} />
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
                        color: "#8B5CF6",
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
            padding: "8px 12px",
            fontSize: 10,
            color: "#A1A1AA",
            borderTop: "1px solid #E4E4E7",
            lineHeight: 1.5,
          }}
        >
          Check documents to filter queries. Uncheck all to search everything.
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
