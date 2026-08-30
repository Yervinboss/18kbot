import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/soloadmin.json');

function getDB() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify([]));
    }
    try {
        let data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function pureId(jid) { return jid ? jid.replace(/[^0-9]/g, '') : ''; }

export function isSoloAdminActive(jid) {
    let list = getDB();
    return list.includes(jid);
}

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

let handler = async (m, { conn, command, prefix }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 Controllo di sicurezza: solo creatori o admin della chat possono toccare la barriera
    if (!isOwner(sender) && !(await isAdmin(conn, jid, sender))) {
        return await conn.sendMessage(jid, { text: '❌ Solo gli amministratori possono gestire questa modalità.' }, { quoted: m });
    }

    let cmd = (command || '').toLowerCase().trim();
    let list = getDB();

    // 🚀 AZIONE BOTTONE 1: ACCENSIONE FORZATA
    if (cmd === 'soloadminon') {
        if (!list.includes(jid)) {
            list.push(jid);
            saveDB(list);
        }
        await conn.sendMessage(jid, { react: { text: '🔒', key: m.key } });
        return await conn.sendMessage(jid, { text: '🔒 *Modalità Solo Admin* attivata con successo.\nDa questo momento il bot eseguirà i comandi esclusivamente per gli amministratori.' }, { quoted: m });
    }

    // 🚀 AZIONE BOTTONE 2: SPEGNIMENTO FORZATA
    if (cmd === 'soloadminoff') {
        list = list.filter(g => g !== jid);
        saveDB(list);
        await conn.sendMessage(jid, { react: { text: '🔓', key: m.key } });
        return await conn.sendMessage(jid, { text: '🔓 *Modalità Solo Admin* disattivata.\nLa chat è aperta, tutti i membri possono nuovamente usare Zeno Bot!' }, { quoted: m });
    }

    // INTERFACCIA INTERATTIVA PRINCIPALE AL DIGITARE DI .soloadmin
    if (cmd === 'soloadmin') {
        let status = list.includes(jid) ? 'ATTIVA 🔒 (Solo Admin)' : 'DISATTIVATA 🔓 (Tutti liberi)';
        let bodyText = `🛡️ *PANNELLO SCHERMATURA CHAT* 🛡️\n\nStato attuale nel gruppo: *${status}*\n\n_Seleziona la configurazione usando i pulsanti qui sotto:_`;

        let buttonsConfig = [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔒 Attiva Solo Admin", id: `.soloadminon` }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔓 Disattiva", id: `.soloadminoff` }) }
        ];

        let messageContent = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text: bodyText },
                        footer: { text: "Zeno Guard Core ⚙️" },
                        nativeFlowMessage: {
                            buttons: buttonsConfig
                        }
                    }
                }
            }
        };

        await conn.sendMessage(jid, { react: { text: '🎛️', key: m.key } });
        return await conn.relayMessage(jid, messageContent, { quoted: m });
    }
};

handler.command = /^(soloadmin|soloadminon|soloadminoff)$/i;
handler.help = ['soloadmin'];
handler.tags = ['moderazione'];

export default handler;
