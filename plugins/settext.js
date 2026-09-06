// plugins/settext.js - Imposta la chiave Genius da WhatsApp
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../text_config.json');

let handler = async (m, { conn, text, command }) => {
    const jid = m.key.remoteJid;

    if (!text) {
        return await conn.sendMessage(jid, {
            text: `⚙️ *IMPOSTA CHIAVE GENIUS*\n\n` +
                  `📌 *Uso:* .settext [chiave]\n\n` +
                  `📎 *Esempio:*\n` +
                  `.settext a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6\n\n` +
                  `💡 Ottieni la chiave su: https://genius.com/api-clients`
        }, { quoted: m });
    }

    const token = text.trim();

    if (token.length < 10) {
        return await conn.sendMessage(jid, {
            text: '❌ La chiave sembra troppo corta. Controlla di aver copiato tutto!'
        }, { quoted: m });
    }

    // Salva la chiave nel file JSON
    try {
        const data = { genius_token: token };
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');

        await conn.sendMessage(jid, {
            text: `✅ *Chiave Genius salvata con successo!*\n\n` +
                  `🔑 Token: ${token.slice(0, 10)}...${token.slice(-5)}\n\n` +
                  `📝 Ora puoi usare .text per cercare i testi!`
        }, { quoted: m });

        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('Errore salvataggio chiave:', e);
        await conn.sendMessage(jid, {
            text: '❌ Errore nel salvare la chiave. Riprova!'
        }, { quoted: m });
    }
};

handler.command = /^(settext|setkey|setgenius)$/i;
handler.help = ['settext'];
handler.tags = ['admin'];
handler.owner = true; // Solo l'owner può usarlo

export default handler;
