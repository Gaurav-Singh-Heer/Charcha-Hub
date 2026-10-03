const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 9000;

// In-memory chat history (last N messages). Resets on server restart.
const MAX_HISTORY = 50;
const history = [];

// Map of socket.id -> username, used for presence + join/leave messages.
const users = new Map();

function onlineCount() {
    return users.size;
}

// Socket.io
io.on("connection", (socket) => {
    // The client sends its chosen username right after connecting.
    socket.on("join", (rawName) => {
        const username = String(rawName || "Anonymous").trim().slice(0, 24) || "Anonymous";
        users.set(socket.id, username);

        // Send chat history to the newly joined user only.
        socket.emit("history", history);

        // Confirm identity so the client knows its own id (for bubble alignment).
        socket.emit("welcome", { id: socket.id, username });

        // Tell everyone someone joined + update the online count.
        io.emit("system", `${username} joined the chat`);
        io.emit("online", onlineCount());
    });

    socket.on("chat message", (text) => {
        const username = users.get(socket.id);
        // Ignore messages from sockets that never joined, or empty text.
        if (!username || !text || !String(text).trim()) return;

        const message = {
            id: socket.id,
            user: username,
            text: String(text).slice(0, 2000),
            time: Date.now(),
        };

        history.push(message);
        if (history.length > MAX_HISTORY) history.shift();

        io.emit("chat message", message);
    });

    // Relay typing state to everyone except the sender.
    socket.on("typing", (isTyping) => {
        const username = users.get(socket.id);
        if (!username) return;
        socket.broadcast.emit("typing", { user: username, isTyping: !!isTyping });
    });

    socket.on("disconnect", () => {
        const username = users.get(socket.id);
        if (!username) return;
        users.delete(socket.id);
        io.emit("system", `${username} left the chat`);
        io.emit("online", onlineCount());
    });
});

// HTTP Handle
app.use(express.static(path.resolve("./public")));

app.get("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, "public", "1_index.html"));
});

server.listen(PORT, () => console.log(`Server has started at ${PORT}`));
