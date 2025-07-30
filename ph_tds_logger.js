const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

const sensorsId = [1, 2];  // Sensor 1: pH, Sensor 2: TDS
let pH, TDS;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getMeterValue = async (id) => {
  try {
    await client.setID(id);
    let val = await client.readHoldingRegisters(0, 2); 
    return val.data;
  } catch (e) {
    console.log(`[ERROR] Reading sensor ID ${id}:`, e.message);
    return -1;
  }
};

const getMetersValue = async () => {
  for (let sensor of sensorsId) {
    const val = await getMeterValue(sensor);
    if (val !== -1) {
      if (sensor === 1) {
        pH = val;
        console.log(`[pH SENSOR] pH: ${val[0] / 1000}, Temp: ${val[1] / 100}°C`);
      } else if (sensor === 2) {
        TDS = val;
        console.log(`[TDS SENSOR] TDS: ${val[0] / 10}, Temp: ${val[1] / 100}°C`);
      }
    }
    await sleep(100);  // Delay between devices
  }
};

async function startSensorLoop() {
  try {
    await client.connectRTUBuffered("/dev/ttyS2", { baudRate: 9600 });
    client.setTimeout(500);
    console.log("Connected to Modbus device.");

    // Run initially
    await getMetersValue();

    // Then loop every 30 seconds
    setInterval(getMetersValue, 30000);
  } catch (e) {
    console.error("Connection error:", e.message);
  }
}

startSensorLoop();


