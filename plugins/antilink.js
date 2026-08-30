import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/antilink.json');

// Domini sempre permessi, anche con antilink attivo
const WHITELIST_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be'];

// Rileva un link generico dentro un testo
const LINK_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[a-z]{2,})/gi;

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

function isWhitelistedLink(link) {
    return WHITELIST_DOMAINS.some(domain => link.toLowerCase().includes(domain));
}

function containsForbiddenLink(text) {
    if (!text) return false;
    let matches = text.match(LINK_REGEX);
    if (!matches) return false;
    return matches.some(link => !isWhitelistedLink(link));
}

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) {
        console.log('Errore controllo admin antilink:', e);
        return false;
    }
}

// HOOK GLOBALE: chiamato da main.js su OGNI messaggio nei gruppi.
// Se l'antilink e' attivo per quel gruppo, controlla i link e agisce
// in base alla modalita' scelta (kick o warn).
export async function messageHook(conn, m) {
    try {
        let jid = m.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) return;

        let db = getDB();
        let settings = db[jid];
        if (!settings || !settings.enabled) return;

        let sender = m.key.participant;
        if (!sender) return;

        // Owner e admin sono sempre esenti
        if (isOwner(sender)) return;
        if (await isAdmin(conn, jid, sender)) return;

        let text = m.message?.conversation
            || m.message?.extendedTextMessage?.text
            || m.message?.imageMessage?.caption
            || m.message?.videoMessage?.caption
            || '';

        if (!containsForbiddenLink(text)) return;

        // Cancella sempre il messaggio, indipendentemente dalla modalita'
        try {
            await conn.sendMessage(jid, { delete: m.key });
        } catch (e) {
            console.error('Errore eliminazione messaggio antilink:', e.message);
        }

        if (settings.mode === 'kick') {
            try {
                await conn.groupParticipantsUpdate(jid, [sender], 'remove');
                await conn.sendMessage(jid, {
                    text: `🚫 @${pureId(sender)} è stato *rimosso dal gruppo* per aver condiviso un link non consentito.`,
                    mentions: [sender]
                });
            } catch (e) {
                console.error('Errore kick antilink:', e.message);
                await conn.sendMessage(jid, {
                    text: `⚠️ @${pureId(sender)} ha mandato un link vietato, ma non sono riuscito a rimuoverlo (controlla che io sia admin).`,
                    mentions: [sender]
                });
            }
        } else {
            // Modalita' warn: solo avviso, l'utente resta nel gruppo
            await conn.sendMessage(jid, {
                text: `⚠️ @${pureId(sender)}, i link non sono consentiti in questo gruppo! Il messaggio è stato eliminato.`,
                mentions: [sender]
            });
        }
    } catch (e) {
        console.error('Errore messageHook antilink.js:', e);
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
        return await conn.sendMessage(jid, { text: '❌ Solo gli amministratori possono gestire l\'antilink.' }, { quoted: m });
    }

    let cmd = (command || '').toLowerCase();
    let db = getDB();

    if (cmd === 'antilinkkick') {
        db[jid] = { enabled: true, mode: 'kick' };
        saveDB(db);
        return await conn.sendMessage(jid, { text: '🔗🦵 Antilink attivato in modalità *KICK*: chi manda link non consentiti verrà rimosso dal gruppo.' }, { quoted: m });
    }

    if (cmd === 'antilinkwarn') {
        db[jid] = { enabled: true, mode: 'warn' };
        saveDB(db);
        return await conn.sendMessage(jid, { text: '🔗⚠️ Antilink attivato in modalità *WARN*: i link non consentiti verranno eliminati con un avviso.' }, { quoted: m });
    }

    if (cmd === 'antilinkoff') {
        delete db[jid];
        saveDB(db);
        return await conn.sendMessage(jid, { text: '🔗❌ Antilink disattivato.' }, { quoted: m });
    }

    if (cmd === 'antilink') {
        let current = db[jid];
        let statusText = current
            ? `Attivo — modalità *${current.mode.toUpperCase()}*`
            : 'Disattivo';

        let buttons = [
            { buttonId: 'antilinkkick', buttonText: { displayText: '🦵 Modalità Kick' }, type: 1 },
            { buttonId: 'antilinkwarn', buttonText: { displayText: '⚠️ Modalità Warn' }, type: 1 },
            { buttonId: 'antilinkoff', buttonText: { displayText: '❌ Disattiva' }, type: 1 }
        ];

        return await conn.sendMessage(jid, {
            text: `🔗 *Gestione Antilink*\nStato attuale: ${statusText}\n\nLink sempre permessi: TikTok, Instagram, YouTube.\n\nScegli un'opzione:`,
            footer: 'Zeno Bot - Moderazione',
            buttons: buttons,
            headerType: 1
        }, { quoted: m });
    }
};

handler.command = /^(antilink|antilinkkick|antilinkwarn|antilinkoff)$/i;
handler.help = ['antilink'];
handler.tags = ['moderazione'];

export default handler;
