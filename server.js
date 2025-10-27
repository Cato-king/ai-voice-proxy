// server.js - simple WS proxy between client and OpenAI Realtime
require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const OPENAI_WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('OpenAI Realtime Proxy is running'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (clientSocket, req) => {
  console.log('Client connected');

  // Open a WS to OpenAI with Authorization header
  const openaiSocket = new (require('ws'))(OPENAI_WS_URL, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      // Some OpenAI realtime features require this header:
      'OpenAI-Beta': 'realtime=v1'
    },
    perMessageDeflate: false
  });

  openaiSocket.on('open', () => {
    console.log('Connected to OpenAI Realtime');
    // Optionally send an initial system message event if desired:
    const init = {
      type: 'session.update',
      session: {
        instructions: `You are "Tensei", a sweet, shy, cute anime companion. Speak gently and warmly. voice:tensei`
      }
    };
    openaiSocket.send(JSON.stringify(init));
  });

  openaiSocket.on('message', (data) => {
    // Forward whatever OpenAI sends back to the client
    if (clientSocket.readyState === clientSocket.OPEN) {
      clientSocket.send(data);
    }
  });

  openaiSocket.on('close', () => console.log('OpenAI WS closed'));
  openaiSocket.on('error', (e) => console.error('OpenAI WS error', e));

  clientSocket.on('message', (msg) => {
    // Client will send JSON messages (text events or base64 audio)
    // Proxy them to OpenAI as-is
    try {
      // If client sends binary, forward raw
      // Here we assume JSON text messages
      openaiSocket.send(msg);
    } catch (err) {
      console.error('Error forwarding message to OpenAI', err);
    }
  });

  clientSocket.on('close', () => {
    console.log('Client disconnected');
    try { openaiSocket.close(); } catch (e) {}
  });

  clientSocket.on('error', (e) => console.error('Client WS error', e));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Proxy listening on port ${port}`));
