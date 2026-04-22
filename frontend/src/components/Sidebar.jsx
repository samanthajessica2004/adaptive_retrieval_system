import { useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2, CheckSquare, Square } from "lucide-react";

const ACCEPTED_TYPES = ".pdf,.docx,.doc,.txt,.md,.csv,.html,.htm,.xml";

const Sidebar = ({
  documents,
  selectedDocIds,
  onToggleDoc,
  onDeleteDoc,
  onUpload,
  uploading,
}) => {
  const [isDragging, setIsDragging] = useState(false);
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

  const getFileIcon = (fileType) => {
    const colors = {
      pdf: "#EF4444",
      docx: "#2563EB",
      doc: "#2563EB",
      txt: "#71717A",
      md: "#10B981",
      csv: "#F59E0B",
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

      {/* Upload Zone */}
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
            <Upload
              size={22}
              style={{ color: "#002FA7", margin: "0 auto" }}
            />
            <p className="upload-zone-text">
              {isDragging ? "Drop file here" : "Upload Document"}
            </p>
            <p className="upload-zone-hint">PDF, DOCX, TXT, MD, CSV, HTML</p>
          </>
        )}
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
              fontSize: "12px",
            }}
          >
            <FileText
              size={28}
              style={{ color: "#D4D4D8", margin: "0 auto 8px" }}
            />
            <p>No documents yet.</p>
            <p style={{ marginTop: 4 }}>Upload one to get started.</p>
          </div>
        )}

        {documents.map((doc) => {
          const isSelected = selectedDocIds.includes(doc.id);
          return (
            <div
              key={doc.id}
              className={`doc-item ${isSelected ? "selected" : ""}`}
              data-testid={`doc-item-${doc.id}`}
            >
              <button
                onClick={() => onToggleDoc(doc.id)}
                style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
                title={isSelected ? "Deselect" : "Select for filtering"}
                data-testid={`doc-checkbox-${doc.id}`}
              >
                {isSelected ? (
                  <CheckSquare size={15} style={{ color: "#002FA7" }} />
                ) : (
                  <Square size={15} style={{ color: "#D4D4D8" }} />
                )}
              </button>

              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: getFileIcon(doc.file_type),
                  flexShrink: 0,
                }}
              />

              <div className="doc-item-info">
                <div className="doc-item-name" title={doc.name}>
                  {doc.name}
                </div>
                <div className="doc-item-meta">
                  {doc.chunk_count} chunks · {doc.file_type?.toUpperCase()}
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
            fontSize: "10px",
            color: "#A1A1AA",
            borderTop: "1px solid #E4E4E7",
            lineHeight: 1.5,
          }}
        >
          Check documents to filter chat queries. Uncheck all to search everything.
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
