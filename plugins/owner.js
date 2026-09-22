import fs from 'fs';
import path from 'path';

const ownersDbPath = path.resolve('database/owners.json');

const mioLid = '26496123052225@lid';

function readOwners() {
    if (!fs.existsSync(ownersDbPath)) {
        fs.mkdirSync(path.dirname(ownersDbPath), { recursive: true });
        const initial = [mioLid];
        fs.writeFileSync(ownersDbPath, JSON.stringify(initial, null, 2));
        return initial;
    }
    try { 
        let data = JSON.parse(fs.readFileSync(ownersDbPath, 'utf-8'));
        if (!Array.isArray(data)) data = [mioLid];
        
        data = data
            .map(x => String(x).replace(/['"`]/g, '').trim())
            .filter(x => {
                if (!x || x === 'null' || x === 'undefined') return false;
                if (x.startsWith('@') && !x.includes('.')) return false; 
                return /[0-9]/.test(x);
            });

        if (!data.includes(mioLid)) data.push(mioLid);
        
        fs.writeFileSync(ownersDbPath, JSON.stringify(Array.from(new Set(data)), null, 2));
        return Array.from(new Set(data));
    } catch (e) { 
        return [mioLid]; 
    }
}

function saveOwners(list) {
    let cleanList = Array.from(new Set(
        list.map(x => String(x).replace(/['"`]/g, '').trim())
            .filter(x => {
                if (!x || x === 'null' || x === 'undefined') return false;
                return /[0-9]/.test(x);
            })
    ));
    fs.writeFileSync(ownersDbPath, JSON.stringify(cleanList, null, 2));
}

global.owner = readOwners();

export function isOwner(senderId) {
    if (!global.owner || !senderId) return false;
    let cleanSender = String(senderId).trim();
    return global.owner.some(o => {
        let cleanO = String(o).trim();
        if (cleanO === cleanSender) return true;
        let numO = cleanO.replace(/[^0-9]/g, '');
        let numSender = cleanSender.replace(/[^0-9]/g, '');
        return numO && numSender && numO === numSender;
    });
}

let handler = async (m, { conn, text, command }) => {
    let chatId = m.chat || m.key?.remoteJid;
    if (!chatId) return;

    let sender = m.sender || m.key?.participant || m.key?.remoteJid;
    let cmd = (command || '').toLowerCase();

    // --- .id ---
    if (cmd === 'id') {
        let isAnOwner = isOwner(sender);
        let txt = `╭━━━〔 📌 *INFO UTENTE* 📌 〕━━━⬣\n`;
        txt += `┃ 🆔 *ID Letto:* \`${sender}\`\n`;
        txt += `┃ 👑 *Sei il Creatore:* ${isAnOwner ? 'Sì 👑' : 'No ❌'}\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;
        return await conn.sendMessage(chatId, { text: txt }, { quoted: m });
    }

    // --- .creatorilist ---
    if (cmd === 'creatorilist') {
        global.owner = readOwners();
        let list = global.owner;
        
        let txt = `╭━━━〔 👑 *LISTA CREATORI* 👑 〕━━━⬣\n`;

        if (list.length === 0) {
            txt += `┃ ⚠️ Nessun creatore impostato.\n`;
        } else {
            list.forEach((n, i) => {
                let clean = String(n).trim();
                let displayVal = clean.includes('@') ? clean.split('@')[0] : clean;
                txt += `┃ ${i + 1}. \`${displayVal}\`\n`;
            });
        }
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;
        
        return await conn.sendMessage(chatId, { text: txt }, { quoted: m });
    }

    // --- .addcreatore / .delcreatore ---
    if (cmd === 'addcreatore' || cmd === 'delcreatore') {
        if (!isOwner(sender)) {
            return await conn.sendMessage(chatId, { text: '❌ Solo un creatore esistente può gestire questa lista.' }, { quoted: m });
        }

        let target = null;
        
        // 1. Controlla se hai risposto a un messaggio di qualcuno
        if (m.quoted) {
            target = m.quoted.sender || m.quoted.participant || m.key?.remoteJid;
        } 
        // 2. Controlla se hai menzionato/taggato qualcuno (@utente)
        else if (m.mentionedJid && m.mentionedJid.length > 0) {
            target = m.mentionedJid[0]; // Prende il primo utente taggato correttamente
        } 
        // 3. Fallback se hai scritto il numero o l'ID come testo libero
        else if (text) {
            let cleanText = text.trim();
            if (cleanText) {
                // CORRETTO: Usa la sintassi JavaScript nativa per verificare se contiene numeri
                target = /[0-9]/.test(cleanText) ? (cleanText.replace(/[^0-9]/g, '') + '@s.whatsapp.net') : cleanText;
            }
        }

        if (!target) {
            return await conn.sendMessage(chatId, { text: `❌ Usa il comando taggando l'utente, rispondendo al suo messaggio o scrivendo il suo ID.` }, { quoted: m });
        }

        let targetStr = String(target).replace(/['"`]/g, '').trim();
        if (!targetStr || !/[0-9]/.test(targetStr)) {
            return await conn.sendMessage(chatId, { text: `❌ ID utente non valido o non riconosciuto.` }, { quoted: m });
        }

        global.owner = readOwners();
        let exists = isOwner(targetStr);

        if (cmd === 'addcreatore') {
            if (exists) {
                return await conn.sendMessage(chatId, { text: `⚠️ Questo utente è già nella lista dei creatori.` }, { quoted: m });
            }
            global.owner.push(targetStr);
            saveOwners(global.owner);
            
            let displayTarget = targetStr.includes('@') ? targetStr.split('@')[0] : targetStr;
            return await conn.sendMessage(chatId, {
                text: `✅ Aggiunto con successo alla lista dei creatori:\n\`${displayTarget}\``
            }, { quoted: m });
        }

        if (cmd === 'delcreatore') {
            if (!exists) {
                return await conn.sendMessage(chatId, { text: `⚠️ Questo utente non è presente nella lista dei creatori.` }, { quoted: m });
            }
            if (global.owner.length <= 1) {
                return await conn.sendMessage(chatId, { text: `❌ Non puoi rimuovere l'ultimo creatore rimasto.` }, { quoted: m });
            }
            
            let targetNum = targetStr.replace(/[^0-9]/g, '');
            global.owner = global.owner.filter(o => {
                let cleanO = String(o).trim();
                if (cleanO === targetStr) return false;
                let numO = cleanO.replace(/[^0-9]/g, '');
                return !(targetNum && numO && numO === targetNum);
            });
            
            saveOwners(global.owner);

            let displayTarget = targetStr.includes('@') ? targetStr.split('@')[0] : targetStr;
            return await conn.sendMessage(chatId, {
                text: `✅ Rimosso dalla lista dei creatori:\n\`${displayTarget}\``
            }, { quoted: m });
        }
    }
};

handler.command = /^(id|creatorilist|addcreatore|delcreatore)$/i;
handler.tags = ['owner'];
handler.help = ['id', 'creatorilist', 'addcreatore', 'delcreatore'];

export default handler;
