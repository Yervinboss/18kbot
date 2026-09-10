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

let handler = async (m, { conn, command, text }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 Solo i creatori del bot o gli admin del gruppo possono dare i richiami
    let isCmdOwner = isOwner(sender);
    let isCmdAdmin = await isAdmin(conn, jid, sender);

    if (!isCmdOwner && !isCmdAdmin) {
        return await conn.sendMessage(jid, { text: '❌ Azione negata! Devi essere un amministratore per gestire i richiami.' }, { quoted: m });
    }

    // Estrattore bersaglio (risposta O tag)
    let who = null;
    
    if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid[0];
    } else if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    } else if (text) {
        const phoneMatch = text.match(/(?:0|\+?39)?\s?(\d{3})\s?(\d{3})\s?(\d{3,4})/);
        if (phoneMatch) {
            const phone = phoneMatch[1] + phoneMatch[2] + phoneMatch[3];
            who = phone + '@s.whatsapp.net';
        }
    }

    if (!who) {
        return await conn.sendMessage(jid, { 
            text: `⚠️ *STRUTTURA RICHIESTI*\n\nTagga o rispondi a un utente!\nEsempio: \`.warn @tag\` o \`.unwarn @tag\`\nOppure rispondi al messaggio dell'utente con .warn` 
        }, { quoted: m });
    }

    let targetId = pureId(who);
    let targetJid = targetId + '@s.whatsapp.net';

    // 🔥 FIX: Solo il creatore del bot NON può essere warnato (protezione assoluta)
    if (isOwner(targetJid)) {
        return await conn.sendMessage(jid, { 
            text: '❌ Non puoi sanzionare il proprietario del bot! È protetto! 🛡️' 
        }, { quoted: m });
    }

    // 🔥 FIX: GLI ADMIN POSSONO ESSERE WARNATI (rimosso il blocco)
    // Non c'è più controllo isAdmin per il target

    // Non puoi warnare te stesso
    if (pureId(sender) === targetId) {
        return await conn.sendMessage(jid, { text: '❌ Non puoi sanzionare te stesso!' }, { quoted: m });
    }

    // Verifica che il target esista nel gruppo
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let exists = groupMetadata.participants.some(p => pureId(p.id) === targetId);
        if (!exists) {
            return await conn.sendMessage(jid, { 
                text: `❌ L'utente @${targetId} non è presente in questo gruppo!`, 
                mentions: [targetJid] 
            }, { quoted: m });
        }
    } catch (e) {}

    let db = getDB();
    if (!db[jid]) db[jid] = {};
    if (!db[jid][targetId]) db[jid][targetId] = 0;

    let cmd = (command || '').toLowerCase().trim();

    // 🚀 GESTIONE ASSEGNAZIONE WARN
    if (cmd === 'warn' || cmd === 'richiamo') {
        db[jid][targetId]++;
        let attuali = db[jid][targetId];

        await conn.sendMessage(jid, { react: { text: '⚠️', key: m.key } });

        // 🔥 Verifica se il target è un admin (per messaggio personalizzato)
        const isTargetAdmin = await isAdmin(conn, jid, targetJid);
        const adminTag = isTargetAdmin ? ' 👑 *[ADMIN]*' : '';

        if (attuali >= 3) {
            // Raggiunti i 3 richiami: azzera il conteggio locale e avvia l'espulsione forzata
            db[jid][targetId] = 0;
            saveDB(db);

            await conn.sendMessage(jid, { 
                text: `🚨 *PROTOCOLLO DI ESPULSIONE ATTIVATO!* 🚨\n\nL'utente @${targetId}${adminTag} ha accumulato *3/3 richiami*.\nProcedo con la cacciata coatta dal gruppo. Ciao! 👋🔨`, 
                mentions: [targetJid] 
            }, { quoted: m });
            
            try {
                return await conn.groupParticipantsUpdate(jid, [targetJid], 'remove');
            } catch (err) {
                return await conn.sendMessage(jid, { 
                    text: '❌ Impossibile cacciare l\'utente. Assicurati che il bot sia amministratore del gruppo!' 
                }, { quoted: m });
            }
        } else {
            saveDB(db);
            return await conn.sendMessage(jid, { 
                text: `⚠️ *RICHIAMO UFFICIALE REGISTRATO!* ⚠️\n\n👤 *Utente sanzionato:* @${targetId}${adminTag}\n📊 *Situazione richiami:* [ *${attuali}/3* ]\n👮 *Sanzionato da:* @${pureId(sender)}\n\n📌 _Al terzo richiamo verrai espulso automaticamente dalla chat._`, 
                mentions: [targetJid, sender] 
            }, { quoted: m });
        }
    }

    // 🚀 GESTIONE GRAZIA (UNWARN)
    if (cmd === 'unwarn' || cmd === 'grazia') {
        if (db[jid][targetId] <= 0) {
            return await conn.sendMessage(jid, { 
                text: `😇 L'utente @${targetId} è pulito, ha già *0 richiami* sul tabellino!`, 
                mentions: [targetJid] 
            }, { quoted: m });
        }

        db[jid][targetId]--;
        let attuali = db[jid][targetId];
        saveDB(db);

        // 🔥 Verifica se il target è un admin (per messaggio personalizzato)
        const isTargetAdmin = await isAdmin(conn, jid, targetJid);
        const adminTag = isTargetAdmin ? ' 👑 *[ADMIN]*' : '';

        await conn.sendMessage(jid, { react: { text: '😇', key: m.key } });
        return await conn.sendMessage(jid, { 
            text: `😇 *GRAZIA CONCESSA!* Richiamo revocato.\n\n👤 *Utente perdonato:* @${targetId}${adminTag}\n📊 *Nuovo totale richiami:* [ *${attuali}/3* ]\n👮 *Perdonato da:* @${pureId(sender)}`, 
            mentions: [targetJid, sender] 
        }, { quoted: m });
    }
};

handler.help = ['warn @tag', 'unwarn @tag'];
handler.tags = ['moderazione'];
handler.command = /^(warn|unwarn|richiamo|grazia)$/i;

export default handler;
