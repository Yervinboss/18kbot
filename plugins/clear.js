import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isOwner } from './owner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMP_DIR = path.resolve('tmp');
const MEDIA_DIR = path.join(__dirname, '..', 'database', 'media');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 SCUDO OWNER
    if (!isOwner(sender)) {
        return await conn.sendMessage(jid, { text: '❌ Riservato al Creatore.' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '🧹', key: m.key } });

    // 🧠 1. SVUOTA CHAT INTERNA (Pulisce lo store in memoria del bot per questo gruppo)
    try {
        if (global.store && global.store.messages && global.store.messages[jid]) {
            if (typeof global.store.messages[jid].clear === 'function') {
                global.store.messages[jid].clear();
            } else {
                global.store.messages[jid] = [];
            }
        }
        if (conn.store && conn.store.messages && conn.store.messages[jid]) {
            if (typeof conn.store.messages[jid].clear === 'function') {
                conn.store.messages[jid].clear();
            } else {
                conn.store.messages[jid] = [];
            }
        }
    } catch (storeErr) {
        console.log("Errore svuotamento store RAM:", storeErr.message);
    }

    // 💾 2. PULIZIA FILE TEMPORANEI SU DISCO
    let fileEliminati = 0;
    let spazioLiberatoBytes = 0;

    const pulisciCartella = (cartellaPath) => {
        if (!fs.existsSync(cartellaPath)) return;
        let files = fs.readdirSync(cartellaPath);
        for (let file of files) {
            if (file.endsWith('.json') || file === '.placeholder') continue;
            let filePath = path.join(cartellaPath, file);
            try {
                let stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    spazioLiberatoBytes += stats.size;
                    fs.unlinkSync(filePath);
                    fileEliminati++;
                }
            } catch (e) {}
        }
    };

    pulisciCartella(TMP_DIR);
    pulisciCartella(MEDIA_DIR);
    
    let rootFiles = fs.readdirSync(path.resolve('.'));
    for (let file of rootFiles) {
        if (file.startsWith('toaud_in_') || file.startsWith('toaud_out_')) {
            try {
                let stats = fs.statSync(file);
                spazioLiberatoBytes += stats.size;
                fs.unlinkSync(file);
                fileEliminati++;
            } catch (e) {}
        }
    }

    let mbLiberati = (spazioLiberatoBytes / (1024 * 1024)).toFixed(2);

    // 📝 UNICO MESSAGGIO BREVE E SECO
    let reportCorto = `🧹 *Memoria e cache svuotate!* Il bot ha azzerato lo store di questa chat e rimosso *${fileEliminati}* file temporanei (*${mbLiberati} MB*).`;
    let msgInviato = await conn.sendMessage(jid, { text: reportCorto }, { quoted: m });

    // ⏳ TIMER AUTO-CANCELLAZIONE: Aspetta 5 secondi, poi fa sparire le scritte per non intasare lo schermo
    await sleep(5000);
    try {
        await conn.sendMessage(jid, { delete: msgInviato.key });
        await conn.sendMessage(jid, { delete: m.key });
    } catch (err) {
        console.log("Errore auto-cancellazione messaggi:", err.message);
    }
};

handler.help = ['clear'];
handler.tags = ['creatore'];
handler.command = /^(clear|cleartmp|pulisci|svuota)$/i;

export default handler;
