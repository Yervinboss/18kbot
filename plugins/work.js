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
    name: 'work',
    aliases: ['lavora'],
    category: 'economy',
    description: 'Lavora per fare soldi e salire di livello con timeout su database',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        let eco = getEconomy();
        
        // Inizializza l'utente se non esiste, includendo il campo lastWork impostato a 0
        if (!eco[sender]) {
            eco[sender] = { coins: 500, xp: 0, level: 1, job: 'Disoccupato 🛋️', lastWork: 0 };
        }

        let user = eco[sender];

        // Se l'utente non ha la proprietà lastWork (perché creata con il vecchio codice), la inizializziamo
        if (!user.lastWork) {
            user.lastWork = 0;
        }

        // --- GESTIONE COUNTDOWN CON PERSISTENZA SU JSON ---
        const now = Date.now();
        const cooldownAmount = 30 * 1000; // 30 secondi in millisecondi
        const expirationTime = user.lastWork + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = Math.ceil((expirationTime - now) / 1000);
            return sock.sendMessage(chatId, { 
                text: `⏳ Sei troppo stanco per lavorare! Attendi altri **${timeLeft} secondi** prima di faticare ancora.` 
            }, { quoted: m });
        }
        // --------------------------------------------------

        // Se il tempo è passato, aggiorna subito l'orario dell'ultimo lavoro nel database
        user.lastWork = now;

        // Guadagni base molto più alti sin dall'inizio
        const baseCoins = Math.floor(Math.random() * 150) + 100;
        const earnedCoins = baseCoins * user.level;
        const earnedXp = Math.floor(Math.random() * 40) + 20;

        user.coins += earnedCoins;
        user.xp += earnedXp;

        let leveledUp = false;
        let xpRequired = user.level * 100;
        if (user.xp >= xpRequired) {
            user.level += 1;
            user.xp -= xpRequired;
            leveledUp = true;

            if (user.level === 5) user.job = 'Fattorino di consegne 🛵';
            else if (user.level === 25) user.job = 'Cameriere alcolizzato 🍺';
            else if (user.level === 35) user.job = 'Impiegato statale annoiato 🗂️';
            else if (user.level === 45) user.job = 'Programmatore Junior in Termux 💻';
            else if (user.level === 55) user.job = 'Imprenditore di cripto fallite 📈';
            else if (user.level === 65) user.job = 'Boss della malavita locale 🕶️';
            else if (user.level === 75) user.job = 'Leggendario Creatore di Bot 🤖🔥';
        }

        saveEconomy(eco);

        let text = `💼 Hai lavorato sodo come *${user.job}*!\n\n` +
                   `💵 Guadagno: +${earnedCoins} soldi\n` +
                   `✨ Esperienza: +${earnedXp} XP`;

        if (leveledUp) {
            text += `\n\n🎉 **LEVEL UP! Sei passato al livello ${user.level}!** Nuovo lavoro sbloccato: *${user.job}*!`;
        }

        await sock.sendMessage(chatId, { text: text }, { quoted: m });
    }
};

