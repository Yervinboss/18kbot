import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBAPP_URL = 'https://reservoir-permit-zen-presented.trycloudflare.com';

// Mappa globale dei token in attesa (condivisa con webapp-server.js)
global.pendingTokens = global.pendingTokens || {};

function generaToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let t = 'ZENO-';
    for (let i = 0; i < 6; i++) t += chars[Math.floor(Math.random() * chars.length)];
    return t;
}

let handler = async (m, { conn }) => {
    const jid = m.key.remoteJid;
    const sender = m.key.participant || m.participant || jid;
    const phone = sender.split('@')[0].split(':')[0];

    // Pulizia token scaduti (più vecchi di 10 minuti)
    const now = Date.now();
    for (const [tok, data] of Object.entries(global.pendingTokens)) {
        if (now - data.createdAt > 10 * 60 * 1000) delete global.pendingTokens[tok];
    }

    const token = generaToken();
    global.pendingTokens[token] = { phone, createdAt: now, sender };

    const messaggio =
        `🎵 *ZENO MUSIC* 🎶\n\n` +
        `Ciao! Vuoi ascoltare la musica insieme a me? 🎧\n\n` +
        `🔑 *IL TUO TOKEN DI ACCESSO:*\n` +
        `\`${token}\`\n\n` +
        `📱 *Vai qui:* ${WEBAPP_URL}\n\n` +
        `*PASSI:*\n` +
        `1️⃣ Registrati con nome utente + password\n` +
        `2️⃣ Quando ti chiede il *token*, incolla:\n` +
        `   \`${token}\`\n` +
        `3️⃣ Fai login e cerca la tua canzone! 🔍\n\n` +
        `⚠️ Il token scade tra *10 minuti*.\n` +
        `_Buon ascolto!_ 🎶`;

    await conn.sendMessage(jid, { text: messaggio }, { quoted: m });
};

handler.command = /^mix$/i;
handler.help = ['mix'];
handler.tags = ['music'];

export default handler;
