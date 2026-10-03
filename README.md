# CharchaHub

A real-time chat application built with **Node.js, Express, and Socket.io**.
"Charcha" (चर्चा) means *discussion* — CharchaHub is a simple, fast place to chat.

> Deployed on [Render](https://render.com) (Vercel does not support Socket.io's
> persistent WebSocket connections).

## Features

- 💬 Real-time messaging over WebSockets (Socket.io)
- 👤 Username on join
- ↔️ Your messages align right; others' align left (based on socket id)
- 🕘 Recent message history replayed when you join (last 50)
- 🟢 Live online-user count
- 🔔 Join / leave system notifications
- ✍️ "User is typing..." indicator
- 🔒 XSS-safe rendering (user text is never treated as HTML)
- 📱 Responsive, WhatsApp-style UI

## Tech stack

| Layer | Technology |
|-------|------------|
| Server | Node.js, Express |
| Realtime | Socket.io |
| Frontend | Vanilla HTML / CSS / JS |
| Hosting | Render |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Run in development (auto-restart on change)
npm run dev

# 3. Or run in production mode
npm start
```

Then open <http://localhost:9000> in a couple of tabs and start chatting.

The port can be overridden with the `PORT` environment variable — handy when
9000 is already in use:

```bash
PORT=9123 npm run dev
```

Then open <http://localhost:9123> instead.

## Troubleshooting — messages don't cross between tabs

If you open two tabs and see "1 online" in each, messages don't appear in the
other tab, and each tab only shows its own "joined the chat", you are almost
certainly running **two separate servers** on different ports (e.g.
`localhost:9123` and `localhost:9124`). Each server has its own Socket.io
instance and its own in-memory state, so they cannot talk to each other.

You only need **one** server, and both tabs must point to the **same port**:

1. Stop any extra server you started (Ctrl+C in the second terminal).
2. Run a single server:
   ```bash
   PORT=9123 npm run dev
   ```
3. Open the URL in two tabs, **both on the same port**:
   - Tab 1: <http://localhost:9123>
   - Tab 2: <http://localhost:9123>  ← same port, not 9124

Then you'll see "2 online", both join messages, cross-tab chat, and the typing
indicator working.

> **Note on alignment:** each person sees *their own* messages on the right
> (green) and the other person's on the left — this is intended, exactly like
> WhatsApp. If both tabs show green, each tab is really its own isolated chat
> (the two-servers problem above).

In production on Render none of this applies — there is a single server and
everyone hits the same URL. The multi-port situation only happens locally when
the dev server is started more than once.

## Project structure

```
.
├── index.js              # Express + Socket.io server
├── public/
│   └── 1_index.html      # Chat client (UI + Socket.io logic)
├── package.json
└── Readme_Oct_Updations.md   # Stepwise notes on the Oct 2026 updates
```

## Updates

See [**Readme_Oct_Updations.md**](./Readme_Oct_Updations.md) for a detailed,
stepwise explanation of the October 2026 improvements (identity, history,
presence, typing indicator, and more).

## License

ISC © Gaurav
