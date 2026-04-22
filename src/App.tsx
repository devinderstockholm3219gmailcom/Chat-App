import { useEffect, useState, useRef } from "react";
import "./App.css";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const socket = io(SERVER_URL);

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  message: string;
  username: string;
  timestamp: number; // unix ms
};

type SystemEvent = {
  kind: "system";
  id: string;
  text: string;
};

type MessageEvent = {
  kind: "message";
} & ChatMessage;

type TimelineEvent = SystemEvent | MessageEvent;

// ── Constants ──────────────────────────────────────────────────────────────

const EMOJIS = [
  "😀","😂","😍","😎","😭","😅","🤔","🙌","👍","❤️",
  "🔥","✨","🎉","💯","🤩","😊","🥺","😆","😜","🤗",
  "👏","🙏","💪","🚀","⚡","🌟","💬","😏","🥳","💀",
];

const AVATAR_COLORS = [
  "#2563eb","#16a34a","#dc2626","#7c3aed",
  "#db2777","#d97706","#0891b2","#ea580c",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

let _audioCtx: AudioContext | null = null;
function playBeep() {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.07, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.25);
    osc.start();
    osc.stop(_audioCtx.currentTime + 0.25);
  } catch {}
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      className="avatar"
      style={{
        background: getAvatarColor(name),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {name[0].toUpperCase()}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

function App() {
  const [connected, setConnected] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showEmoji, setShowEmoji] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loginInput, setLoginInput] = useState("");
  const [username, setUsername] = useState(
    localStorage.getItem("chat_username") ?? ""
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-scroll on new events
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  // Tab title unread counter
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Chat App` : "Chat App";
  }, [unread]);

  useEffect(() => {
    const reset = () => setUnread(0);
    window.addEventListener("focus", reset);
    return () => window.removeEventListener("focus", reset);
  }, []);

  // Socket event listeners
  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("history", (msgs: ChatMessage[]) => {
      setTimeline(msgs.map((m): MessageEvent => ({ kind: "message", ...m })));
    });

    socket.on("message", (msg: ChatMessage) => {
      setTimeline((prev: TimelineEvent[]) => [...prev, { kind: "message", ...msg }]);
      if (msg.username !== username && !document.hasFocus()) {
        setUnread((n: number) => n + 1);
        playBeep();
      }
    });

    socket.on("users", (list: string[]) => setUsers(list));

    socket.on("system", (text: string) => {
      setTimeline((prev: TimelineEvent[]) => [
        ...prev,
        { kind: "system", id: crypto.randomUUID(), text },
      ]);
    });

    socket.on("typing", (user: string) => {
      if (user === username) return;
      setTypingUsers((prev: Set<string>) => new Set(prev).add(user));
      const existing = typingTimers.current.get(user);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        setTypingUsers((prev: Set<string>) => {
          const next = new Set(prev);
          next.delete(user);
          return next;
        });
        typingTimers.current.delete(user);
      }, 2000);
      typingTimers.current.set(user, t);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("history");
      socket.off("message");
      socket.off("users");
      socket.off("system");
      socket.off("typing");
    };
  }, [username]);

  // Emit join whenever username is set (also handles reconnects)
  useEffect(() => {
    if (!username) return;
    const emitJoin = () => socket.emit("join", username);
    if (socket.connected) emitJoin();
    socket.on("connect", emitJoin);
    return () => { socket.off("connect", emitJoin); };
  }, [username]);

  // ── Handlers ──

  const handleLogin = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = loginInput.trim();
    if (!name) return;
    localStorage.setItem("chat_username", name);
    setUsername(name);
    setLoginInput("");
  };

  const handleLogout = () => {
    socket.emit("leave", username);
    localStorage.removeItem("chat_username");
    setUsername("");
    setTimeline([]);
    setUsers([]);
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    socket.emit("message", { message: text, username, timestamp: Date.now() });
    setInput("");
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleTyping = (value: string) => {
    setInput(value);
    socket.emit("typing", username);
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // ── Login screen ──

  if (!username) {
    return (
      <div className="chat-wrapper">
        <div className="login-card">
          <div className="login-logo">💬</div>
          <h2>Join the chat</h2>
          <p className="login-subtitle">Choose a username to start chatting</p>
          <form onSubmit={handleLogin} className="login-form">
            <input
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="Your username"
              autoFocus
              maxLength={24}
            />
            <button type="submit">Join →</button>
          </form>
        </div>
      </div>
    );
  }

  const typingList = [...typingUsers];

  // ── Chat screen ──

  return (
    <div className="chat-wrapper">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2>💬 Chat App</h2>
          <span className={`status-badge ${connected ? "online" : "offline"}`}>
            {connected ? "● Online" : "● Offline"}
          </span>
        </div>

        <div className="user-section">
          <Avatar name={username} size={38} />
          <div className="user-info">
            <span className="user-label">Signed in as</span>
            <strong className="user-name">{username}</strong>
          </div>
          <button onClick={handleLogout} className="logout-btn">Leave</button>
        </div>

        <div className="online-section">
          <h3>
            Online
            <span className="count-badge">{users.length}</span>
          </h3>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u} className="user-list-item">
                <Avatar name={u} size={26} />
                <span className="user-list-name">{u}</span>
                {u === username && <span className="you-tag">you</span>}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main chat */}
      <main className="chat-main">
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>
            ☰
          </button>
          <span className="mobile-title">💬 Chat App</span>
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>

        {/* Messages */}
        <div className="messages-container">
          {timeline.map((event) => {
            if (event.kind === "system") {
              return (
                <div key={event.id} className="system-message">
                  {event.text}
                </div>
              );
            }

            const isOwn = event.username === username;
            return (
              <div
                key={event.id}
                className={`message-row ${isOwn ? "own" : "other"}`}
              >
                {!isOwn && <Avatar name={event.username} size={30} />}
                <div className="bubble-body">
                  <div className="bubble-header">
                    <span className="bubble-username">{event.username}</span>
                    <span className="bubble-time">{formatTime(event.timestamp)}</span>
                  </div>
                  <p className="bubble-text">{event.message}</p>
                </div>
                {isOwn && <Avatar name={event.username} size={30} />}
              </div>
            );
          })}

          {typingList.length > 0 && (
            <div className="typing-indicator">
              <span>
                {typingList.join(", ")} {typingList.length === 1 ? "is" : "are"} typing
              </span>
              <span className="typing-dots">
                <span /><span /><span />
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Emoji picker */}
        {showEmoji && (
          <div className="emoji-picker">
            {EMOJIS.map((e) => (
              <button key={e} className="emoji-btn" onClick={() => insertEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="input-bar">
          <button
            className={`emoji-toggle ${showEmoji ? "active" : ""}`}
            onClick={() => setShowEmoji((v) => !v)}
            title="Emoji"
          >
            😊
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            maxLength={500}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
