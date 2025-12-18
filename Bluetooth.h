#ifndef BLUETOOTH_H
#define BLUETOOTH_H

#include <ArduinoBLE.h>
#include <Arduino.h>

// UUIDs for BLE service and characteristics
#define CONTROL_SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define COMMAND_CHAR_UUID    "19B10001-E8F2-537E-4F6C-D104768A1214"
#define AUTH_CHAR_UUID       "19B10002-E8F2-537E-4F6C-D104768A1214"
#define WRITE_DATA_CHAR_UUID "19B10003-E8F2-537E-4F6C-D104768A1214"

// Secret password for authentication
#define SECRET_PASSWORD "this-^.^-game-1s-5ecur3-dat3bay0"

// Initialize BLE peripheral
void initBluetooth();

// Poll BLE state — call frequently from loop()
void pollBluetooth();

// Send a command over BLE (only sends if changed and authenticated)
void sendBluetoothCommand(const String &cmd);

// Recieve string over BLE
String receiveBluetoothData();

#endif // BLUETOOTH_H
