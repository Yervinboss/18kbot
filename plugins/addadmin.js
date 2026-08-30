import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/rpg.json');

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
        db[userId] = { level: 1, xp: 0, money: 1000, lastWork: 0 };
    }
    return db[userId];
}

function formatMoney(n) {
    return '€' + n.toLocaleString('it-IT');
}

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // 👑 Controllo di sicurezza fisso: SOLO I CREATORI POSSONO USARE QUESTO COMANDO
    if (!isOwner(m.key.participant || m.key.remoteJid)) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando è riservato esclusivamente ai Creatori del bot!' }, { quoted: m });
    }

    // Estrae i parametri (la quantità numerica)
    let args = text.trim().split(/\s+/);
    let amount = parseInt(args[0]?.replace(/[^0-9-]/g, '')); // Supporta anche numeri negativi se vuoi togliere soldi

    if (isNaN(amount)) {
        return await conn.sendMessage(jid, { 
            text: `❌ *Uso corretto del comando:*\n• \`.addmoney 5000 @tag\` (Aggiunge soldi)\n• \`.addxp 1000\` (Aggiunge XP a te stesso)\n• \`.addlevel 5\` (Aggiunge livelli)` 
        }, { quoted: m });
    }

    // Identifica il bersaglio (se rispondi, tagghi o te stesso)
    let who = false;
    if (m.mentionedJid && m.mentionedJid[0]) {
        who = m.mentionedJid[0];
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid[0]) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    }

    let db = getDB();
    let targetId = who ? pureId(who) : senderId; // Se nessuno è taggato, prende il mittente (te stesso)
    let user = getUser(db, targetId);

    let cmd = command.toLowerCase();
    let targetJid = targetId + '@s.whatsapp.net';
    let msgText = '';

    // ⏳ Mette la clessidra veloce
    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    if (cmd === 'addmoney' || cmd === 'addcash') {
        user.money += amount;
        msgText = `💰 *MODIFICA BILANCIO!*\n\n👤 Utente: @${targetId}\n➕ Variazione: *${amount > 0 ? '+' : ''}${formatMoney(amount)}*\n💳 Nuovo Saldo: *${formatMoney(user.money)}*`;
    }

    if (cmd === 'addxp') {
        user.xp += amount;
        msgText = `✨ *MODIFICA ESPERIENZA!*\n\n👤 Utente: @${targetId}\n➕ Variazione: *${amount > 0 ? '+' : ''}${amount} XP*\n📊 Nuova XP: *${user.xp}*`;
    }

    if (cmd === 'addlevel' || cmd === 'addlivello') {
        user.level += amount;
        if (user.level < 1) user.level = 1; // Impedisce livelli sotto al 1
        msgText = `📊 *MODIFICA LIVELLO!*\n\n👤 Utente: @${targetId}\n➕ Variazione: *${amount > 0 ? '+' : ''}${amount} Livelli*\n👑 Nuovo Livello: *${user.level}*`;
    }

    saveDB(db);

    // 2. REAZIONE FINALE: Spunta verde ed invio della conferma con il tag
    await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });
    
    return await conn.sendMessage(jid, { 
        text: msgText,
        mentions: [targetJid]
    }, { quoted: m });
};

handler.help = ['addmoney', 'addxp', 'addlevel'];
handler.tags = ['owner'];
handler.command = /^(addmoney|addcash|addxp|addlevel|addlivello)$/i;

export default handler;
