<div align="center">

# 💬 Chat App

**A real-time chat app where every client stays in sync through one Socket.IO event contract — no polling, no refresh.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)](https://socket.io)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Vite](https://img.shields.io/badge/Vite-rolldown-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

Users join with a username, and every message, join/leave, presence change, and
typing signal propagates to all connected clients over a single persistent
WebSocket connection. The server is the single source of truth — it broadcasts
a sent message back to the sender too, so there's no optimistic-UI branch that
can drift out of sync with what everyone else sees.

<img width="1512" alt="Chat app — header" src="https://github.com/user-attachments/assets/b52b706c-3d9a-4b76-a23e-d3dc60edc2b6" />
<img width="1511" alt="Chat app — conversation view" src="https://github.com/user-attachments/assets/09fd1e16-31db-421d-b1b7-3491b45cdeca" />

## How it works

Six Socket.IO events carry the entire app — this is the actual flow from
`server/index.js` and `src/App.tsx`, not a simplification.

```mermaid
sequenceDiagram
    actor Alice
    actor Bob
    participant Server as Socket.IO Server

    Alice->>Server: connect
    Alice->>Server: emit("join", "Alice")
    Server-->>Alice: emit("history", last 100 messages)
    Server-->>Alice: emit("users", [online usernames])
    Server-->>Bob: broadcast("system", "Alice joined the chat")

    Bob->>Server: emit("typing", "Bob")
    Server-->>Alice: broadcast("typing", "Bob")
    Note over Alice: clears "Bob is typing" after 2s of silence (client-side timer)

    Bob->>Server: emit("message", { message, username, timestamp })
    Server->>Server: push to in-memory history (cap 100), assign id
    Server-->>Alice: emit("message", msg)
    Server-->>Bob: emit("message", msg)
    Note over Server: broadcast to ALL clients, including the sender —<br/>one source of truth, so a message can never duplicate or diverge

    Bob->>Server: emit("leave", "Bob") — or socket disconnects
    Server-->>Alice: emit("users", updated list)
    Server-->>Alice: broadcast("system", "Bob left the chat")
```

**Reconnect handling:** on `join`, the server scans its `socketId → username`
map and evicts any stale socket already registered under the same name, so a
refreshed tab doesn't leave a ghost entry in the online list.

## Status

| Feature | State |
|---|---|
| Real-time messaging over WebSockets, single-broadcast-source | ✅ |
| Message history (last 100, in-memory) replayed to new joiners | ✅ |
| Live online-user list, join/leave system messages | ✅ |
| Typing indicators with client-side 2s debounce | ✅ |
| Reconnect-safe presence (stale socket cleanup by username) | ✅ |
| Unread badge — tab title counter + notification sound on blur | ✅ |
| Emoji picker, per-user avatar colors, responsive mobile sidebar | ✅ |
| Configurable CORS origin for production (`CLIENT_ORIGIN`) | ✅ |
| Persistent history (currently in-memory, lost on server restart) | ⏳ not yet |
| Authentication (usernames are self-declared, no accounts) | ⏳ not yet |

## Quick start

Requires Node.js. Two processes: the Socket.IO server and the Vite frontend.

```bash
git clone https://github.com/devinder-dev/Chat-App.git
cd Chat-App

# Terminal 1 — Socket.IO server
cd server
npm install
cp .env.example .env
npm run dev              # http://localhost:3001

# Terminal 2 — frontend
cd Chat-App
npm install
cp .env.example .env
npm run dev               # Vite dev server, http://localhost:5173
```

<details>
<summary><b>Architecture & folder layout</b> (click)</summary>

```mermaid
flowchart LR
    subgraph Browser["Browser (any number of clients)"]
        UI["React 19 + TypeScript<br/>src/App.tsx"]
    end

    UI <-->|WebSocket| IO["Socket.IO server<br/>server/index.js"]
    IO --> Map[("socketId → username<br/>in-memory Map")]
    IO --> Hist[("message history<br/>last 100, in-memory array")]
```

Both server and client are intentionally single-file — the whole event
contract lives in `server/index.js`, and the whole UI in `src/App.tsx`, so
the data flow above is traceable start to end without hunting across a
folder tree.

```
Chat-App/
├── server/
│   ├── index.js          Express + Socket.IO — connection handling, all events
│   └── .env.example      PORT, CLIENT_ORIGIN
├── src/
│   ├── App.tsx            entire UI: login, sidebar, message list, input bar
│   ├── App.css
│   └── main.jsx
└── .env.example           VITE_SERVER_URL
```

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite (rolldown-vite) |
| Backend | Node.js, Express, Socket.IO 4.8 |
| Transport | WebSocket via Socket.IO, CORS-restricted in production |
| State | In-memory only — `Map` for presence, array for history — no database |

</details>

<details>
<summary><b>Environment variables</b> (click)</summary>

**Server** (`server/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the Socket.IO server listens on | `3001` |
| `CLIENT_ORIGIN` | Allowed browser origin for CORS (set in prod) | `*` |

**Frontend** (`.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_SERVER_URL` | URL of the backend Socket.IO server | `http://localhost:3001` |

</details>

<details>
<summary><b>Full event reference</b> (click)</summary>

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `join` | client → server | `username: string` | Registers the socket, triggers history + presence sync |
| `history` | server → joining client only | `ChatMessage[]` | Last 100 messages, sent once on join |
| `users` | server → all | `string[]` | Full online-username list, sent after any join/leave |
| `system` | server → others | `string` | Human-readable join/leave notice |
| `message` | client → server → all (incl. sender) | `{ message, username, timestamp }` → `{ id, message, username, timestamp }` | Chat message; server assigns `id` and appends to history |
| `typing` | client → server → others | `username: string` | Relayed as-is; client clears it after 2s of no repeat |
| `leave` | client → server | `username: string` | Explicit logout — removes presence, broadcasts `system` |
| `disconnect` | socket lifecycle → server → all | — | Same cleanup as `leave`, for tab close / network drop |

</details>

---

<div align="center">

**Devinder Singh** · Fullstack Developer (YH) student at Chas Academy, Stockholm

</div>
