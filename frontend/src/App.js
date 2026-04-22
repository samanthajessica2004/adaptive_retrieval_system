import { useState, useEffect } from "react";
import axios from "axios";
import { Toaster, toast } from "sonner";
import Sidebar from "./components/Sidebar";
import ChatTab from "./components/ChatTab";
import CompareTab from "./components/CompareTab";
import DocumentMapTab from "./components/DocumentMapTab";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getOrCreateSessionId = () => {
  let id = localStorage.getItem("rag_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("rag_session_id", id);
  }
  return id;
};

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const [activeTab, setActiveTab] = useState("chat");
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
    loadSession(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents`);
      setDocuments(res.data || []);
    } catch (e) {
      console.error("Failed to load documents", e);
    }
  };

  const loadSession = async (sid) => {
    try {
      const res = await axios.get(`${API}/sessions/${sid}`);
      if (res.data?.messages?.length > 0) {
        const msgs = res.data.messages.map((m) => ({
          ...m,
          id: crypto.randomUUID(),
        }));
        setMessages(msgs);
      }
    } catch (e) {
      console.error("Failed to load session", e);
    }
  };

  const handleUpload = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API}/documents/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        `"${res.data.name}" uploaded — ${res.data.chunk_count} chunks created`
      );
      fetchDocuments();
    } catch (e) {
      toast.error(
        e.response?.data?.detail || "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await axios.delete(`${API}/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleSendMessage = async (query, mode) => {
    const userMsg = { id: crypto.randomUUID(), role: "user", content: query };
    const aiMsgId = crypto.randomUUID();

    // Add user message + empty streaming AI message immediately
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: aiMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        streamStatus: "retrieving",
        confidence: 0,
        sources: [],
        source_chunks: [],
        is_grounded: true,
        has_contradiction: false,
        crag_note: "",
        rewritten_query: null,
      },
    ]);
    setChatLoading(true);

    try {
      const response = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          session_id: sessionId,
          doc_ids: selectedDocIds,
          mode,
        }),
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errMsg = errData.detail || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, isStreaming: false, streamStatus: "done", content: `Error: ${data.error}` }
                    : m
                )
              );
              setChatLoading(false);
              return;
            }

            if (data.status === "retrieving") {
              setChatLoading(false);
              if (data.rewritten_query && data.rewritten_query !== query) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, rewritten_query: data.rewritten_query }
                      : m
                  )
                );
              }
            }

            if (data.status === "generating") {
              setChatLoading(false);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, streamStatus: "generating" } : m
                )
              );
            }

            if (data.token) {
              setChatLoading(false);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? {
                        ...m,
                        content: m.content + data.token,
                        streamStatus: "streaming",
                      }
                    : m
                )
              );
            }

            if (data.done) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? {
                        ...m,
                        isStreaming: false,
                        streamStatus: "done",
                        content: data.answer,
                        confidence: data.confidence,
                        has_contradiction: data.has_contradiction,
                        contradiction_description: data.contradiction_description,
                        sources: data.sources || [],
                        source_chunks: data.source_chunks || [],
                        is_grounded: data.is_grounded,
                        crag_note: data.crag_note || "",
                        rewritten_query:
                          data.rewritten_query !== query
                            ? data.rewritten_query
                            : null,
                      }
                    : m
                )
              );
            }
          } catch {
            // Skip parse errors
          }
        }
      }
    } catch (e) {
      toast.error(e.message || "Failed to get a response. Check Groq API key.");
      setMessages((prev) =>
        prev.filter((m) => m.id !== aiMsgId && m.id !== userMsg.id)
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleNewChat = () => {
    const newId = crypto.randomUUID();
    localStorage.setItem("rag_session_id", newId);
    setSessionId(newId);
    setMessages([]);
    toast.info("New conversation started");
  };

  const handleExportPDF = async () => {
    if (messages.length === 0) {
      toast.warning("No conversation to export yet.");
      return;
    }
    try {
      const res = await axios.post(
        `${API}/export/pdf`,
        { session_id: sessionId },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversation_${sessionId.slice(0, 8)}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("PDF exported successfully");
    } catch {
      toast.error("Export failed. Have at least one conversation first.");
    }
  };

  const toggleDocSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const TABS = [
    { key: "chat", label: "Chat" },
    { key: "compare", label: "Compare Docs" },
    { key: "map", label: "Document Map" },
  ];

  return (
    <div className="app-container" data-testid="app-container">
      <Toaster richColors position="top-right" />

      <Sidebar
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleDoc={toggleDocSelection}
        onDeleteDoc={handleDeleteDoc}
        onUpload={handleUpload}
        uploading={uploading}
        onRefreshDocs={fetchDocuments}
      />

      <main className="main-content">
        {/* Tab Bar */}
        <div className="tab-bar">
          <div className="tab-bar-inner">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                data-testid={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-btn ${activeTab === tab.key ? "tab-active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            data-testid="export-pdf-btn"
            onClick={handleExportPDF}
            className="export-btn"
            title="Export conversation to PDF"
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 16V4M12 16l-4-4M12 16l4-4M4 20h16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export PDF
          </button>
        </div>

        {/* Tab Content — always rendered, toggled via display */}
        <div className="tab-content">
          <div
            style={{
              display: activeTab === "chat" ? "flex" : "none",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <ChatTab
              messages={messages}
              onSend={handleSendMessage}
              isLoading={chatLoading}
              onNewChat={handleNewChat}
              documents={documents}
              selectedDocIds={selectedDocIds}
            />
          </div>
          <div
            style={{
              display: activeTab === "compare" ? "flex" : "none",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <CompareTab documents={documents} />
          </div>
          <div
            style={{
              display: activeTab === "map" ? "flex" : "none",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <DocumentMapTab documents={documents} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
