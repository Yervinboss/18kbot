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

    let who = false;
    if (m.mentionedJid && m.mentionedJid[0]) {
        who = m.mentionedJid[0];
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid[0]) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    }

    if (!who) {
        return await conn.sendMessage(jid, { 
            text: `❌ Devi taggare qualcuno o rispondere a un suo messaggio per donare i soldi!\nEsempio: \`.dona 100 @tag\`` 
        }, { quoted: m });
    }
    
    let targetId = pureId(who);

    if (senderId === targetId) {
        return await conn.sendMessage(jid, { text: `❌ Non puoi donare i soldi a te stesso!` }, { quoted: m });
    }

    let args = text.trim().split(/\s+/);
    let amount = parseInt(args[0]?.replace(/[^0-9]/g, ''));
    
    if (isNaN(amount) || amount <= 0) {
        return await conn.sendMessage(jid, { 
            text: `❌ Inserisci una quantità valida di soldi da donare!\nEsempio: \`.dona 100 @tag\`` 
        }, { quoted: m });
    }

    let db = getDB();
    let senderUser = getUser(db, senderId);
    let targetUser = getUser(db, targetId);

    if (senderUser.money < amount) {
        return await conn.sendMessage(jid, { 
            text: `❌ Non hai abbastanza soldi! Hai solo *${formatMoney(senderUser.money)}*.` 
        }, { quoted: m });
    }

    // Esegue il trasferimento nel database
    senderUser.money -= amount;
    targetUser.money += amount;
    saveDB(db);

    // Crea il JID pulito per il tag azzurro di WhatsApp
    let targetJid = targetId + '@s.whatsapp.net';

    return await conn.sendMessage(jid, { 
        text: `✅ *Donazione effettuata!*\n\n💰 Importo: *${formatMoney(amount)}*\n👤 Destinatario: @${targetId}`,
        footer: 'Zeno Bot - RPG',
        mentions: [targetJid],
        headerType: 1
    }, { quoted: m });
};

handler.help = ['dona <quantità> @tag'];
handler.tags = ['rpg'];
handler.command = /^(dona|regala)$/i;

export default handler;
