import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/antispam.json');

// Se un utente manda piu' di SPAM_LIMIT messaggi entro SPAM_WINDOW_MS,
// scatta l'azione anti-spam (kick o warn).
const SPAM_LIMIT = 5;
const SPAM_WINDOW_MS = 8 * 1000;

if (!global.spamTracker) global.spamTracker = {}; // { groupJid: { userPureId: [timestamp, timestamp, ...] } }

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

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) {
        console.log('Errore controllo admin antispam:', e);
        return false;
    }
}

// HOOK GLOBALE: chiamato da main.js su OGNI messaggio nei gruppi.
// Tiene traccia di quanti messaggi manda ciascun utente in una finestra
// di tempo breve; se supera il limite, scatta l'azione anti-spam.
export async function messageHook(conn, m) {
    try {
        let jid = m.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) return;

        let db = getDB();
        let settings = db[jid];
        if (!settings || !settings.enabled) return;

        let sender = m.key.participant;
        if (!sender) return;

        if (isOwner(sender)) return;
        if (await isAdmin(conn, jid, sender)) return;

        let senderPure = pureId(sender);
        let now = Date.now();

        if (!global.spamTracker[jid]) global.spamTracker[jid] = {};
        if (!global.spamTracker[jid][senderPure]) global.spamTracker[jid][senderPure] = [];

        let timestamps = global.spamTracker[jid][senderPure];
        timestamps.push(now);
        // Teniamo solo i timestamp dentro la finestra temporale
        timestamps = timestamps.filter(t => now - t <= SPAM_WINDOW_MS);
        global.spamTracker[jid][senderPure] = timestamps;

        if (timestamps.length <= SPAM_LIMIT) return;

        // Limite superato: azzeriamo il contatore per non ripetere l'azione ad ogni messaggio
        global.spamTracker[jid][senderPure] = [];

        try {
            await conn.sendMessage(jid, { delete: m.key });
        } catch (e) {
            console.error('Errore eliminazione messaggio spam:', e.message);
        }

        if (settings.mode === 'kick') {
            try {
                await conn.groupParticipantsUpdate(jid, [sender], 'remove');
                await conn.sendMessage(jid, {
                    text: `🚫 @${senderPure} è stato *rimosso dal gruppo* per spam (troppi messaggi in poco tempo).`,
                    mentions: [sender]
                });
            } catch (e) {
                console.error('Errore kick antispam:', e.message);
                await conn.sendMessage(jid, {
                    text: `⚠️ @${senderPure} sta facendo spam, ma non sono riuscito a rimuoverlo (controlla che io sia admin).`,
                    mentions: [sender]
                });
            }
        } else {
            await conn.sendMessage(jid, {
                text: `⚠️ @${senderPure}, stai mandando troppi messaggi troppo velocemente! Rallenta.`,
                mentions: [sender]
            });
        }
    } catch (e) {
        console.error('Errore messageHook antispam.js:', e);
    }
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.participant;
    if (!sender && m.key.fromMe) sender = conn.user.id;

    if (!isOwner(sender) && !(await isAdmin(conn, jid, sender))) {
        return await conn.sendMessage(jid, { text: '❌ Solo gli amministratori possono gestire l\'antispam.' }, { quoted: m });
    }

    let cmd = (command || '').toLowerCase();
    let db = getDB();

    if (cmd === 'antispamkick') {
        db[jid] = { enabled: true, mode: 'kick' };
        saveDB(db);
        return await conn.sendMessage(jid, { text: '🚫🦵 Antispam attivato in modalità *KICK*: chi manda troppi messaggi verrà rimosso dal gruppo.' }, { quoted: m });
    }

    if (cmd === 'antispamwarn') {
        db[jid] = { enabled: true, mode: 'warn' };
        saveDB(db);
        return await conn.sendMessage(jid, { text: '🚫⚠️ Antispam attivato in modalità *WARN*: chi fa spam riceverà solo un avviso.' }, { quoted: m });
    }

    if (cmd === 'antispamoff') {
        delete db[jid];
        saveDB(db);
        return await conn.sendMessage(jid, { text: '🚫❌ Antispam disattivato.' }, { quoted: m });
    }

    if (cmd === 'antispam') {
        let current = db[jid];
        let statusText = current
            ? `Attivo — modalità *${current.mode.toUpperCase()}*`
            : 'Disattivo';

        let buttons = [
            { buttonId: 'antispamkick', buttonText: { displayText: '🦵 Modalità Kick' }, type: 1 },
            { buttonId: 'antispamwarn', buttonText: { displayText: '⚠️ Modalità Warn' }, type: 1 },
            { buttonId: 'antispamoff', buttonText: { displayText: '❌ Disattiva' }, type: 1 }
        ];

        return await conn.sendMessage(jid, {
            text: `🚫 *Gestione Antispam*\nStato attuale: ${statusText}\n\nLimite: più di ${SPAM_LIMIT} messaggi in ${SPAM_WINDOW_MS / 1000} secondi.\n\nScegli un'opzione:`,
            footer: 'Zeno Bot - Moderazione',
            buttons: buttons,
            headerType: 1
        }, { quoted: m });
    }
};

handler.command = /^(antispam|antispamkick|antispamwarn|antispamoff)$/i;
handler.help = ['antispam'];
handler.tags = ['moderazione'];

export default handler;
