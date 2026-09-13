import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const antibotDbPath = path.join(__dirname, '../database/antibot.json');

// ============================================================
// 💾 DB: attiva/disattiva per gruppo
// ============================================================
function readDb() {
    if (!fs.existsSync(antibotDbPath)) return {};
    try { return JSON.parse(fs.readFileSync(antibotDbPath, 'utf8')); } catch (e) { return {}; }
}
function writeDb(data) {
    fs.mkdirSync(path.dirname(antibotDbPath), { recursive: true });
    fs.writeFileSync(antibotDbPath, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================
// 🧠 RILEVAMENTO DEVICE DALL'ID MESSAGGIO
// ============================================================
function rilevaDispositivoCheck(msgID = '') {
    if (!msgID) return 'sconosciuto';
    if (/^[a-zA-Z]+-[a-fA-F0-9]+$/.test(msgID)) return 'bot';
    if (msgID.startsWith('false_') || msgID.startsWith('true_')) return 'web';
    if (msgID.startsWith('3EB0') && /^[A-Z0-9]+$/.test(msgID)) return 'webbot';
    if (msgID.includes(':')) return 'desktop';
    if (/^[A-F0-9]{32}$/i.test(msgID)) return 'android';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msgID)) return 'ios';
    if (/^[A-Z0-9]{20,25}$/i.test(msgID) && !msgID.startsWith('3EB0')) return 'ios';
    if (msgID.startsWith('3EB0')) return 'android_old';
    return 'sconosciuto';
}

// ============================================================
// 🎛️ HANDLER - Comando .antibot
// ============================================================
let handler = async (m, { conn, text, command }) => {
    let chatId = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    if (!chatId.endsWith('@g.us')) {
        return conn.sendMessage(chatId, { text: '❌ Solo nei gruppi.' }, { quoted: m });
    }

    // Verifica admin
    let isSenderAdmin = false;
    try {
        const meta = await conn.groupMetadata(chatId);
        const senderPure = (sender || '').replace(/[^0-9]/g, '');
        isSenderAdmin = !!meta.participants.find(p =>
            (p.id || '').replace(/[^0-9]/g, '') === senderPure && p.admin
        );
    } catch (e) {}

    if (!isSenderAdmin) {
        return conn.sendMessage(chatId, { text: '❌ Solo admin.' }, { quoted: m });
    }

    let db = readDb();
    let action = (text || '').trim().toLowerCase();

    if (action === 'on') {
        db[chatId] = true;
        writeDb(db);
        return conn.sendMessage(chatId, {
            text: `🛡️ *ANTIBOT ATTIVATO*\n\nDa ora il bot butta fuori automaticamente:\n• 🤖 Bot\n• 🌐 WebBot\n\n_Non butta chi usa WhatsApp Web normale (troppi falsi positivi)._`
        }, { quoted: m });
    }

    if (action === 'off') {
        delete db[chatId];
        writeDb(db);
        return conn.sendMessage(chatId, { text: '🛡️ *ANTIBOT DISATTIVATO*' }, { quoted: m });
    }

    let status = db[chatId] ? '✅ ATTIVO' : '❌ DISATTIVATO';
    return conn.sendMessage(chatId, {
        text: `🛡️ *ANTIBOT*\n\nStato: *${status}*\n\n📌 *Comandi:*\n• \`.antibot on\` → attiva\n• \`.antibot off\` → disattiva\n\n_Quando attivo, butta fuori chi viene rilevato come bot/webbot._`
    }, { quoted: m });
};

handler.help = ['antibot'];
handler.tags = ['moderazione'];
handler.command = /^(antibot)$/i;

// ============================================================
// 🎯 AUTO-KICK: analizza ogni nuovo messaggio
// ============================================================
handler.all = async function (m, { conn }) {
    try {
        if (!m.message || m.isBaileys || m.fromMe) return;
        let chatId = m.key?.remoteJid;
        if (!chatId || !chatId.endsWith('@g.us')) return;

        // Controlla se antibot è attivo per questo gruppo
        let db = readDb();
        if (!db[chatId]) return;

        // Prende il sender
        let sender = m.key.participant || m.key.remoteJid;
        if (!sender) return;

        // Non toccare admin
        try {
            const meta = await conn.groupMetadata(chatId);
            const senderPure = sender.replace(/[^0-9]/g, '');

            // Se è admin → salta
            const isAdmin = !!meta.participants.find(p =>
                (p.id || '').replace(/[^0-9]/g, '') === senderPure && p.admin
            );
            if (isAdmin) return;

            // Se è il bot stesso → salta
            const botId = (conn.user?.id || '').replace(/[^0-9]/g, '');
            if (senderPure === botId) return;

            // Rileva device
            const device = rilevaDispositivoCheck(m.key?.id);

            // 🔥 Butta solo bot e webbot (NON web per non fare danni)
            const sospetti = ['bot', 'webbot'];

            if (sospetti.includes(device)) {
                await conn.groupParticipantsUpdate(chatId, [sender], 'remove');
                await conn.sendMessage(chatId, {
                    text: `╭─⟪ 🚫 Anti-Bot ⟫─╮\n│ 👤 Utente: @${senderPure}\n│ 🛑 Azione: Rimosso dal gruppo\n│ 📱 Dispositivo: ${device.toUpperCase()}\n╰─⟪ 𝟑𝟑𝟑 𝐁Ꮻ𝐓 ⟫─╯`,
                    mentions: [sender]
                }).catch(() => {});
            }
        } catch (e) {
            // Silenzioso se errore
        }
    } catch (e) {}
};

export default handler;
