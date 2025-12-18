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

let writeDataChar = null; // Reference to BLE write characteristic

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.on("message", (msg) => {
    const data = msg.toString();
    console.log("Received from client:", data);

    // If it's COIN_ADDED, send to Arduino via BLE
    if (data === 'COIN_ADDED' && writeDataChar) {
      sendToArduino('COIN_ADDED');
    }
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

function sendToArduino(message) {
  if (writeDataChar) {
    const buffer = Buffer.from(message, 'utf8');
    writeDataChar.write(buffer, false, (err) => {
      if (err) {
        console.error('Error sending to Arduino:', err);
      } else {
        console.log('✓ Sent to Arduino:', message);
      }
    });
  } else {
    console.warn('BLE write characteristic not available');
  }
}

function setWriteCharacteristic(characteristic) {
  writeDataChar = characteristic;
  console.log('BLE write characteristic set');
}

module.exports = { broadcast, sendToArduino, setWriteCharacteristic };

// Start BLE listener (it will require './server' for broadcast)
require('./bleListener');
