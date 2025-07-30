# Orange Pi pH & TDS Sensor Reader via Modbus

This project reads **pH** and **TDS** sensor data using **Modbus RTU** over **RS485**, running on an **Orange Pi Zero Plus 2**.

It collects data from:
- **pH Sensor** (e.g., MS PH-212)
- **TDS Sensor** (e.g., MS TDS-211)

Hardware Used

- Orange Pi Zero Plus 2 (Armbian OS)
- RS485 to USB/TTL Converter
- pH Sensor (MS PH-212)
- TDS Sensor (MS TDS-211)
- External power supply (if needed)

Wiring Overview

- RS485 A/B to sensors' RS485 terminals
- USB RS485 adapter plugged into Orange Pi
- Ensure Modbus IDs and baud rates are set properly on each sensor

Features

- Communicates with sensors using Modbus RTU (via `modbus-serial` or `node-modbus`)
- Periodically reads sensor data
- Logs data as JSON
- Optional: Uploads data to a remote server or cloud service

Folder Structure

ph-tds-modbus-orangepi/
├── src/
│ ├── read_ph.js
│ ├── read_tds.js
│ └── logger.js
├── logs/
│ └── ph_tds_log_YYYYMMDD.json
├── README.md
└── package.json
