import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/rpg.json');
const COOLDOWN_DAILY = 24 * 60 * 60 * 1000; // 24 ore in millisecondi

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
        db[userId] = { level: 1, xp: 0, money: 0, lastWork: 0, lastDaily: 0 };
    }
    // Aggiungiamo il campo lastDaily se non esiste nei vecchi utenti
    if (db[userId].lastDaily === undefined) {
        db[userId].lastDaily = 0;
    }
    return db[userId];
}

// Curva XP (uguale a quella del work per gestire eventuali level up con l'XP della daily)
function xpToNextLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.35));
}

function formatMoney(n) {
    return '€' + n.toLocaleString('it-IT');
}

// Funzione per formattare il tempo rimanente in Ore, Minuti e Secondi
function formatTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    let minutes = Math.floor(seconds / 60);
    seconds %= 60;

    let parts = [];
    if (hours > 0) parts.push(`*${hours}h*`);
    if (minutes > 0) parts.push(`*${minutes}m*`);
    parts.push(`*${seconds}s*`);
    return parts.join(' ');
}

async function doDaily(conn, jid, m, userId) {
    let db = getDB();
    let user = getUser(db, userId);
    let now = Date.now();

    let remaining = COOLDOWN_DAILY - (now - user.lastDaily);
    if (remaining > 0) {
        let timeLeft = formatTime(remaining);
        return await conn.sendMessage(jid, {
            text: `⏰ Hai già riscosso la tua ricompensa giornaliera!\nTorna tra ${timeLeft} per riscattarla di nuovo.`,
        }, { quoted: m });
    }

    let dailyMoney = 3000;
    let dailyXp = 1500;

    user.money += dailyMoney;
    user.xp += dailyXp;
    user.lastDaily = now;

    let txt = `🎁 *Ricompensa Giornaliera Riscossa!*\n\n`;
    txt += `💰 Soldi: +${formatMoney(dailyMoney)}\n`;
    txt += `✨ XP: +${dailyXp}\n`;

    // Controllo level up con l'XP della daily
    let leveledUp = false;
    let needed = xpToNextLevel(user.level);

    while (user.xp >= needed) {
        user.xp -= needed;
        user.level += 1;
        leveledUp = true;
        needed = xpToNextLevel(user.level);
    }

    if (leveledUp) {
        txt += `\n🎉 *Complimenti! Sei salito al livello ${user.level}!*\n`;
    }

    txt += `\n📊 Livello: *${user.level}* | XP: ${user.xp}/${needed} | 💰 ${formatMoney(user.money)}`;

    saveDB(db);

    return await conn.sendMessage(jid, {
        text: txt,
    }, { quoted: m });
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    let userId = pureId(m.key.participant || m.key.remoteJid);

    let cmd = (command || '').toLowerCase();
    if (cmd === 'daily') {
        return await doDaily(conn, jid, m, userId);
    }
};

handler.command = /^daily$/i;
handler.help = ['daily'];
handler.tags = ['rpg'];

export default handler;
