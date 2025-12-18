const block = document.getElementById('block');
const gameArea = document.getElementById('game-area');
const coinsDisplay = document.getElementById('coinsCollected');

// Create ground
const ground = document.createElement('div');
ground.className = 'ground';
gameArea.appendChild(ground);

// Game state
let blockX = 100;
let blockY = 0;
let isJumping = false;
let jumpVelocity = 0;
let gravity = 1.2;
const groundLevel = 0;

// Movement
let currentDirection = 'STOP';
let playerVelocityX = 0;
const maxPlayerX = window.innerWidth * 0.8; // Max X position for player in procentage of screen width

// Game stats
let coinsCollected = 0;
let coins = [];
let clouds = [];
let groundPatterns = [];
let gameTime = 0;
let scrollSpeed = 5;

// Initialize clouds
function initClouds() {
    for (let i = 0; i < 8; i++) {
        createCloud(Math.random() * window.innerWidth, Math.random() * (window.innerHeight * 0.6));
    }
}

function createCloud(x, y) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    
    const size = 60 + Math.random() * 40;
    cloud.style.width = size + 'px';
    cloud.style.height = size * 0.6 + 'px';
    cloud.style.left = x + 'px';
    cloud.style.top = y + 'px';
    
    gameArea.appendChild(cloud);
    clouds.push({ element: cloud, x: x, y: y, speed: 0.3 + Math.random() * 0.3 });
}

// Initialize ground patterns
function initGroundPatterns() {
    for (let i = 0; i < 30; i++) {
        createGroundPattern(i * 80);
    }
}

function createGroundPattern(x) {
    const pattern = document.createElement('div');
    pattern.className = 'ground-pattern';
    pattern.style.left = x + 'px';
    gameArea.appendChild(pattern);
    groundPatterns.push({ element: pattern, x: x });
}

initClouds();
initGroundPatterns();

// Game loop for physics and coin spawning
let gameLoopInterval = setInterval(gameLoop, 30);

function gameLoop() {
    gameTime++;
    
    // Physics - gravity and jumping
    jumpVelocity += gravity;
    blockY -= jumpVelocity;
    
    if (blockY <= groundLevel) {
        blockY = groundLevel;
        jumpVelocity = 0;
        isJumping = false;
    }
    
    // Move player horizontally but cap at maxPlayerX
    if (playerVelocityX > 0) {
        blockX += playerVelocityX;
        if (blockX > maxPlayerX) {
            blockX = maxPlayerX;
        }
    } else if (playerVelocityX < 0) {
        blockX += playerVelocityX;
        if (blockX < 50) {
            blockX = 50;
        }
    }
    
    // Update block position
    block.style.left = blockX + 'px';
    block.style.bottom = (60 + blockY) + 'px';
    
    // Spawn coins regularly at different heights
    if (gameTime % 50 === 0) {
        spawnCoin();
    }
    
    // Scroll coins from right to left
    scrollCoins();
    
    // Scroll background when player moves right
    scrollClouds();
    scrollGroundPatterns();
}

function spawnCoin() {
    const coin = document.createElement('div');
    coin.className = 'coin';
    
    // Spawn on right side
    const spawnX = window.innerWidth + 50;
    
    // Random heights: ground, low jump, medium jump, high jump
    const heights = [0, 80, 150, 250];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];
    
    coin.style.left = spawnX + 'px';
    coin.style.bottom = (60 + randomHeight) + 'px';
    gameArea.appendChild(coin);
    
    coins.push({
        element: coin,
        x: spawnX,
        y: randomHeight
    });
}

function scrollCoins() {
    coins.forEach((coin, index) => {
        // Move coin to the left
        coin.x -= scrollSpeed;
        
        // Update position
        coin.element.style.left = coin.x + 'px';
        
        // Check collision with player
        if (checkCollision(blockX, blockY, coin.x, coin.y)) {
            coin.element.remove();
            coins.splice(index, 1);
            coinsCollected++;
            handleCoinAdd();
            coinsDisplay.textContent = `Coins: ${coinsCollected}`;
        }
        
        // Remove coin if off-screen left
        if (coin.x < -50) {
            coin.element.remove();
            coins.splice(index, 1);
        }
    });
}

function scrollClouds() {
    // Base scroll speed when standing still
    const baseSpeed = 1.5;
    // Additional speed when moving
    const movementBonus = playerVelocityX > 0 ? playerVelocityX * 0.8 : 0;
    
    clouds.forEach(cloud => {
        cloud.x -= (baseSpeed + movementBonus) * cloud.speed;
        
        // Wrap clouds around
        if (cloud.x < -200) {
            cloud.x = window.innerWidth + 100;
        }
        
        cloud.element.style.left = cloud.x + 'px';
    });
}

function scrollGroundPatterns() {
    // Only scroll ground when player is at the max position (endless runner mode)
    if (blockX >= maxPlayerX) {
        const baseSpeed = 1.5;
        const movementBonus = playerVelocityX > 0 ? playerVelocityX : 0;
        
        groundPatterns.forEach((pattern, index) => {
            pattern.x -= (baseSpeed + movementBonus);
            
            // Wrap patterns around
            if (pattern.x < -100) {
                pattern.x = window.innerWidth + 50;
            }
            
            pattern.element.style.left = pattern.x + 'px';
        });
    }
}

function checkCollision(playerX, playerY, coinX, coinY) {
    const dx = Math.abs(playerX - coinX);
    const dy = Math.abs(playerY - coinY);
    return dx < 35 && dy < 35;
}

// Connect to backend WebSocket
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
    console.log('WebSocket connected to backend');
};

ws.onmessage = (event) => {
    const cmd = event.data.trim();
    console.log('Command:', cmd);
    handleCommand(cmd);
};

ws.onerror = (err) => {
    console.error('WebSocket error:', err);
};

function handleCoinAdd() {
    // Send coin collection event to backend
    if (ws.readyState === WebSocket.OPEN) {
        ws.send('COIN_ADDED');
        console.log('Sent COIN_ADDED to backend');
    }
}

function handleCommand(cmd) {
    switch(cmd) {
        case "JUMP":
            jump(18);
            break;
        case "HIGH_JUMP":
            jump(25);
            break;
        case "LEFT":
            playerVelocityX = -4;
            break;
        case "RIGHT":
            playerVelocityX = 6;
            break;
        case "FAST_LEFT":
            playerVelocityX = -8;
            break;
        case "FAST_RIGHT":
            playerVelocityX = 10;
            break;
        case "STOP":
            playerVelocityX = 0;
            break;
    }
}

function jump(strength) {
    if (!isJumping && blockY === groundLevel) {
        isJumping = true;
        jumpVelocity = -strength;
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    if (blockX > maxPlayerX) blockX = maxPlayerX;
});
