import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/warns.json');

function getDB() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (e) {
        return {};
    }
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function pureId(jid) { return jid ? jid.replace(/[^0-9]/g, '') : ''; }

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) {
        return false;
    }
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 SCUDO DI SICUREZZA: Solo i creatori del bot o gli admin del gruppo possono dare i richiami
    let isCmdOwner = isOwner(sender);
    let isCmdAdmin = await isAdmin(conn, jid, sender);

    if (!isCmdOwner && !isCmdAdmin) {
        return await conn.sendMessage(jid, { text: '❌ Azione negata! Devi essere un amministratore per gestire i richiami.' }, { quoted: m });
    }

    // Estrattore bersaglio blindato (risposta o tag)
    let who = false;
    if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid[0];
    }

    if (!who) {
        return await conn.sendMessage(jid, { text: `⚠️ *STRUTTURA RICHIESTI*\n\nTagga o rispondi a un utente!\nEsempio: \`.warn @tag\` o \`.unwarn @tag\`` }, { quoted: m });
    }

    let targetId = pureId(who);
    let targetJid = targetId + '@s.whatsapp.net';

    // Evita che gli admin si richiamino tra di loro o richiamino il creatore
    if (isOwner(targetJid) || await isAdmin(conn, jid, targetJid)) {
        return await conn.sendMessage(jid, { text: '❌ Non puoi sanzionare un amministratore o il proprietario del bot!' }, { quoted: m });
    }

    let db = getDB();
    if (!db[jid]) db[jid] = {};
    if (!db[jid][targetId]) db[jid][targetId] = 0;

    let cmd = (command || '').toLowerCase().trim();

    // 🚀 GESTIONE ASSEGNAZIONE WARN
    if (cmd === 'warn') {
        db[jid][targetId]++;
        let attuali = db[jid][targetId];

        await conn.sendMessage(jid, { react: { text: '⚠️', key: m.key } });

        if (attuali >= 3) {
            // Raggiunti i 3 richiami: azzera il conteggio locale e avvia l'espulsione forzata
            db[jid][targetId] = 0;
            saveDB(db);

            await conn.sendMessage(jid, { text: `🚨 *PROTOCOLLO DI ESPULSIONE ATTIVATO!* 🚨\n\nL'utente @${targetId} ha accumulato *3/3 richiami*.\nProcedo con la cacciata coatta dal gruppo. Ciao! 👋🔨`, mentions: [targetJid] }, { quoted: m });
            
            try {
                // Esegue l'azione nativa di kick (groupParticipantsUpdate)
                return await conn.groupParticipantsUpdate(jid, [targetJid], 'remove');
            } catch (err) {
                return await conn.sendMessage(jid, { text: '❌ Impossibile cacciare l\'utente. Assicurati che il bot sia amministratore del gruppo!' }, { quoted: m });
            }
        } else {
            saveDB(db);
            return await conn.sendMessage(jid, { text: `⚠️ *RICHIAMO UFFICIALE REGISTRATO!* ⚠️\n\n👤 *Utente sanzionato:* @${targetId}\n📊 *Situazione richiami:* [ *${attuali}/3* ]\n\n📌 _Al terzo richiamo verrai espulso automaticamente dalla chat._`, mentions: [targetJid] }, { quoted: m });
        }
    }

    // 🚀 GESTIONE GRAZIA (UNWARN)
    if (cmd === 'unwarn') {
        if (db[jid][targetId] <= 0) {
            return await conn.sendMessage(jid, { text: `😇 L'utente @${targetId} è pulito, ha già *0 richiami* sul tabellino!`, mentions: [targetJid] }, { quoted: m });
        }

        db[jid][targetId]--;
        let attuali = db[jid][targetId];
        saveDB(db);

        await conn.sendMessage(jid, { react: { text: '😇', key: m.key } });
        return await conn.sendMessage(jid, { text: `😇 *GRAZIA CONCESSA!* Richiamo revocato.\n\n👤 *Utente perdonato:* @${targetId}\n📊 *Nuovo totale richiami:* [ *${attuali}/3* ]`, mentions: [targetJid] }, { quoted: m });
    }
};

handler.help = ['warn @tag', 'unwarn @tag'];
handler.tags = ['moderazione'];
handler.command = /^(warn|unwarn|richiamo|grazia)$/i;

export default handler;
