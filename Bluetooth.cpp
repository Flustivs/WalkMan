#include "Bluetooth.h"

// BLE service and characteristics
BLEService controlService(CONTROL_SERVICE_UUID);

// The command characteristic is Notify-only from peripheral -> central
BLECharacteristic commandChar(COMMAND_CHAR_UUID, BLENotify, 20);

// The auth characteristic is Write-only from central -> peripheral
BLECharacteristic authChar(AUTH_CHAR_UUID, BLEWrite, 32);

// The write data characteristic is Write-only from central -> peripheral (for feedback like coins)
BLECharacteristic writeDataChar(WRITE_DATA_CHAR_UUID, BLEWrite, 32);

// Authentication and timing state
static bool authenticated = false;
static bool authPending = false;
static unsigned long authStartMillis = 0;
static const unsigned long AUTH_TIMEOUT_MS = 5000;     // 2 seconds to authenticate
static const unsigned long ADVERT_SUSPEND_MS = 6000;   // 3 seconds suspend on failure
static unsigned long suspendStartMillis = 0;
static bool suspended = false;

// Track advertising state
static bool isAdvertising = false;

String lastCommand = "";

void ensureAdvertise(bool start) {
  if (start) {
    if (!isAdvertising) {
      BLE.advertise();
      isAdvertising = true;
      Serial.println("DEBUG: Started advertising");
    }
  } else {
    if (isAdvertising) {
      BLE.stopAdvertise();
      isAdvertising = false;
      Serial.println("DEBUG: Stopped advertising");
    }
  }
}

void initBluetooth() {
  Serial.println("DEBUG: Starting BLE initialization...");

  if (!BLE.begin()) {
    Serial.println("ERROR: Failed to start BLE!");
    delay(1000);
    if (!BLE.begin()) {
      Serial.println("FATAL: BLE failed twice!");
      while (1) { delay(1000); }
    }
  }

  Serial.println("DEBUG: BLE started successfully");

  BLE.setLocalName("WalkMan");
  Serial.println("DEBUG: Local name set to 'WalkMan'");

  controlService.addCharacteristic(commandChar);
  controlService.addCharacteristic(authChar);
  controlService.addCharacteristic(writeDataChar);

  BLE.addService(controlService);
  Serial.println("DEBUG: Service and characteristics added");

  // initial state for command
  commandChar.writeValue("IDLE");
  Serial.println("DEBUG: Initial command set to IDLE");

  // Auth write handler: invoked when a client writes to authChar
  authChar.setEventHandler(BLEWritten, [](BLEDevice central, BLECharacteristic characteristic) {
    // characteristic.value() returns const uint8_t*, use valueLength() to construct String
    const uint8_t *val = characteristic.value();
    int len = characteristic.valueLength();
    String incoming = "";
    if (val && len > 0) {
      // construct String from bytes
      incoming = String((const char *)val, len);
      incoming.trim();
    }

    Serial.print("DEBUG: Auth write received: '");
    Serial.print(incoming);
    Serial.println("'");

    if (!authPending) {
      Serial.println("DEBUG: No auth expected right now — ignoring write");
      return;
    }

    if (incoming.equals(String(SECRET_PASSWORD))) {
      authenticated = true;
      authPending = false;
      Serial.println("✓ Authentication successful");
      // Once authenticated, stop advertising to reduce exposure
      ensureAdvertise(false);
    } else {
      Serial.println("!! Authentication failed - disconnecting client and suspending advertising");
      // Disconnect the central that attempted auth
      if (central) {
        central.disconnect();
      }
      authPending = false;
      authenticated = false;
      suspended = true;
      suspendStartMillis = millis();
      ensureAdvertise(false);
    }
  });

  // Write data handler: receives feedback from backend (e.g., COIN_ADDED)
  writeDataChar.setEventHandler(BLEWritten, [](BLEDevice central, BLECharacteristic characteristic) {
    const uint8_t *val = characteristic.value();
    int len = characteristic.valueLength();
    String incoming = "";
    if (val && len > 0) {
      incoming = String((const char *)val, len);
      incoming.trim();
    }

    Serial.print("DEBUG: Data write received: '");
    Serial.print(incoming);
    Serial.println("'");
    
    // Store received data so main loop can process it
    // This will be handled in receiveBluetoothData()
  });

  // Start advertising
  ensureAdvertise(true);

  delay(100);
  Serial.println("✓ BLE ready and advertising");
  Serial.print("  Address: ");
  Serial.println(BLE.address());
}

void pollBluetooth() {
  // Manage suspended advertising window
  if (suspended) {
    if (millis() - suspendStartMillis >= ADVERT_SUSPEND_MS) {
      suspended = false;
      Serial.println("DEBUG: Resume advertising after suspend");
      ensureAdvertise(true);
    } else {
      // still suspended: ensure we are not advertising
      return;
    }
  }

  BLEDevice central = BLE.central();

  if (central) {
    // Central is connected
    if (central.connected()) {
      // if just connected (we can detect authPending false and not authenticated)
      if (!authPending && !authenticated) {
        // start authentication window
        authPending = true;
        authStartMillis = millis();
        Serial.print("✓ Central connected: ");
        Serial.println(central.address());
        Serial.println("DEBUG: Awaiting authentication write for 2s");
      }

      // if auth is pending, check timeout
      if (authPending && (millis() - authStartMillis >= AUTH_TIMEOUT_MS)) {
        Serial.println("!! Authentication timeout - disconnecting and suspending advertising");
        central.disconnect();
        authPending = false;
        authenticated = false;
        suspended = true;
        suspendStartMillis = millis();
        ensureAdvertise(false);
      }
      // if authenticated: nothing to do here, user code will call sendBluetoothCommand()
    } else {
      // Central was present but now disconnected
      if (authenticated || authPending) {
        Serial.println("DEBUG: Central disconnected - clearing auth state and resuming advertising");
      }
      authenticated = false;
      authPending = false;
      // Resume advertising immediately when disconnected (unless suspended)
      if (!suspended) {
        ensureAdvertise(true);
      }
    }
  } else {
    // No central connected; nothing to do
    // Ensure we are advertising unless suspended
    if (!suspended && !isAdvertising) {
      ensureAdvertise(true);
    }
  }

  // Poll BLE stack (recommended)
  BLE.poll();
}

void sendBluetoothCommand(const String &cmd) {
  // Only send if changed and authenticated
  if (!authenticated) {
    return;
  }

  if (cmd != lastCommand) {
    // writeValue with notify characteristic triggers a notification to the connected central
    commandChar.writeValue(cmd.c_str());
    lastCommand = cmd;
    Serial.print("Sent BLE command: ");
    Serial.println(cmd);
  }
}

String receiveBluetoothData() {
  // Check for data on the write data characteristic (feedback from backend)
  if (writeDataChar.written()) {
    const uint8_t *val = writeDataChar.value();
    int len = writeDataChar.valueLength();
    if (val && len > 0) {
      String incoming = String((const char *)val, len);
      incoming.trim();
      Serial.print("Received BLE feedback: '");
      Serial.println(incoming);
      return incoming;
    }
  }
  return "";
}
