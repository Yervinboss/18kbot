import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/rpg.json');
const COOLDOWN_MS = 30 * 1000; // 30 secondi
const MILESTONE_LEVELS = [5, 15, 25, 35, 45, 55, 65, 75];

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
        db[userId] = { level: 1, xp: 0, money: 0, lastWork: 0 };
    }
    return db[userId];
}

// XP richiesta per salire dal livello attuale al successivo.
// Curva crescente: ai primi livelli serve poco, ai livelli alti tantissimo.
function xpToNextLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.35));
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatMoney(n) {
    return '€' + n.toLocaleString('it-IT');
}

async function doWork(conn, jid, m, userId) {
    let db = getDB();
    let user = getUser(db, userId);
    let now = Date.now();

    let remaining = COOLDOWN_MS - (now - user.lastWork);
    if (remaining > 0) {
        let secs = Math.ceil(remaining / 1000);
        let buttons = [
            { buttonId: 'work', buttonText: { displayText: '🔄 Lavora ancora' }, type: 1 }
        ];
        return await conn.sendMessage(jid, {
            text: `⏳ Devi aspettare ancora *${secs} secondi* prima di lavorare di nuovo!`,
            footer: 'Zeno Bot - RPG',
            buttons: buttons,
            headerType: 1
        }, { quoted: m });
    }

    let earnedMoney = randomBetween(500, 2000);
    let earnedXp = randomBetween(30, 70);

    user.money += earnedMoney;
    user.xp += earnedXp;
    user.lastWork = now;

    let txt = `💼 *Hai lavorato!*\n`;
    txt += `💰 Guadagnati: ${formatMoney(earnedMoney)}\n`;
    txt += `✨ XP guadagnata: +${earnedXp}\n`;

    // Controlliamo se si sale di livello (anche piu' volte se l'XP guadagnata basta)
    let leveledUp = false;
    let reachedMilestone = null;
    let needed = xpToNextLevel(user.level);

    while (user.xp >= needed) {
        user.xp -= needed;
        user.level += 1;
        leveledUp = true;
        if (MILESTONE_LEVELS.includes(user.level)) {
            reachedMilestone = user.level;
            let bonus = user.level * 100;
            user.money += bonus;
            txt += `\n🏆 *TRAGUARDO LIVELLO ${user.level}!* Bonus speciale: ${formatMoney(bonus)}\n`;
        }
        needed = xpToNextLevel(user.level);
    }

    if (leveledUp && !reachedMilestone) {
        txt += `\n🎉 *Sei salito al livello ${user.level}!*\n`;
    }

    txt += `\n📊 Livello: *${user.level}* | XP: ${user.xp}/${needed} | 💰 ${formatMoney(user.money)}`;

    saveDB(db);

    let buttons = [
        { buttonId: 'work', buttonText: { displayText: '🔄 Lavora ancora' }, type: 1 }
    ];

    return await conn.sendMessage(jid, {
        text: txt,
        footer: 'Zeno Bot - RPG',
        buttons: buttons,
        headerType: 1
    }, { quoted: m });
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    let userId = pureId(m.key.participant || m.key.remoteJid);

    let cmd = (command || '').toLowerCase();
    if (cmd === 'work') {
        return await doWork(conn, jid, m, userId);
    }
};

handler.command = /^work$/i;
handler.help = ['work'];
handler.tags = ['rpg'];

export default handler;

