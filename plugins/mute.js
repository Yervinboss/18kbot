import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/mutati.json');
if (!global.pendingMuteActions) global.pendingMuteActions = {};

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

// Estrae solo la parte numerica pura di un ID, ignorando il suffisso
// @s.whatsapp.net oppure @lid, e ignorando anche il device (":12" dopo il numero).
// Cosi il confronto funziona sia con JID classici che con i nuovi LID.
function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
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

// HOOK GLOBALE: chiamato da main.js per OGNI messaggio in arrivo nei gruppi,
// non solo per i comandi .mute/.unmute. Se il mittente e nella lista dei
// mutati di quel gruppo, il suo messaggio viene cancellato automaticamente.
export async function messageHook(conn, m) {
    try {
        let jid = m.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) return;

        let sender = m.key.participant;
        if (!sender) return;

        // L'owner del bot non viene mai mutato/cancellato, per sicurezza
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

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.participant;
    if (!sender && m.key.fromMe) sender = conn.user.id;

    // L'owner del bot bypassa sempre il controllo admin
    if (!isOwner(sender) && !(await isAdmin(conn, jid, sender))) {
        return await conn.sendMessage(jid, { text: '❌ *Non sei un amministratore!* Solo gli admin possono usare i comandi di mute.' }, { quoted: m });
    }

    let cmd = (command || '').toLowerCase();

    // CONTROLLO ANTI-FURBO: se chi sta scrivendo il comando (anche se admin)
    // e' attualmente nella lista dei mutati di questo gruppo, non puo' usare
    // NESSUN comando di mute/unmute, nemmeno per smutare se stesso.
    // L'owner del bot resta sempre esente da questo controllo.
    if (!isOwner(sender)) {
        let db = getMuted();
        let mutedList = db[jid] || [];
        let senderIsMuted = mutedList.some(mutedJid => pureId(mutedJid) === pureId(sender));
        if (senderIsMuted) {
            return; // Ignora silenziosamente: un mutato non deve nemmeno sapere come aggirare il mute
        }
    }

    if (cmd === 'confirmmute' || cmd === 'cancelmute') {
        let pending = global.pendingMuteActions[jid];
        if (!pending) {
            return await conn.sendMessage(jid, { text: '❌ Nessuna richiesta di mute in attesa (potrebbe essere scaduta).' }, { quoted: m });
        }
        if (cmd === 'cancelmute') {
            delete global.pendingMuteActions[jid];
            return await conn.sendMessage(jid, { text: '❌ Mute annullato.' }, { quoted: m });
        }
        let db = getMuted();
        if (!db[jid]) db[jid] = [];
        if (!db[jid].some(id => pureId(id) === pureId(pending.target))) {
            db[jid].push(pending.target);
            saveMuted(db);
        }
        delete global.pendingMuteActions[jid];
        return await conn.sendMessage(jid, {
            text: `🔇 *PROVVEDIMENTO DISCIPLINARE:*\nL'utente @${pureId(pending.target)} è stato *mutato*.`,
            mentions: [pending.target]
        }, { quoted: m });
    }

    if (cmd === 'unmute') {
        let target = m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target && m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        if (!target) {
            return await conn.sendMessage(jid, { text: `❌ Per usare .unmute, rispondi a un messaggio dell'utente o taggalo!` }, { quoted: m });
        }
        let db = getMuted();
        if (!db[jid]) db[jid] = [];
        db[jid] = db[jid].filter(id => pureId(id) !== pureId(target));
        saveMuted(db);
        return await conn.sendMessage(jid, {
            text: `🔊 L'utente @${pureId(target)} è stato *smutato* e può tornare a scrivere.`,
            mentions: [target]
        }, { quoted: m });
    }

    if (cmd === 'mute') {
        let target = m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target && m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        if (!target) {
            return await conn.sendMessage(jid, { text: `❌ Per usare .mute, rispondi a un messaggio dell'utente o taggalo!` }, { quoted: m });
        }

        // Protezione: non si puo mutare l'owner del bot
        if (isOwner(target)) {
            return await conn.sendMessage(jid, { text: '🧠 Non puoi mutare il creatore del bot!' }, { quoted: m });
        }

        global.pendingMuteActions[jid] = { target: target };

        let buttons = [
            { buttonId: 'confirmmute', buttonText: { displayText: '🔇 Conferma Mute' }, type: 1 },
            { buttonId: 'cancelmute', buttonText: { displayText: '❌ Annulla' }, type: 1 }
        ];

        let buttonMessage = {
            text: `⚠️ Vuoi mutare @${pureId(target)}?`,
            footer: 'Zeno Bot - Moderazione',
            buttons: buttons,
            headerType: 1,
            mentions: [target]
        };

        return await conn.sendMessage(jid, buttonMessage, { quoted: m });
    }
};

handler.command = /^(mute|unmute|confirmmute|cancelmute)$/i;
export default handler;
