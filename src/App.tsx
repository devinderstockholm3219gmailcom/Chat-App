import { useEffect, useState, useRef } from "react";
import "./App.css";
import { io } from "socket.io-client";

const socket = io("ws://10.100.2.139:3001");

type ChatMessage = {
  message: string;
  username: string;
  timestamp: {
    hours: number;
    minutes: number;
    seconds: number;
  };
};

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [systemMessages, setSystemMessages] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const [loginInput, setLoginInput] = useState("");
  const [username, setUsername] = useState(
    localStorage.getItem("chat_username") || ""
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // Socket listeners
  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("project1", (data: string) => {
      const receivedMessage: ChatMessage = JSON.parse(data);
      setMessages((prev) => [...prev, receivedMessage]);
    });

    // Typing indicator
    socket.on("typing", (user: string) => {
      if (user !== username) {
        setTypingUser(user);
        setTimeout(() => setTypingUser(null), 1500);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("project1");
      socket.off("typing");
    };
  }, [username]);

  // Fake online users (frontend-only)
  useEffect(() => {
    const uniqueUsers = [...new Set(messages.map((m) => m.username))];
    if (username) uniqueUsers.push(username);
    setUsers(uniqueUsers);
  }, [messages, username]);

  // Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = loginInput.trim();
    if (!name) return;
    localStorage.setItem("chat_username", name);
    setUsername(name);
    setLoginInput("");
    setSystemMessages((prev) => [...prev, `${name} joined the chat`]);
  };

  const handleLogout = () => {
    setSystemMessages((prev) => [...prev, `${username} left the chat`]);
    localStorage.removeItem("chat_username");
    setUsername("");
  };

  // Send message
  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const now = new Date();
    const message: ChatMessage = {
      message: text,
      username,
      timestamp: {
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
      },
    };

    socket.emit("project1", JSON.stringify(message));
    setInput("");
    setMessages((prev) => [...prev, message]);
  };

  // Typing event
  const handleTyping = (value: string) => {
    setInput(value);
    socket.emit("typing", username);
  };

  // Login screen
  if (!username) {
    return (
      <div className="chat-wrapper">
        <div className="login-card">
          <h2>Join the chat</h2>
          <p className="login-subtitle">Choose a username to start chatting</p>
          <form onSubmit={handleLogin} className="login-form">
            <input
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="Username"
            />
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-wrapper">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>Chat App</h2>
        <p className={`status-badge ${connected ? "online" : "offline"}`}>
          {connected ? "🟢 Online" : "🔴 Offline"}
        </p>

        <div className="user-section">
          <span className="user-label">Signed in as</span>
          <strong className="user-name">{username}</strong>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>

        <h3>Online Users</h3>
        <ul className="user-list">
          {users.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </aside>

      {/* Main chat */}
      <main className="chat-main">
        <div className="messages-container">
          {systemMessages.map((msg, i) => (
            <div key={i} className="system-message">
              {msg}
            </div>
          ))}

          {messages.map((msg, index) => {
            const isOwn = msg.username === username;
            const time = `${msg.timestamp.hours
              .toString()
              .padStart(2, "0")}:${msg.timestamp.minutes
              .toString()
              .padStart(2, "0")}`;

            return (
              <div
                key={index}
                className={`message-bubble ${isOwn ? "own" : "other"}`}
              >
                <div className="bubble-header">
                  <span className="bubble-username">{msg.username}</span>
                  <span className="bubble-time">{time}</span>
                </div>
                <p className="bubble-text">{msg.message}</p>
              </div>
            );
          })}

          {typingUser && (
            <div className="typing-indicator">{typingUser} is typing…</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="input-bar">
          <input
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </main>
    </div>
  );
}

export default App;