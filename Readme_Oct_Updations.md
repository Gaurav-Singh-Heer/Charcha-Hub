# CharchaHub — October 2026 Updates

This document explains, step by step, the improvements made to CharchaHub in this
round of work. Previously the app was a minimal Socket.io demo: a single shared
room where every message was a raw string and bubbles alternated left/right by
odd/even position. The updates below turn it into a credible real-time chat app.

---

## Summary of what changed

| Area | Before | After |
|------|--------|-------|
| Identity | None | Username prompt on join |
| Message shape | Raw string | `{ id, user, text, time }` object |
| Bubble alignment | odd/even CSS trick | Based on **your** socket id |
| History | None (blank on load) | Last 50 messages replayed on join |
| Presence | None | Live "online" count |
| Join / leave | None | System messages in the chat |
| Typing | None | "X is typing..." indicator |
| Autoscroll | Broken (`window.scrollTo`) | Fixed (`scrollTop = scrollHeight`) |
| Safety | OK | Still XSS-safe via `textContent` |

---

## Step 1 — Give every message an identity (server)

**File: `index.js`**

The old server just rebroadcast the raw string:

```js
socket.on('chat message', message => {
    io.emit("chat message", message);
});
```

The problem: the server had no idea *who* sent a message, so the client could
not tell its own messages apart from others'. The fix was to track users and
send structured messages.

1. Added a `users` map (`socket.id -> username`) so we always know who is who.
2. Added a `history` array capped at `MAX_HISTORY = 50` messages.
3. Changed each message into an object: `{ id, user, text, time }`.

```js
const message = {
    id: socket.id,          // who sent it
    user: username,         // display name
    text: String(text).slice(0, 2000),
    time: Date.now(),       // for the timestamp
};
history.push(message);
if (history.length > MAX_HISTORY) history.shift();
io.emit("chat message", message);
```

Capping the text length (`slice(0, 2000)`) prevents a single huge message from
abusing the broadcast.

## Step 2 — The "join" handshake

When a client connects it now sends a `join` event with the chosen username.
The server:

1. Stores the username (trimmed and capped at 24 chars; falls back to `Anonymous`).
2. Sends the existing **history** to that one new socket (`socket.emit`).
3. Sends a **welcome** event containing the socket's own id, so the client knows
   which messages are "mine".
4. Broadcasts a **system** message ("X joined the chat") and the new **online** count.

```js
socket.on("join", (rawName) => {
    const username = String(rawName || "Anonymous").trim().slice(0, 24) || "Anonymous";
    users.set(socket.id, username);
    socket.emit("history", history);
    socket.emit("welcome", { id: socket.id, username });
    io.emit("system", `${username} joined the chat`);
    io.emit("online", users.size);
});
```

> Note the difference between `socket.emit` (just this client), `io.emit`
> (everyone), and `socket.broadcast.emit` (everyone except the sender).

## Step 3 — Presence and leave events

On `disconnect` the server removes the user, announces they left, and re-emits
the updated online count:

```js
socket.on("disconnect", () => {
    const username = users.get(socket.id);
    if (!username) return;
    users.delete(socket.id);
    io.emit("system", `${username} left the chat`);
    io.emit("online", users.size);
});
```

## Step 4 — Typing indicator (server relay)

The server simply relays typing state to **everyone except** the person typing:

```js
socket.on("typing", (isTyping) => {
    const username = users.get(socket.id);
    if (!username) return;
    socket.broadcast.emit("typing", { user: username, isTyping: !!isTyping });
});
```

---

## Step 5 — Ask for a username (client)

**File: `public/1_index.html`**

Right after connecting, the client prompts for a name and announces itself:

```js
var username = (prompt("Enter your name") || "").trim().slice(0, 24) || "Anonymous";
socket.emit("join", username);
```

It also stores its own id from the `welcome` event, which is the key to correct
bubble alignment:

```js
socket.on("welcome", function (data) { myId = data.id; });
```

## Step 6 — Render messages with name, time, and correct side

Each message is now rendered with a sender name and timestamp. Bubbles the
current user sent get the `mine` class, which aligns them right with the green
background — regardless of order:

```js
function addMessage(msg) {
    var li = document.createElement("li");
    if (msg.id === myId) li.classList.add("mine");   // my message -> right
    // meta = name + time, body = text (textContent keeps it XSS-safe)
    ...
    messages.appendChild(li);
    scrollToBottom();
}
```

Using `textContent` (not `innerHTML`) means a message like
`<img src=x onerror=alert(1)>` is shown as literal text, not executed — this is
what keeps the app safe from cross-site scripting.

## Step 7 — History replay and system messages

```js
socket.on("history", function (list) { (list || []).forEach(addMessage); });
socket.on("system", addSystem);         // centered grey pill
socket.on("online", function (count) { onlineEl.textContent = count + " online"; });
```

New users now see the recent conversation instead of a blank screen, and the
nav bar shows how many people are connected.

## Step 8 — Fix autoscroll

The old code called `window.scrollTo(...)`, but the scroll container is the
`#messages` list (`overflow-y: auto`), not the window. The fix:

```js
function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
}
```

## Step 9 — Typing indicator (client)

As the user types we emit `typing: true`, and after 1.2s of inactivity (or on
send) we emit `typing: false`. Incoming typing events are collected and rendered
as "X is typing...":

```js
input.addEventListener("input", function () {
    if (!amTyping) { amTyping = true; socket.emit("typing", true); }
    clearTimeout(stopTimer);
    stopTimer = setTimeout(function () {
        amTyping = false; socket.emit("typing", false);
    }, 1200);
});
```

---

## Step 10 — Project hygiene

- **`package.json`** — renamed from `31_websocket_chat_app` to `charcha-hub`,
  updated the description, bumped to `1.1.0`, and split scripts into
  `start` (`node index.js`, for production/Render) and `dev` (`nodemon`).
- **`.gitignore`** — added so `node_modules`, `.env`, and `.DS_Store` are not
  committed.

---

## How to run locally

```bash
npm install
npm run dev        # nodemon, auto-restarts on change
# or
npm start          # plain node
```

Then open <http://localhost:9000> in two browser tabs, enter different names,
and chat. Open the tabs side by side to see your own messages on the right and
the other person's on the left, the live online count, join/leave notices, and
the typing indicator.

---

## Known limitations / future ideas

- **History is in-memory**, so it resets whenever the server restarts (the
  Render free tier sleeps when idle). A database (MongoDB/Redis) would make it
  persistent.
- **Single global room** — multiple rooms/channels would let "Hub" live up to
  its name.
- Usernames are not authenticated or unique — anyone can pick any name.
- Could add message delivery/read receipts, avatars, and emoji support.
