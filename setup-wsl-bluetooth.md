# Setup Bluetooth Access for Docker on Windows

Docker on Windows runs in WSL2, which doesn't have direct Bluetooth access. Follow these steps:

## Prerequisites
- Windows 10/11 with WSL2
- Docker Desktop for Windows
- Bluetooth adapter on your PC

## Step 1: Enable Bluetooth in WSL2

### Option A: Use usbipd-win (Recommended)

1. **Install usbipd-win on Windows:**
   ```powershell
   winget install --interactive --exact dorssel.usbipd-win
   ```

2. **In PowerShell (as Administrator), list USB devices:**
   ```powershell
   usbipd list
   ```

3. **Find your Bluetooth adapter** (look for "Bluetooth" in the description)
   Note the BUSID (e.g., 1-4)

4. **Bind and attach the Bluetooth device:**
   ```powershell
   usbipd bind --busid <BUSID>
   usbipd attach --wsl --busid <BUSID>
   ```

5. **Verify in WSL2:**
   ```bash
   wsl
   lsusb
   # You should see your Bluetooth adapter
   ```

### Option B: Use systemd in WSL2 (Alternative)

1. **Enable systemd in WSL2:**
   Edit `/etc/wsl.conf` in WSL2:
   ```bash
   wsl
   sudo nano /etc/wsl.conf
   ```
   
   Add:
   ```ini
   [boot]
   systemd=true
   ```

2. **Restart WSL2:**
   ```powershell
   wsl --shutdown
   wsl
   ```

3. **Install Bluetooth packages in WSL2:**
   ```bash
   sudo apt update
   sudo apt install bluetooth bluez bluez-tools
   sudo systemctl enable bluetooth
   sudo systemctl start bluetooth
   ```

## Step 2: Run Docker with Bluetooth Access

The docker-compose.yml has been configured with:
- `privileged: true` - gives container access to host devices
- `network_mode: host` - shares host network stack
- Device mappings for USB/Bluetooth

## Step 3: Start Your Stack

```powershell
cd C:\Users\zbcrvsa\Desktop\OLDPC\WalkMan\Docker
docker-compose up --build
```

## Troubleshooting

### If Bluetooth doesn't work:

1. **Check if WSL2 sees Bluetooth:**
   ```bash
   wsl
   lsusb | grep -i bluetooth
   hciconfig
   ```

2. **Reset WSL2 network:**
   ```powershell
   wsl --shutdown
   ```

3. **Check Docker logs:**
   ```powershell
   docker logs docker-backend-1
   ```

### Common Issues:

- **"EAFNOSUPPORT" error**: WSL2 doesn't have Bluetooth access
- **Permission denied**: Run Docker as admin or add user to `bluetooth` group in WSL2
- **Device not found**: Re-attach USB device with `usbipd attach`

## Alternative: Run Backend Natively

If Docker Bluetooth is too complex, run backend directly on Windows:

```powershell
cd C:\Users\zbcrvsa\Desktop\OLDPC\WalkMan\Backend
npm install
node server.js
```

And only run frontend in Docker, or use the serial/USB approach instead of BLE.
