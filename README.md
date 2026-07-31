# 💬 Real-Time Chat App — React + Socket.IO

A modern real-time chat application built with **React, Socket.IO, and Node.js**. Users join the chat, send messages instantly, and see updates live — no refresh needed.

This project demonstrates real-time communication, event-driven architecture, reusable components, and a clean frontend structure.

<img width="1512" alt="Chat app — header" src="https://github.com/user-attachments/assets/b52b706c-3d9a-4b76-a23e-d3dc60edc2b6" />
<img width="1511" alt="Chat app — conversation view" src="https://github.com/user-attachments/assets/09fd1e16-31db-421d-b1b7-3491b45cdeca" />

## 🚀 Features

- **Real-time messaging** — messages appear instantly for all connected users over Socket.IO WebSockets
- **Join/leave notifications** — everyone is notified when a user enters or leaves
- **Online users tracking** — live list of who's currently connected
- **Typing indicators** — see when another user is typing
- **Clean UI components** — reusable components for messages, input, and layout

## 🛠 Tech Stack

- **Frontend:** React · Vite · TypeScript
- **Backend:** Node.js · Express · Socket.IO

## 🏃 Running locally

```bash
# 1. Start the Socket.IO server
cd server
npm install
node index.js          # runs on http://localhost:3001

# 2. In another terminal, start the frontend
npm install
npm run dev            # Vite dev server
```

**Server environment variables**

| Variable        | Description                                   | Default |
|-----------------|-----------------------------------------------|---------|
| `PORT`          | Port the Socket.IO server listens on          | `3001`  |
| `CLIENT_ORIGIN` | Allowed browser origin for CORS (set in prod) | `*`     |
