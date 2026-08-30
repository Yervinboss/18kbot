import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/rpg.json');
const COOLDOWN_MS = 45 * 1000; // 45 secondi di attesa

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
        db[userId] = { level: 1, xp: 0, money: 1000, lastWork: 0, lastRob: 0 };
    }
    // Se la proprietà lastRob non esiste nei vecchi utenti, la inizializza a 0
    if (db[userId].lastRob === undefined) db[userId].lastRob = 0;
    return db[userId];
}

function formatMoney(n) {
    return '€' + n.toLocaleString('it-IT');
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);
    let isGroup = jid.endsWith('@g.us');

    if (!isGroup) {
        return await conn.sendMessage(jid, { 
            text: '❌ Puoi usare il comando ruba solo all\'interno di un gruppo!' 
        }, { quoted: m });
    }

    let db = getDB();
    let senderUser = getUser(db, senderId);
    let now = Date.now();

    // ⏳ CONTROLLO DEL COOLDOWN (45 SECONDI)
    let remaining = COOLDOWN_MS - (now - senderUser.lastRob);
    if (remaining > 0) {
        let secs = Math.ceil(remaining / 1000);
        return await conn.sendMessage(jid, {
            text: `⏳ *Sei ricercato dalla polizia!* Devi nasconderti ancora per *${secs} secondi* prima di tentare un altro furto!`,
            footer: 'Zeno Bot - RPG',
            headerType: 1
        }, { quoted: m });
    }

    // Identifica se l'utente ha taggato o citato qualcuno manualmente
    let who = false;
    if (m.mentionedJid && m.mentionedJid) {
        who = m.mentionedJid;
    } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid) {
        who = m.message.extendedTextMessage.contextInfo.mentionedJid;
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    }

    // Forzatura recupero membri del gruppo reale da WhatsApp
    let groupMetadata = await conn.groupMetadata(jid).catch(() => null);
    if (!groupMetadata) {
        return await conn.sendMessage(jid, { text: '❌ Errore nel recupero delle info del gruppo!' }, { quoted: m });
    }
    let participantsList = groupMetadata.participants || [];

    // Se l'utente non ha taggato nessuno, pesca un membro a caso dal gruppo corrente
    if (!who) {
        let botJid = conn.user.id.split(':') + '@s.whatsapp.net';
        let currentSenderJid = senderId + '@s.whatsapp.net';

        let validParticipants = participantsList
            .map(p => p.id)
            .filter(id => id !== currentSenderJid && id !== botJid);

        if (validParticipants.length === 0) {
            return await conn.sendMessage(jid, { 
                text: '❌ Non c\'è nessun altro membro disponibile da derubare in questo gruppo!',
                footer: 'Zeno Bot - RPG',
                headerType: 1
            }, { quoted: m });
        }

        who = validParticipants[Math.floor(Math.random() * validParticipants.length)];
    }
    
    let targetId = pureId(who);

    if (senderId === targetId) {
        return await conn.sendMessage(jid, { text: `❌ Vuoi rubare a te stesso? Che senso ha?` }, { quoted: m });
    }

    let targetUser = getUser(db, targetId);
    let targetMoney = targetUser.money;

    if (targetMoney <= 0) {
        let targetJid = targetId + '@s.whatsapp.net';
        return await conn.sendMessage(jid, { 
            text: `❌ @${targetId} è completamente al verde, non ha un singolo centesimo da farsi rubare!`, 
            footer: 'Zeno Bot - RPG',
            mentions: [targetJid],
            headerType: 1
        }, { quoted: m });
    }

    // Imposta il cooldown istantaneamente all'inizio dell'azione per evitare spunti di spam
    senderUser.lastRob = now;

    // Logica di vincita: 35% di successo
    let chance = Math.floor(Math.random() * 100) + 1;
    let targetJid = targetId + '@s.whatsapp.net';

    if (chance > 35) {
        saveDB(db); // Salva il cooldown anche in caso di fallimento
        return await conn.sendMessage(jid, {
            text: `👮‍♂️ *Furto fallito!* Scatta l'allarme e @${targetId} si sveglia in tempo. Sei dovuto scappare a mani vuote!`,
            footer: 'Zeno Bot - RPG',
            mentions: [targetJid],
            headerType: 1
        }, { quoted: m });
    }

    // Bottino del 30% degli averi della vittima
    let stolenAmount = Math.floor(targetMoney * 0.30);
    if (stolenAmount <= 0) stolenAmount = 1;

    // Aggiorna i dati nel database
    targetUser.money -= stolenAmount;
    senderUser.money += stolenAmount;
    saveDB(db);

    return await conn.sendMessage(jid, { 
        text: `🥷 *Colpo gobbo andato a segno (35% di chance)!*\nSei riuscito a borseggiare @${targetId} di nascosto.\n\n💰 Bottino intascato (30% degli averi): *+${formatMoney(stolenAmount)}*`, 
        footer: 'Zeno Bot - RPG',
        mentions: [targetJid],
        headerType: 1
    }, { quoted: m });
};

handler.help = ['ruba'];
handler.tags = ['rpg'];
handler.command = /^(ruba|steal)$/i;

export default handler;
