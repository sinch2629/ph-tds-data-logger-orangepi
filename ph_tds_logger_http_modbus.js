http_modbus2.js 
const { SerialPort } = require('serialport');
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

const logDir = '/opt/gateway/my_modbus_project/modbus_logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

let logData = [];

// === Cloud Upload Config ===
const cloudEndpoint = 'https://your-cloud-service.com/api/data'; // <-- Replace with your actual endpoint
const apiKey = 'your-api-key-if-required'; // Optional, replace as needed

function getLogFilePath() {
  const now = new Date();
  const filename = now.toISOString().replace(/:/g, '-').slice(0, 19);
  return path.join(logDir, `modbus_log_${filename}.json`);
}

function uploadFile(filePath) {
  const fileData = fs.readFileSync(filePath);
  axios.post(cloudEndpoint, JSON.parse(fileData), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  })
  .then(response => {
    console.log(`[UPLOAD] Sent: ${path.basename(filePath)} | Response:`, response.data);
  })
  .catch(error => {
    console.error(`[ERROR] Uploading ${path.basename(filePath)}:`, error.response?.data || error.message);
  });
}

function saveLogToFile() {
  try {
    const filePath = getLogFilePath();
    fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
    console.log(`[INFO] Logs saved: ${path.basename(filePath)}`);
    uploadFile(filePath); // Trigger upload after saving
  } catch (err) {
    console.error('[ERROR] Writing log file:', err.message);
  }
}

function cleanupOldLogs() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  fs.readdir(logDir, (err, files) => {
    if (err) {
      console.error('[ERROR] Reading log directory:', err.message);
      return;
    }

    files.forEach(file => {
      if (!file.endsWith('.json')) return;

      const match = file.match(/modbus_log_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.json/);
      if (!match) return;

      const timestampStr = match[1].replace(/-/g, ':').replace('T', ' ');
      const fileTime = new Date(timestampStr.replace(/ /, 'T')).getTime();

      if (fileTime < oneHourAgo) {
        const fullPath = path.join(logDir, file);
        fs.unlink(fullPath, err => {
          if (err) {
            console.error(`[ERROR] Deleting old log ${file}:`, err.message);
          } else {
            console.log(`[CLEANUP] Deleted old log: ${file}`);
          }
        });
      }
    });
  });
}

// === CRC ===
function calculateCRC(buffer) {
  let crc = 0xFFFF;
  for (let pos = 0; pos < buffer.length; pos++) {
    crc ^= buffer[pos];
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x0001) !== 0) {
        crc >>= 1;
        crc ^= 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

function appendCRC(buffer) {
  const crc = calculateCRC(buffer);
  const result = Buffer.alloc(buffer.length + 2);
  buffer.copy(result, 0);
  result[result.length - 2] = crc & 0xFF;
  result[result.length - 1] = (crc >> 8) & 0xFF;
  return result;
}

// === Serial Port Setup ===
const port = new SerialPort({
  path: '/dev/ttyS2',
  baudRate: 9600,
  autoOpen: false,
});

let currentID = 1;
let buffer = Buffer.alloc(0);

port.open(err => {
  if (err) {
    console.error('[ERROR] Failed to open port:', err.message);
    process.exit(1);
  }
  console.log('[INFO] Serial port opened');
  pollNext();
});

function pollNext() {
  const slaveID = currentID;
  const rawRequest = Buffer.from([
    slaveID,
    0x03,
    0x00, 0x00,
    0x00, 0x02
  ]);

  const requestWithCRC = appendCRC(rawRequest);
  console.log(`[SENDING] Slave ${slaveID}: ${requestWithCRC.toString('hex')}`);
  buffer = Buffer.alloc(0);
  port.write(requestWithCRC);

  currentID = currentID === 1 ? 2 : 1;
  setTimeout(pollNext, 2000);
}

port.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);

  if (buffer.length >= 9) {
    const slaveID = buffer[0];
    const functionCode = buffer[1];
    const byteCount = buffer[2];

    if (functionCode === 0x03 && byteCount === 4) {
      const reg1 = buffer.readUInt16BE(3);
      const reg2 = buffer.readUInt16BE(5);
      const timestamp = new Date().toISOString();

      const entry = { timestamp, slaveID, registers: [reg1, reg2] };
      logData.push(entry);

      console.log(`[RECEIVED] Slave ${slaveID} → Registers: [${reg1}, ${reg2}]`);
    } else {
      console.warn(`[WARN] Unexpected response: ${buffer.toString('hex')}`);
    }

    buffer = Buffer.alloc(0);
  }
});

port.on('error', (err) => {
  console.error('[SERIAL ERROR]:', err.message);
});

// === Periodic Tasks ===
setInterval(() => {
  saveLogToFile();
  cleanupOldLogs();
  logData = []; // clear in-memory after saving
}, 10000);

// === Web Interface ===
app.get('/', (req, res) => {
  res.send(`<h1>Modbus Logs</h1><p><a href="/logs.json">In-Memory</a> | <a href="/list-logs">Saved Logs</a></p>`);
});

app.get('/logs.json', (req, res) => {
  res.json(logData);
});

app.get('/list-logs', (req, res) => {
  fs.readdir(logDir, (err, files) => {
    if (err) return res.status(500).send('Error reading logs');
    const logs = files.filter(f => f.endsWith('.json')).sort();
    res.json(logs);
  });
});

app.listen(PORT, () => {
  console.log(`[WEB] Server running: http://localhost:${PORT}`);
});
gateway@7e353639-82b2-4263-b9c1-a3f8ef7f4df6:/opt/gateway/my_modbus_project$
