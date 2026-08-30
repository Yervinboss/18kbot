import fs from 'fs';
import path from 'path';

const ownersDbPath = path.resolve('database/owners.json');

function readOwners() {
    if (!fs.existsSync(ownersDbPath)) {
        fs.mkdirSync(path.dirname(ownersDbPath), { recursive: true });
        fs.writeFileSync(ownersDbPath, JSON.stringify([]));
    }
    try { return JSON.parse(fs.readFileSync(ownersDbPath, 'utf-8')); } catch (e) { return []; }
}

function saveOwners(list) {
    fs.writeFileSync(ownersDbPath, JSON.stringify(list, null, 2));
}

function pureNumber(value) {
    if (!value) return '';
    return String(value).replace(/[^0-9]/g, '');
}

if (!global.owner) global.owner = [];
let persisted = readOwners();
for (let num of persisted) {
    if (!global.owner.includes(num)) global.owner.push(num);
}

export function isOwner(number) {
    if (!global.owner) return false;
    let target = pureNumber(number);
    if (!target) return false;
    return global.owner.some(o => pureNumber(o) === target);
}

let handler = async (m, { conn, text, command }) => {
    let chatId = m.chat || m.key?.remoteJid;
    if (!chatId) return;

    let sender = m.key?.participant || m.key?.remoteJid;
    let cmd = (command || '').toLowerCase();

    // --- .creatorilist: Mostra la lista attuale dei numeri salvati ---
    if (cmd === 'creatorilist') {
        let list = global.owner || [];
        let txt = `╭━━━〔 👑 *LISTA CREATORI* 👑 〕━━━⬣\n`;
        if (list.length === 0) {
            txt += `┃ ⚠️ Nessun creatore impostato.\n`;
        } else {
            list.forEach((n, i) => { txt += `┃ ${i + 1}. @${pureNumber(n)}\n`; });
        }
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;
        
        let mentions = list.map(n => `${pureNumber(n)}@s.whatsapp.net`);
        return await conn.sendMessage(chatId, { text: txt, mentions: mentions }, { quoted: m });
    }

    // --- .addcreatore / .delcreatore ---
    if (cmd === 'addcreatore' || cmd === 'delcreatore') {
        if (!isOwner(sender)) {
            return await conn.sendMessage(chatId, { text: '❌ Solo un creatore esistente può gestire questa lista.' }, { quoted: m });
        }

        let target = null;
        if (m.quoted) {
            target = m.quoted.sender;
        } else if (m.mentionedJid && m.mentionedJid.length > 0) {
            target = m.mentionedJid[0];
        } else if (text) {
            let cleanNumber = text.replace(/[^0-9]/g, '');
            if (cleanNumber.length >= 8) target = cleanNumber;
        }

        if (!target) {
            return await conn.sendMessage(chatId, { text: `❌ Rispondi a un utente, taggalo, oppure scrivi il suo numero di telefono.` }, { quoted: m });
        }

        let targetNumber = pureNumber(target);

        if (cmd === 'addcreatore') {
            if (isOwner(targetNumber)) {
                return await conn.sendMessage(chatId, { text: `⚠️ Questo utente è già nella lista dei creatori.` }, { quoted: m });
            }
            global.owner.push(targetNumber);
            saveOwners(global.owner);
            return await conn.sendMessage(chatId, {
                text: `✅ @${targetNumber} è stato aggiunto come *creatore* del bot.`,
                mentions: [target.includes('@') ? target : `${targetNumber}@s.whatsapp.net`]
            }, { quoted: m });
        }

        if (cmd === 'delcreatore') {
            if (!isOwner(targetNumber)) {
                return await conn.sendMessage(chatId, { text: `⚠️ Questo utente non è nella lista dei creatori.` }, { quoted: m });
            }
            if (global.owner.length <= 1) {
                return await conn.sendMessage(chatId, { text: `❌ Non puoi rimuovere l'ultimo creatore rimasto.` }, { quoted: m });
            }
            global.owner = global.owner.filter(o => pureNumber(o) !== targetNumber);
            saveOwners(global.owner);
            return await conn.sendMessage(chatId, {
                text: `✅ @${targetNumber} è stato rimosso dai *creatori* del bot.`,
                mentions: [target.includes('@') ? target : `${targetNumber}@s.whatsapp.net`]
            }, { quoted: m });
        }
    }
};

handler.command = /^(creatorilist|addcreatore|delcreatore)$/i;
handler.tags = ['owner'];
handler.help = ['creatorilist', 'addcreatore', 'delcreatore'];

export default handler;
