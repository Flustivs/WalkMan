#include <Arduino.h>
#include "Bluetooth.h"
#include <Wire.h> 
#include <LiquidCrystal_I2C.h>

// Setup the LCD Display
LiquidCrystal_I2C lcd(0x27, 20, 4);

// Pins setup
const int upTrig = 2, upEcho = 3;
const int leftTrig = 4, leftEcho = 5;
const int rightTrig = 6, rightEcho = 7;
const int btnRefresh = 8;

volatile unsigned long lastInterruptTime = 0;
volatile bool buttonWasPressed = false;

// Sensor read timing
const int sensorReadingDelay = 200;
unsigned long lastSensorRead = 0;

// Thresholds in cm
const long fastDistanceThreshold = 5;
const long cappedDistance = 15;

// Gold counter
int gold = 0;
bool firstClick = false;

void setup() {
    Serial.begin(9600);

    // Initialize the LCD
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("Press yellow");
    lcd.setCursor(0, 1);
    lcd.print("button to start");

    // Sensor pins
    pinMode(upTrig, OUTPUT); pinMode(upEcho, INPUT);
    pinMode(leftTrig, OUTPUT); pinMode(leftEcho, INPUT);
    pinMode(rightTrig, OUTPUT); pinMode(rightEcho, INPUT);

    // Button interrupt
    pinMode(btnRefresh, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(btnRefresh), buttonISR, FALLING);

    // Initialize BLE
    initBluetooth();
}

void loop() {
    unsigned long now = millis();

    // Handle button press
    if (buttonWasPressed) {
        buttonWasPressed = false;

        if (!firstClick) {
            lcd.clear();
            firstClick = true;
            gold = 0;
            lcd.setCursor(0, 0);
            lcd.print("Gold: 0");
        } else {
            gold++;
            lcd.setCursor(7, 0); // after "Gold: "
            lcd.print(gold);
        }

        Serial.println("Button pressed! Gold updated.");
    }

    // Sensor reading
    if (now - lastSensorRead >= sensorReadingDelay) {
        lastSensorRead = now;

        long upDistance = readDistance(upTrig, upEcho);
        long leftDistance = readDistance(leftTrig, leftEcho);
        long rightDistance = readDistance(rightTrig, rightEcho);

        // BLE commands
        if (upDistance >= cappedDistance && leftDistance >= cappedDistance && rightDistance >= cappedDistance) {
            sendBluetoothCommand("STOP");
        } else if (upDistance < leftDistance && upDistance < rightDistance) {
            sendBluetoothCommand(upDistance <= fastDistanceThreshold ? "HIGH_JUMP" : "JUMP");
        } else if (leftDistance < upDistance && leftDistance < rightDistance) {
            sendBluetoothCommand(leftDistance <= fastDistanceThreshold ? "FAST_LEFT" : "LEFT");
        } else if (rightDistance < upDistance && rightDistance < leftDistance) {
            sendBluetoothCommand(rightDistance <= fastDistanceThreshold ? "FAST_RIGHT" : "RIGHT");
        } else {
            sendBluetoothCommand("STOP");
        }

        // Debug print
        Serial.print("Up: "); Serial.print(upDistance); Serial.print(" cm  ");
        Serial.print("Left: "); Serial.print(leftDistance); Serial.print(" cm  ");
        Serial.print("Right: "); Serial.print(rightDistance); Serial.println(" cm ");
    }

    // Check for received data (not used currently)
    String received = receiveBluetoothData();
    if (received == "COIN_ADDED") {
        gold++;
        lcd.setCursor(7, 0);
        lcd.print(gold);
        Serial.println("Coin added via BLE! Gold updated.");
    } else if (received.length() > 0) {
        Serial.println("Received unknown BLE data: " + received);
    }

    // BLE polling
    pollBluetooth();
}

// ISR - only sets a flag, does NOT call LCD functions
void buttonISR() {
    unsigned long now = millis();
    if (now - lastInterruptTime > 200) { // debounce
        buttonWasPressed = true;
        lastInterruptTime = now;
    }
}

// Measure distance
long readDistance(int trigPin, int echoPin) {
    digitalWrite(trigPin, LOW); delayMicroseconds(2);
    digitalWrite(trigPin, HIGH); delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    long duration = pulseIn(echoPin, HIGH);
    long distance = duration * 0.034 / 2;
    return (distance > cappedDistance) ? cappedDistance : distance;
}
