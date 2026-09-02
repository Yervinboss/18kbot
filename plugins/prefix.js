import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/prefix.json');
const DEFAULT_PREFIX = '.';

function getConfig() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify({ prefix: DEFAULT_PREFIX }));
    }
    try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch (e) { return { prefix: DEFAULT_PREFIX }; }
}

function saveConfig(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Funzione riusabile da main.js per leggere il prefisso attuale del bot.
export function getPrefix() {
    return getConfig().prefix || DEFAULT_PREFIX;
}

let handler = async (m, { conn, text }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    if (!isOwner(sender)) {
        return await conn.sendMessage(jid, { text: '❌ Solo il creatore del bot può cambiare il prefisso.' }, { quoted: m });
    }

    let newPrefix = (text || '').trim();

    if (!newPrefix) {
        return await conn.sendMessage(jid, { text: `❌ Specifica il nuovo prefisso.\nEsempio: \`.setprefix !\`\n\nPrefisso attuale: *${getPrefix()}*` }, { quoted: m });
    }

    if (newPrefix.length > 3) {
        return await conn.sendMessage(jid, { text: '❌ Il prefisso deve essere breve (massimo 3 caratteri).' }, { quoted: m });
    }

    let config = getConfig();
    config.prefix = newPrefix;
    saveConfig(config);

    return await conn.sendMessage(jid, { text: `✅ Prefisso cambiato in: *${newPrefix}*\nDa ora i comandi vanno scritti così: \`${newPrefix}menu\`` }, { quoted: m });
};

handler.command = /^setprefix$/i;
handler.help = ['setprefix'];
handler.tags = ['owner'];

export default handler;

