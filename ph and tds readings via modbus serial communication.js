const { SerialPort } = require('serialport');

// === CRC Calculation ===
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
  result[result.length - 2] = crc & 0xFF;         // CRC Low Byte
  result[result.length - 1] = (crc >> 8) & 0xFF;  // CRC High Byte
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
    return console.error('[ERROR] Failed to open port:', err.message);
  }
  console.log('[INFO] Serial port open');
  pollNext();
});

function pollNext() {
  const slaveID = currentID;
  const rawRequest = Buffer.from([
    slaveID,
    0x03,       // Function code
    0x00, 0x00, // Start address
    0x00, 0x02  // Number of registers
  ]);

  const requestWithCRC = appendCRC(rawRequest);
  console.log(`[SENDING] Slave ${slaveID}: ${requestWithCRC.toString('hex')}`);
  buffer = Buffer.alloc(0);
  port.write(requestWithCRC);

  // Alternate between slave IDs
  currentID = currentID === 1 ? 2 : 1;

  // Schedule next poll
  setTimeout(pollNext, 2000);
}

port.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);

  if (buffer.length >= 9) { // Slave + Function + ByteCount + 2 registers (4 bytes) + CRC = 9
    const slaveID = buffer[0];
    const functionCode = buffer[1];
    const byteCount = buffer[2];

    if (functionCode === 0x03 && byteCount === 4) {
      const reg1 = buffer.readUInt16BE(3);
      const reg2 = buffer.readUInt16BE(5);
      console.log(`[RECEIVED] Slave ${slaveID} → Holding Registers: [${reg1}, ${reg2}]`);
    } else {
      console.warn(`[WARN] Unexpected response: ${buffer.toString('hex')}`);
    }

    buffer = Buffer.alloc(0); // Reset buffer after each response
  }
});

port.on('error', (err) => {
  console.error('[SERIAL ERROR]:', err.message);
});

