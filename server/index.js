import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { randomUUID } from "crypto";

const app = express();

// Don't advertise the framework in response headers.
app.disable("x-powered-by");

// Allowed browser origin(s). Defaults to "*" for local dev; set CLIENT_ORIGIN in production.
// eslint-disable-next-line no-undef
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
app.use(cors({ origin: CLIENT_ORIGIN }));

// Plain HTTP here is intentional: Socket.IO needs an http.Server, and TLS is
// terminated by the reverse proxy (e.g. nginx) in front of this service in production.
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

// socketId -> username for tracking who is online
const users = new Map();
// In-memory message history (last 100 messages)
const messageHistory = [];
const MAX_HISTORY = 100;

io.on("connection", (socket) => {
  console.log(`[+] connected ${socket.id}`);

  // Client calls this right after connecting, passing their chosen username
  socket.on("join", (username) => {
    // If this username is reconnecting from a stale socket, clean the old entry
    for (const [sid, name] of users) {
      if (name === username && sid !== socket.id) users.delete(sid);
    }

    users.set(socket.id, username);
    console.log(`[join] ${username}`);

    // Send the full message history only to the newly joined user
    socket.emit("history", messageHistory);

    // Broadcast updated online user list to everyone
    io.emit("users", [...users.values()]);

    // Tell everyone else (not the joiner) that someone arrived
    socket.broadcast.emit("system", `${username} joined the chat`);
  });

  socket.on("message", (data) => {
    const msg = {
      id: randomUUID(),
      message: data.message,
      username: data.username,
      timestamp: data.timestamp ?? Date.now(),
    };

    messageHistory.push(msg);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();

    // Broadcast to ALL clients including the sender so the sender's
    // message always comes from a single source of truth (no duplicates)
    io.emit("message", msg);
  });

  // Relay typing events to everyone except the sender
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  // Intentional logout — client emits this before disconnecting
  socket.on("leave", (username) => {
    users.delete(socket.id);
    io.emit("users", [...users.values()]);
    io.emit("system", `${username} left the chat`);
    console.log(`[leave] ${username}`);
  });

  socket.on("disconnect", () => {
    const username = users.get(socket.id);
    if (username) {
      users.delete(socket.id);
      io.emit("users", [...users.values()]);
      io.emit("system", `${username} left the chat`);
      console.log(`[-] disconnected ${username}`);
    }
  });
});

// eslint-disable-next-line no-undef
const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
