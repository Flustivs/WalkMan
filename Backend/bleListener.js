// bleListener.js
const noble = require('@abandonware/noble');
const { broadcast, setWriteCharacteristic } = require('./server');

const ARDUINO_NAME = 'WalkMan';         // BLE local name
const ARDUINO_ADDR = '24:ec:4a:21:ea:1d'; // BLE MAC address

// Characteristic UUIDs (must match Arduino)
const COMMAND_CHAR_UUID = '19b10001e8f2537e4f6cd104768a1214';
const AUTH_CHAR_UUID    = '19b10002e8f2537e4f6cd104768a1214';
const WRITE_DATA_CHAR_UUID = '19b10003e8f2537e4f6cd104768a1214'; // New write characteristic

// Password for authentication (must match Arduino)
const SECRET_PASSWORD = 'this-^.^-game-1s-5ecur3-dat3bay0';

console.log('BLE Listener: Starting...');

noble.on('stateChange', (state) => {
    console.log('BLE State:', state);
    if (state === 'poweredOn') {
        console.log('BLE is powered on - starting scan...');
        noble.startScanning([], false); // scan for all devices
    } else {
        console.log('BLE is not powered on - stopping scan');
        noble.stopScanning();
    }
});

noble.on('discover', (peripheral) => {
    const advName = peripheral.advertisement.localName || '(no name)';
    const addr = (peripheral.address || '(no addr)').toLowerCase();

    console.log('BLE Device found:', advName, 'addr:', addr);

    // Only connect if local name or MAC address matches
    if (advName !== ARDUINO_NAME && addr !== ARDUINO_ADDR) return;

    console.log('✓ Arduino candidate found! Connecting...');
    noble.stopScanning();

    peripheral.connect((err) => {
        if (err) {
            console.error('Connection error:', err);
            setTimeout(() => noble.startScanning([], false), 2000);
            return;
        }

        console.log('✓ Connected to Arduino:', peripheral.address);

        // Handle disconnect first
        peripheral.on('disconnect', () => {
            console.log('Arduino disconnected, restarting scan...');
            setTimeout(() => noble.startScanning([], false), 500);
        });

        // Discover all characteristics (no service filter)
        peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
            if (err) {
                console.error('Discovery error:', err);
                peripheral.disconnect();
                return;
            }

            const authChar = characteristics.find(c => c.uuid === AUTH_CHAR_UUID.toLowerCase());
            const dataChar = characteristics.find(c => c.uuid === COMMAND_CHAR_UUID.toLowerCase());
            const writeDataChar = characteristics.find(c => c.uuid === WRITE_DATA_CHAR_UUID.toLowerCase());

            if (!authChar || !dataChar) {
                console.error('Required characteristics not found!');
                console.error('Auth:', authChar ? 'found' : 'missing');
                console.error('Data:', dataChar ? 'found' : 'missing');
                peripheral.disconnect();
                return;
            }

            // Set the write characteristic reference in server.js
            if (writeDataChar) {
                setWriteCharacteristic(writeDataChar);
            } else {
                console.warn('Write characteristic not found, coin feedback unavailable');
            }

            // Setup data listener BEFORE subscribing
            dataChar.on('data', (data) => {
                const value = data.toString('utf-8').trim();
                console.log('Received BLE:', value);
                broadcast(value); // send to frontend
            });

            // Authenticate by writing password
            const pwBuffer = Buffer.from(SECRET_PASSWORD, 'utf8');
            console.log('Sending authentication password to Arduino...');
            authChar.write(pwBuffer, false, (err) => {
                if (err) {
                    console.error('Auth write error:', err);
                    peripheral.disconnect();
                    return;
                }
                console.log('✓ Authentication password sent. Subscribing to command notifications...');

                dataChar.subscribe((err) => {
                    if (err) {
                        console.error('Subscribe error:', err);
                        peripheral.disconnect();
                    } else {
                        console.log('✓ Subscribed to BLE notifications - Connection stable');
                    }
                });
            });
        });
    });
});
