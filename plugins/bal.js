import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/rpg.json');

function getDB() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

function getUser(db, userId) {
    if (!db[userId]) {
        db[userId] = { level: 1, xp: 0, money: 1000, lastWork: 0 };
    }
    return db[userId];
}

function formatMoney(n) {
    return '€' + n.toLocaleString('it-IT');
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // Rileva se hai taggato qualcuno o risposto, altrimenti prende te
    let who = m.mentionedJid && m.mentionedJid.length > 0 ? m.mentionedJid[0] : 
              (m.quoted && m.quoted.sender ? m.quoted.sender : (m.key.participant || m.key.remoteJid));
              
    let targetId = pureId(who);
    let targetJid = targetId + '@s.whatsapp.net';

    let db = getDB();
    let user = getUser(db, targetId);

    // ⏳ Reazione di caricamento veloce
    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    // Testo del bilancio RPG ottimizzato in formato testuale puro (100% Anti-Bug iOS)
    let bodyText = `╭━━━〔 💳 *PORTAFOGLIO ZENO RPG* 〕━━━⬣\n` +
                   `┃\n` +
                   `┃ 👤 *Utente:* @${targetId}\n` +
                   `┃ 💰 *Contanti:* *${formatMoney(user.money)}*\n` +
                   `┃ 📊 *Livello:* *${user.level}* _(XP: ${user.xp})_\n` +
                   `┃\n` +
                   `╰━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                   `⚡ _Zeno Bot Economy System_`;

    // Toglie la clessidra e mette il check verde di successo
    await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });

    // Invio nativo in testo semplice citando l'utente (Funziona ovunque!)
    return await conn.sendMessage(jid, { 
        text: bodyText, 
        mentions: [targetJid] 
    }, { quoted: m });
};

handler.help = ['bal', 'portafoglio'];
handler.tags = ['rpg'];
handler.command = /^(bal|balance|portafoglio|soldi)$/i;

export default handler;
