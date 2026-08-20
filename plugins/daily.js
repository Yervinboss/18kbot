const fs = require('fs');
const path = require('path');
const ecoPath = path.join(__dirname, '../economy.json');

function getEconomy() {
    if (!fs.existsSync(ecoPath)) {
        fs.writeFileSync(ecoPath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(ecoPath, 'utf8'));
}

function saveEconomy(data) {
    fs.writeFileSync(ecoPath, JSON.stringify(data, null, 2));
}

module.exports = {
    name: 'daily',
    category: 'economy',
    description: 'Claim your 24h free reward cash and XP',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        let eco = getEconomy();
        
        if (!eco[sender]) {
            eco[sender] = { coins: 500, xp: 0, level: 1, job: 'Disoccupato 🛋️', lastWork: 0, lastDaily: 0 };
        }

        let user = eco[sender];

        // --- GESTIONE TIMER 24 ORE REALE ---
        const now = Date.now();
        const cooldownAmount = 24 * 60 * 60 * 1000; 
        const expirationTime = user.lastDaily + cooldownAmount;

        if (now < expirationTime) {
            const timeLeftMs = expirationTime - now;
            const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
            
            let waitText = `⏳ ─── ❖ *18K REWARD LIMIT* ❖ ─── ⏳\n\n`;
            waitText += `📝 *INFO:* You already claimed your bonus today!\n`;
            waitText += `⏰ *NEXT CLAIM:* In \`${hours}h ${minutes}m\`\n\n`;
            waitText += `✨ *18K by Zeno* ✨`;

            return sock.sendMessage(chatId, { text: waitText }, { quoted: m });
        }
        // ------------------------------------

        const rewardCoins = 1000;
        const rewardXp = 500;

        user.coins += rewardCoins;
        user.xp += rewardXp;
        user.lastDaily = now; 

        // Controllo automatico del Level Up
        let leveledUp = false;
        let xpRequired = user.level * 100;
        if (user.xp >= xpRequired) {
            user.level += 1;
            user.xp -= xpRequired;
            leveledUp = true;
        }

        saveEconomy(eco);

        let successText = `🎁 ─── ❖ *18K DAILY CLAIM* ❖ ─── 🎁\n\n`;
        successText += `💵 *CASH:* \`+${rewardCoins} Coins\`\n`;
        successText += `✨ *EXP:* \`+${rewardXp} XP\`\n`;
        successText += `💰 *TOTAL BALANCE:* \`${user.coins} Coins\`\n`;

        if (leveledUp) {
            successText += `\n🎉 *LEVEL UP!* You advanced to **Level ${user.level}**!\n`;
        }
        
        successText += `\n✨ *18K by Zeno* ✨`;

        await sock.sendMessage(chatId, { text: successText }, { quoted: m });
    }
};

