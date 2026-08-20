const fs = require('fs');
const path = require('path');
const activityPath = path.join(__dirname, '../activity.json');

// Funzione per leggere i messaggi salvati
function getActivity() {
    if (!fs.existsSync(activityPath)) {
        fs.writeFileSync(activityPath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(activityPath, 'utf8'));
}

// Funzione per salvare i dati
function saveActivity(data) {
    fs.writeFileSync(activityPath, JSON.stringify(data, null, 2));
}

// Funzione per ripulire il JID e prendere solo il numero da taggare
const getCleanNumber = (jid) => {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
};

module.exports = {
    name: 'top',
    aliases: ['leaderboard', 'top5'],
    category: 'info',
    description: 'Displays the Top 5 most active users in the group',

    // 1. CONTEGGIO DEI MESSAGGI IN BACKGROUND
    async handleMessage(sock, m) {
        if (!m.key.remoteJid || !m.key.participant || m.key.fromMe) return;

        const chatId = m.key.remoteJid;
        if (!chatId.endsWith('@g.us')) return; // Conta solo nei gruppi

        const sender = m.key.participant;
        let db = getActivity();

        // Se il gruppo non esiste nel database, lo crea
        if (!db[chatId]) db[chatId] = {};
        
        // Se l'utente non esiste nel gruppo, lo inizializza a 0
        if (!db[chatId][sender]) db[chatId][sender] = 0;

        // Aumenta di 1 il contatore dei messaggi dell'utente
        db[chatId][sender] += 1;

        saveActivity(db);
    },

    // 2. COMANDO PER MOSTRARE LA TOP 5 ESTETICA
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ This command can only be used in groups.' });
        }

        let db = getActivity();
        
        // Se non ci sono dati per questo gruppo, mostra una lista vuota
        if (!db[chatId] || Object.keys(db[chatId]).length === 0) {
            return sock.sendMessage(chatId, { text: '📊 ─── [ *NO DATA YET* ] ─── 📊\n\nNo messages tracked yet. Keep chatting!' }, { quoted: m });
        }

        // Converte l'oggetto in un array e lo ordina dal più attivo al meno attivo
        const sortedUsers = Object.entries(db[chatId])
            .map(([jid, count]) => ({ jid, count }))
            .sort((a, b) => b.count - a.count);

        // Prende solo i primi 5 della lista
        const top5 = sortedUsers.slice(0, 5);

        let topText = `📊 ─── ❖ *18K ACTIVITY TOP 5* ❖ ─── 📊\n\n`;
        topText += `🏆 *Most active members in this group:*\n\n`;

        const medals = ['👑', '🥈', '🥉', '▫️', '▫️'];
        const mentions = [];

        top5.forEach((user, index) => {
            const cleanNum = getCleanNumber(user.jid);
            topText += `${medals[index]} *#${index + 1}* @${cleanNum} ➜ \`${user.count} messages\`\n`;
            mentions.push(user.jid); // Salva il JID per fare il tag blu
        });

        topText += `\n🌌 ────────────────────── 🌌\n`;
        topText += `✨ *18K by Zeno* ✨`;

        await sock.sendMessage(chatId, { 
            text: topText, 
            mentions: mentions 
        }, { quoted: m });
    }
};

