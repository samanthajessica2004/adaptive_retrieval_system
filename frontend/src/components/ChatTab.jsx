import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Zap,
  Sparkles,
} from "lucide-react";
import RecentQueries from "./RecentQueries";
import { useRecentQueries } from "../hooks/useRecentQueries";

const MODES = [
  {
    key: "hybrid",
    label: "Hybrid",
    desc: "BM25 + Vector — recommended",
  },
  { key: "vector", label: "Vector", desc: "Semantic similarity search" },
  { key: "bm25", label: "Keyword", desc: "BM25 keyword matching" },
];

const getConfidenceColor = (score) => {
  if (score >= 0.7) return "#10B981";
  if (score >= 0.4) return "#F59E0B";
  return "#EF4444";
};

const getConfidenceLabel = (score) => {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
};

const StreamingStatus = ({ status }) => {
  const labels = {
    retrieving: "Retrieving relevant chunks...",
    generating: "Generating answer...",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Loader2 size={14} className="animate-spin" style={{ color: "#4F46E5" }} />
      <span style={{ fontSize: 13, color: "#8890B2" }}>
        {labels[status] || "Processing..."}
      </span>
    </div>
  );
};

const AssistantMessage = ({ msg }) => {
  const confidence = msg.confidence || 0;
  const color = getConfidenceColor(confidence);
  const isStreaming = msg.isStreaming;
  const showingContent = msg.content && msg.content.length > 0;

  return (
    <div className="ai-message-card" data-testid="ai-message">
      {/* Confidence bar — only when done */}
      {!isStreaming && (
        <div
          className="confidence-bar"
          data-testid="confidence-bar"
          style={{
            width: `${Math.round(confidence * 100)}%`,
            backgroundColor: color,
          }}
        />
      )}

      <div className="ai-message-body">
        {/* Rewritten query badge */}
        {msg.rewritten_query && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 10,
              fontSize: 11,
              color: "#8890B2",
            }}
            data-testid="rewritten-query-badge"
          >
            <Zap size={11} style={{ color: "#4F46E5" }} />
            <span style={{ fontStyle: "italic" }}>
              Search: &ldquo;{msg.rewritten_query}&rdquo;
            </span>
          </div>
        )}

        {/* Streaming status — show when streaming but no content yet */}
        {isStreaming && !showingContent && (
          <StreamingStatus status={msg.streamStatus} />
        )}

        {/* Answer text */}
        {showingContent && (
          <p
            style={{
              fontSize: 14.5,
              color: "#2D3250",
              lineHeight: 1.75,
              margin: 0,
              whiteSpace: "pre-wrap",
              letterSpacing: "0.005em",
            }}
          >
            {msg.content}
            {isStreaming && <span className="streaming-cursor">|</span>}
          </p>
        )}

        {/* Sources, contradiction, CRAG, confidence — only when streaming done */}
        {!isStreaming && showingContent && (
          <>
            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}
              >
                {msg.sources.map((src, i) => (
                  <span key={i} className="source-badge" data-testid="source-badge">
                    {src}
                  </span>
                ))}
              </div>
            )}

            {/* Contradiction alert */}
            {msg.has_contradiction && (
              <div className="contradiction-alert" data-testid="contradiction-alert">
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginBottom: 2,
                    }}
                  >
                    Conflicting Information Detected
                  </div>
                  <div>{msg.contradiction_description}</div>
                </div>
              </div>
            )}

            {/* CRAG warning */}
            {!msg.is_grounded && msg.crag_note && (
              <div className="crag-warning" data-testid="crag-warning">
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginBottom: 2,
                    }}
                  >
                    May Contain Unsupported Claims
                  </div>
                  <div>{msg.crag_note}</div>
                </div>
              </div>
            )}

            {/* Footer: confidence + grounded */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}80`,
                  }}
                />
                <span style={{ fontSize: 11, color: "#8890B2", fontWeight: 500 }}>
                  {getConfidenceLabel(confidence)} confidence (
                  {Math.round(confidence * 100)}%)
                </span>
              </div>
              {msg.is_grounded && (
                <span
                  className="grounded-badge"
                  data-testid="grounded-badge"
                >
                  <CheckCircle2 size={11} />
                  Grounded
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ChatTab = ({
  messages,
  onSend,
  isLoading,
  onNewChat,
  documents,
  selectedDocIds,
}) => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const recent = useRecentQueries("rag_recent_chat");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    const q = query.trim();
    recent.push(q);
    onSend(q, mode);
    setQuery("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handlePickRecent = (q) => {
    setQuery(q);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e) => {
    setQuery(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="chat-container" data-testid="chat-tab">
      {/* Mode Switcher Bar */}
      <div className="mode-switcher-bar">
        <div className="mode-switcher" data-testid="mode-switcher">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              data-testid={`mode-${m.key}`}
              className={`mode-btn ${mode === m.key ? "mode-active" : ""}`}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#8890B2", fontWeight: 500 }}>
          {selectedDocIds.length > 0
            ? `${selectedDocIds.length} doc${
                selectedDocIds.length > 1 ? "s" : ""
              } selected`
            : `All ${documents.length} doc${documents.length !== 1 ? "s" : ""}`}
        </span>
        <button
          onClick={onNewChat}
          data-testid="new-chat-btn"
          className="new-chat-btn"
        >
          <Plus size={13} />
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="messages-area" data-testid="messages-area">
        {messages.length === 0 && (
          <div className="empty-chat" data-testid="empty-chat-state">
            <div className="empty-chat-icon">
              <Sparkles size={34} strokeWidth={1.5} style={{ color: "#4F46E5" }} />
            </div>
            <h3 className="empty-chat-title">Adaptive Retrieval System</h3>
            <p className="empty-chat-desc">
              Upload documents in the sidebar, then ask questions. The system
              uses hybrid search, CrossEncoder reranking, query rewriting, and
              conversation memory.
            </p>
            <div className="feature-pills">
              {[
                "Hybrid Search",
                "Reranking",
                "Query Rewriting",
                "Contradiction Detection",
                "CRAG",
                "Semantic Chunking",
              ].map((f) => (
                <span key={f} className="feature-pill">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-row ${
              msg.role === "user" ? "user-row" : "ai-row"
            }`}
          >
            {msg.role === "user" ? (
              <div className="user-message" data-testid="user-message">
                {msg.content}
              </div>
            ) : (
              <AssistantMessage msg={msg} />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="ai-row" data-testid="loading-indicator">
            <div className="loading-bubble">
              <Loader2
                size={15}
                className="animate-spin"
                style={{ color: "#4F46E5" }}
              />
              <span style={{ fontSize: 13, color: "#5B6384" }}>
                Initializing retrieval...
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        <RecentQueries
          items={recent.items}
          onPick={handlePickRecent}
          onRemove={recent.remove}
          onClear={recent.clear}
          testIdPrefix="chat-recent"
        />
        <form
          onSubmit={handleSubmit}
          className="input-form"
          data-testid="chat-form"
        >
          <textarea
            ref={textareaRef}
            value={query}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            className="chat-textarea"
            data-testid="chat-input"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="send-btn"
            data-testid="send-btn"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
        <p className="input-hint">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
};

export default ChatTab;
