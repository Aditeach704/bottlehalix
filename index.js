const mineflayer = require('mineflayer');
const { WebSocketServer } = require('ws');

// 1. Initialize WebSocket Server for your HTML Dashboard
const wss = new WebSocketServer({ port: 8080 });
console.log('⚡ WebSocket server active on port 8080');

const clients = new Set();
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ text: "Connected to live Bottle Pixel bot process.", type: "success" }));
    ws.on('close', () => clients.delete(ws));
});

function broadcastLog(message, logType = 'info') {
    console.log(`[${logType.toUpperCase()}] ${message}`);
    const packet = JSON.stringify({ text: message, type: logType });
    for (const client of clients) {
        if (client.readyState === 1) client.send(packet);
    }
}

// 2. Main Bot Configuration
const botOptions = {
    host: 'bottle.hopto.org', 
    port: 19281,                  
    username: 'Bottle_Roamer',  
    version: '1.20.4' // Update if your server uses a different version
};

function startBot() {
    broadcastLog(`Connecting to server node at ${botOptions.host}:${botOptions.port}...`, 'info');
    const bot = mineflayer.createBot(botOptions);

    let movementInterval;
    let obstacleCheckInterval;
    let lastPosition = null;

    bot.on('spawn', () => {
        broadcastLog('Bot successfully spawned into the world!', 'success');
        
        // Start moving forward immediately
        bot.setControlState('forward', true);
        broadcastLog('Active Roaming: Bot initialized walking state.', 'success');

        // Obstacle & Anti-Stuck Detection Loop (Runs every 1.5 seconds)
        obstacleCheckInterval = setInterval(() => {
            if (!bot.entity || !bot.entity.position) return;

            const currentPos = bot.entity.position.clone();

            if (lastPosition) {
                // Calculate distance traveled since last check
                const distance = currentPos.distanceTo(lastPosition);
                
                // If the bot barely moved while trying to run forward, it is stuck
                if (distance < 0.3) {
                    broadcastLog('Obstacle detected! Attempting to jump...', 'warn');
                    
                    // 1. Try to jump over it
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 400);

                    // 2. If still stuck after jumping, spin to a random new angle direction
                    setTimeout(() => {
                        if (bot.entity.position.distanceTo(currentPos) < 0.2) {
                            const randomYaw = (Math.random() * 360) * (Math.PI / 180);
                            bot.look(randomYaw, 0, true);
                            broadcastLog(`Path blocked. Changing heading direction to ${(randomYaw * 180 / Math.PI).toFixed(0)}°`, 'info');
                        }
                    }, 600);
                }
            }
            lastPosition = currentPos;
        }, 1500);

        // Periodic coordinate logging loop to show active life in your dashboard terminal
        movementInterval = setInterval(() => {
            if (bot.entity && bot.entity.position) {
                const { x, y, z } = bot.entity.position;
                broadcastLog(`Current Position Coordinates: X: ${x.toFixed(1)} | Y: ${y.toFixed(1)} | Z: ${z.toFixed(1)}`, 'info');
            }
        }, 8000);
    });

    bot.on('chat', (username, message) => {
        broadcastLog(`<${username}> ${message}`, 'info');
    });

    bot.on('end', () => {
        broadcastLog('Disconnected from server. Cleaning engine states...', 'error');
        clearInterval(movementInterval);
        clearInterval(obstacleCheckInterval);
        lastPosition = null;
        
        broadcastLog('Attempting auto-reconnect routine in 15 seconds...', 'warn');
        setTimeout(startBot, 15000);
    });

    bot.on('error', (err) => {
        broadcastLog(`Network Protocol Error: ${err.message}`, 'error');
    });
}

startBot();