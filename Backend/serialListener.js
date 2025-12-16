const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { broadcast } = require('./server');

// Find your Arduino port (usually COM3, COM4, etc. on Windows)
// You can find it in Arduino IDE under Tools > Port
const ARDUINO_PORT = 'COM3'; // Change this to your Arduino's port
const BAUD_RATE = 9600;

let port;

function connectSerial() {
    port = new SerialPort({
        path: ARDUINO_PORT,
        baudRate: BAUD_RATE,
    }, (err) => {
        if (err) {
            console.error('Serial port error:', err.message);
            console.log('Retrying in 5 seconds...');
            setTimeout(connectSerial, 5000);
            return;
        }
        console.log(`Connected to Arduino on ${ARDUINO_PORT}`);
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (data) => {
        const value = data.trim();
        
        // Only broadcast commands, not debug messages
        const commands = ['JUMP', 'HIGH_JUMP', 'LEFT', 'RIGHT', 'FAST_LEFT', 'FAST_RIGHT', 'STOP'];
        if (commands.includes(value)) {
            console.log('Received command:', value);
            broadcast(value);
        }
    });

    port.on('error', (err) => {
        console.error('Serial error:', err.message);
    });

    port.on('close', () => {
        console.log('Serial port closed, reconnecting...');
        setTimeout(connectSerial, 2000);
    });
}

connectSerial();
