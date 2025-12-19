import { useEffect, useState } from "react";
import "./App.css";
import { io } from "socket.io-client";

const socket = io("ws://10.100.2.139:3001");

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [username, setUsername] = useState(localStorage.getItem("chat_username") || "Devinder_Singh");

  const connectionStatus = connected ? "Connected" : "Disconnected";

  useEffect(() => {
   
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("project1", (data) => {
      const receivedMessage = JSON.parse(data);
      setMessages(prev => [...prev, receivedMessage]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("project1");
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const name = loginInput.trim();
    if (!name) return;
    localStorage.setItem("chat_username", name);
    setUsername(name);
    setLoginInput("");
  };

  const handleLogout = () => {
    localStorage.removeItem("chat_username");
    setUsername("");
  };

  const sendMessage = () => {
    const message = {
      message: input,
      username: username,
      timestamp:{
        hour: new Date().getHours(),
        minutes: new Date().getMinutes(),
        seconds: new Date().getSeconds()
        
        
      }
    };

    socket.emit("project1", JSON.stringify(message));
    setInput('');
    setMessages(prev => [...prev, message]);
  };

   if (!username) {
    return (
      <div className="chat-container">
        <h3>Enter username to join chat</h3>
        <form onSubmit={handleLogin} className="input-area">
          <input
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            placeholder="Username"
          />
          <button type="submit">Join</button>
        </form>
      </div>
    );
  }
  return (
    <div className="chat-container">
      <p className="status">{connectionStatus}</p>

      <div>
        <span>Signed in as <strong>{username}</strong></span>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {messages.map((msg, index) => (
  <div
    key={index}
    className={`message ${msg.username === username ? 'own-message' : 'other-message'}`}
  >
    <strong>{msg.username}:</strong> {msg.message}
    <span className="timestamp">
      {`@ ${msg.timestamp.hours}:${msg.timestamp.minutes}:${msg.timestamp.seconds}`}
    </span>
  </div>
))}

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;