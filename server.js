const express = require('express');
const path = require('path');
const Kahoot = require("kahoot.js-latest");

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let isFlooding = false;
let activeBots = [];
let botStats = {
    total: 0,
    joined: 0,
    failed: 0,
    answersSubmitted: 0,
    status: 'idle'
};

app.get('/', (req, res) => {
    res.send('Kahoot Flooder Backend is running');
});

app.post('/start', (req, res) => {
    const { pin, baseName, amount } = req.body;
    
    if (isFlooding) {
        return res.json({ error: 'Flood already in progress' });
    }
    
    if (!pin || !amount) {
        return res.json({ error: 'PIN and amount required' });
    }
    
    const botCount = parseInt(amount);
    if (botCount < 1 || botCount > 500) {
        return res.json({ error: 'Amount must be 1-500' });
    }
    
    isFlooding = true;
    botStats = {
        total: botCount,
        joined: 0,
        failed: 0,
        answersSubmitted: 0,
        status: 'flooding'
    };
    activeBots = [];
    
    res.json({ success: true });
    
    runFlood(pin, baseName || 'user', botCount);
});

app.post('/stop', (req, res) => {
    isFlooding = false;
    
    activeBots.forEach(bot => {
        try {
            bot.leave();
        } catch (e) {}
    });
    
    activeBots = [];
    botStats.status = 'stopped';
    
    res.json({ success: true });
});

app.get('/stats', (req, res) => {
    res.json({
        isFlooding,
        stats: botStats,
        activeBots: activeBots.length
    });
});

function runFlood(pin, baseName, amount) {
    console.log(`Starting ${amount} bots on PIN ${pin}...`);
    
    for (let i = 1; i <= amount; i++) {
        if (!isFlooding) break;
        
        const name = `${baseName} (${i})`;
        const client = new Kahoot();
        
        client.on("Joined", () => {
            console.log(`[+] ${name} joined`);
            botStats.joined++;
        });
        
        client.on("Disconnect", (reason) => {
            console.log(`[-] ${name} left: ${reason}`);
        });
        
        client.on("QuestionStart", (question) => {
            const choice = Math.floor(Math.random() * question.numberOfChoices);
            question.answer(choice);
            botStats.answersSubmitted++;
        });
        
        try {
            activeBots.push(client);
            client.join(pin, name);
        } catch (err) {
            console.log(`[!] ${name} failed: ${err.message || err}`);
            botStats.failed++;
        }
    }
    
    console.log('All bots launched.');
}

app.listen(PORT, () => {
    console.log(`Kahoot Flooder running on port ${PORT}`);
});