import fs from 'fs'
import path from 'path'

const dbPath = path.resolve('database/rpg.json');

const getDB = () => {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

const saveDB = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function pureId(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

const RINGS = {
    bronzo: { name: '💍 Anello di Bronzo', price: 5000 },
    argento: { name: '💍 Anello d\'Argento', price: 20000 },
    oro: { name: '💍 Anello d\'Oro', price: 50000 },
    diamante: { name: '💎 Anello di Diamante', price: 150000 }
};

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    let userId = pureId(m.key.participant || m.key.remoteJid);
    let db = getDB();
    let msgText = (m.text || '').toLowerCase();
    let cmd = (command || '').toLowerCase();

    // 1. Comando iniziale: .divorzio
    if (cmd === 'divorzio' || cmd === 'divorzia') {
        if (!db[userId] || !db[userId].spouse) {
            return await conn.sendMessage(jid, { text: '❌ Ma se nemmeno sei sposato/a! Vuoi divorziare dal vuoto?' }, { quoted: m });
        }

        let partnerId = db[userId].spouse;

        let buttons = [
            { buttonId: `divorzio_si_${partnerId}_${userId}`, buttonText: { displayText: '💔 Accetta Divorzio' }, type: 1 },
            { buttonId: `divorzio_no_${partnerId}_${userId}`, buttonText: { displayText: '💍 Rifiuta (Restiamo insieme)' }, type: 1 }
        ];

        return await conn.sendMessage(jid, {
            text: `⚖️ *RICHIESTA DI DIVORZIO* 📜\n\n@${userId} ha chiesto il divorzio a @${partnerId}!\nVuole dividere le strade e dividere i beni coniugali. Che decide il partner?`,
            mentions: [`${userId}@s.whatsapp.net`, `${partnerId}@s.whatsapp.net`],
            buttons: buttons,
            headerType: 1
        }, { quoted: m });
    }

    // 2. Risposta SI (Accetta il divorzio)
    if (cmd.startsWith('divorzio_si_') || msgText.startsWith('divorzio_si_')) {
        let fullCmd = cmd.startsWith('divorzio_si_') ? cmd : msgText;
        let parts = fullCmd.replace('divorzio_si_', '').split('_');
        let invitedId = parts[0];
        let proposerId = parts[1];

        if (userId !== invitedId && userId !== proposerId) {
            return await conn.sendMessage(jid, { text: '❌ Questa pratica di divorzio non è per te!' }, { quoted: m });
        }

        if (!db[proposerId] || !db[invitedId] || db[proposerId].spouse !== invitedId) {
            return await conn.sendMessage(jid, { text: '❌ Questa coppia non risulta più valida o registrata.' }, { quoted: m });

        }

        // Rimuoviamo il matrimonio
        db[proposerId].spouse = null;
        db[invitedId].spouse = null;

        // Rimborso simbolico / divisione dei beni (es. restituiamo una parte del valore standard dell'anello diviso a metà)
        let rimborso = 25000; // metà di un anello medio/alto o gestibile
        db[proposerId].money = (db[proposerId].money || 0) + rimborso;
        db[invitedId].money = (db[invitedId].money || 0) + rimborso;

        saveDB(db);

        return await conn.sendMessage(jid, {
            text: `💔 *DIVORZIO ACCETTATO E UFFICIALIZZATO!* 👨‍⚖️\n\nLe strade di @${proposerId} e @${invitedId} si dividono ufficialmente. I beni sono stati divisi equamente! Siete di nuovo liberi sul mercato 🏃💨`,
            mentions: [`${proposerId}@s.whatsapp.net`, `${invitedId}@s.whatsapp.net`]
        }, { quoted: m });
    }

    // 3. Risposta NO (Rifiuta il divorzio)
    if (cmd.startsWith('divorzio_no_') || msgText.startsWith('divorzio_no_')) {
        let fullCmd = cmd.startsWith('divorzio_no_') ? cmd : msgText;
        let parts = fullCmd.replace('divorzio_no_', '').split('_');
        let invitedId = parts[0];
        let proposerId = parts[1];

        if (userId !== invitedId && userId !== proposerId) {
            return await conn.sendMessage(jid, { text: '❌ Questa pratica di divorzio non è per te!' }, { quoted: m });
        }

        return await conn.sendMessage(jid, {
            text: `💍 *DIVORZIO RESPINTO!* ❤️\n\n@${invitedId} ha rifiutato il divorzio! L'amore (o il portafoglio) trionfa ancora, restate ufficialmente sposati!`,
            mentions: [`${proposerId}@s.whatsapp.net`, `${invitedId}@s.whatsapp.net`]
        }, { quoted: m });
    }
};

handler.command = /^(divorzio|divorzia|divorzio_si_.*|divorzio_no_.*)$/i;
handler.help = ['divorzio'];
handler.tags = ['rpg'];

export default handler;

