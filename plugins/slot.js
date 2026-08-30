import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/rpg.json');

// Scrittura blindata anti-bug per Termux
const SYMBOLS = '🍒,🍋,🍊,🍇,⭐,💎,7️⃣'.split(',');
const BET_AMOUNTS = '100,1000,10000'.split(',').map(Number);

function getDB() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

function getUser(db, userId) {
    if (!db[userId]) {
        db[userId] = { level: 1, xp: 0, money: 5000, lastWork: 0 }; // Partono con 5000€ per poter testare le scommesse alte!
    }
    return db[userId];
}

function formatMoney(n) {
    return '€' + n.toLocaleString('it-IT');
}

function spin() {
    // Generazione rulli blindata senza parentesi vuote
    let res = '0,0,0'.split(',');
    return res.map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

async function askBetAmount(conn, jid, m) {
    let buttons = BET_AMOUNTS.map(amount => ({
        buttonId: `slotbet_${amount}`,
        buttonText: { displayText: formatMoney(amount) },
        type: 1
    }));

    let buttonMessage = {
        text: '🎰 Scegli quanto vuoi puntare:',
        footer: 'Zeno Bot - Slot Machine',
        buttons: buttons,
        headerType: 1
    };

    return await conn.sendMessage(jid, buttonMessage, { quoted: m });
}

async function playSlot(conn, jid, m, userId, betAmount) {
    let db = getDB();
    let user = getUser(db, userId);

    if (user.money < betAmount) {
        return await conn.sendMessage(jid, {
            text: `❌ Non hai abbastanza soldi! Hai ${formatMoney(user.money)}, ti servono ${formatMoney(betAmount)}.`
        }, { quoted: m });
    }

    let result = spin();
    let display = result.join(' | ');
    let winnings = 0;

    if (result[0] === result[1] && result[1] === result[2]) {
        winnings = result[0] === '7️⃣' ? betAmount * 10 : betAmount * 5;
    } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        winnings = Math.floor(betAmount * 1.5);
    }

    let txt = `🎰 [ ${display} ]\n\n`;

    if (winnings > 0) {
        user.money += (winnings - betAmount);
        txt += `🎉 *HAI VINTO ${formatMoney(winnings)}!*\n`;
    } else {
        user.money -= betAmount;
        txt += `💔 Hai perso ${formatMoney(betAmount)}.\n`;
    }

    txt += `\n💰 Saldo attuale: ${formatMoney(user.money)}`;

    saveDB(db);

    return await conn.sendMessage(jid, { text: txt }, { quoted: m });
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    let userId = pureId(m.key.participant || m.key.remoteJid);

    let cmd = (command || '').toLowerCase();

    if (cmd.startsWith('slotbet_')) {
        let betAmount = parseInt(cmd.replace('slotbet_', ''), 10);
        return await playSlot(conn, jid, m, userId, betAmount);
    }

    if (cmd === 'slot') {
        return await askBetAmount(conn, jid, m);
    }
};

handler.command = /^(slot|slotbet_\d+)$/i;
handler.help = ['slot'];
handler.tags = ['rpg'];

export default handler;
