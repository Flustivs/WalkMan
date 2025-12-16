// server.js
const express = require("express");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();

// Serve frontend
app.use(express.static(path.join(__dirname, "../Frontend")));

const server = app.listen(3000, () => {
  console.log("Backend running on port 3000");
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.on("message", (msg) => {
    const data = msg.toString();
    console.log("Received from client:", data);

    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

// Export broadcast function
function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

module.exports = { broadcast };

// Start BLE listener (it will require './server' for broadcast)
require('./bleListener');
