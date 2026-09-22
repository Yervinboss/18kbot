import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/mutati.json');

function getMuted() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function saveMuted(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ✅ Gestisce sia @s.whatsapp.net che @lid
function pureId(jid) {
    if (!jid) return '';
    let str = typeof jid === 'object' ? (jid.id || String(jid)) : String(jid);
    return str.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

// ✅ Conserva il dominio originale (per menzioni)
function fullJid(jid) {
    if (!jid) return '';
    let str = typeof jid === 'object' ? (jid.id || String(jid)) : String(jid);
    return str.split(':')[0];
}

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) {
        console.log('Errore controllo admin mute:', e);
        return false;
    }
}

// HOOK GLOBALE: cancella automaticamente i messaggi degli utenti mutati
export async function messageHook(conn, m) {
    try {
        let jid = m.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) return;

        let sender = m.key.participant;
        if (!sender) return;

        if (isOwner(sender)) return;

        let db = getMuted();
        let mutedList = db[jid] || [];
        let senderPure = pureId(sender);

        let isMuted = mutedList.some(mutedJid => pureId(mutedJid) === senderPure);
        if (isMuted) {
            try {
                await conn.sendMessage(jid, { delete: m.key });
            } catch (e) {
                console.error('Errore eliminazione messaggio mutato:', e.message);
            }
        }
    } catch (e) {
        console.error('Errore messageHook mute.js:', e);
    }
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.participant;
    if (!sender && m.key.fromMe) sender = conn.user.id;

    // Controllo admin (owner bypassa)
    if (!isOwner(sender) && !(await isAdmin(conn, jid, sender))) {
        return conn.sendMessage(jid, { text: '❌ *Non sei un amministratore!* Solo gli admin possono usare i comandi di mute.' }, { quoted: m });
    }

    let cmd = (command || '').toLowerCase();

    // Anti-furbo: se chi scrive è mutato, non può usare i comandi (tranne owner)
    if (!isOwner(sender)) {
        let db = getMuted();
        let mutedList = db[jid] || [];
        let senderIsMuted = mutedList.some(mutedJid => pureId(mutedJid) === pureId(sender));
        if (senderIsMuted) return;
    }

    // Recupera il target (reply o menzione)
    let target = m.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target && m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    // === UNMUTE ===
    if (cmd === 'unmute') {
        if (!target) {
            return conn.sendMessage(jid, { text: `❌ Per usare .unmute, rispondi a un messaggio dell'utente o taggalo!` }, { quoted: m });
        }
        let db = getMuted();
        if (!db[jid]) db[jid] = [];
        db[jid] = db[jid].filter(id => pureId(id) !== pureId(target));
        saveMuted(db);
        return conn.sendMessage(jid, {
            text: `🔊 L'utente @${pureId(target)} è stato *smutato* e può tornare a scrivere.`,
            mentions: [fullJid(target)]
        }, { quoted: m });
    }

    // === MUTE ===
    if (cmd === 'mute') {
        if (!target) {
            return conn.sendMessage(jid, { text: `❌ Per usare .mute, rispondi a un messaggio dell'utente o taggalo!` }, { quoted: m });
        }

        if (isOwner(target)) {
            return conn.sendMessage(jid, { text: '🧠 Non puoi mutare il creatore del bot!' }, { quoted: m });
        }

        let db = getMuted();
        if (!db[jid]) db[jid] = [];
        if (!db[jid].some(id => pureId(id) === pureId(target))) {
            db[jid].push(fullJid(target));
            saveMuted(db);
        }

        return conn.sendMessage(jid, {
            text: `🔇 *PROVVEDIMENTO DISCIPLINARE:*\nL'utente @${pureId(target)} è stato *mutato*.`,
            mentions: [fullJid(target)]
        }, { quoted: m });
    }
};

handler.help = ['mute [@tag / rispondi]', 'unmute [@tag / rispondi]'];
handler.tags = ['admin'];
handler.command = /^(mute|unmute)$/i;

export default handler;
