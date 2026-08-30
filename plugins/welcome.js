import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from '@realvare/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '..', 'database', 'welcome.json');
const mediaDir = path.join(__dirname, '..', 'database', 'media');

const loadConfig = () => {
    if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    return fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
};

const saveConfig = (data) => fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    let config = loadConfig();
    
    if (!config[jid]) {
        config[jid] = { active: false, text: 'Benvenuto @user nel gruppo!', imagePath: null };
    }

    let cmd = (command || '').toLowerCase().trim();
    let cleanText = (text || '').trim();

    if (cleanText.toLowerCase().startsWith('on')) {
        config[jid].active = true;
        let customText = cleanText.substring(2).trim();
        if (customText) {
            config[jid].text = customText.replace(/\\n/g, '\n');
        }
        saveConfig(config);
        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });
        return await conn.sendMessage(jid, { text: `🟢 *Sistema di benvenuto attivato!*\n📝 Frase impostata:\n\n${config[jid].text}` }, { quoted: m });
    } 
    
    else if (cleanText.toLowerCase() === 'off') {
        config[jid].active = false;
        saveConfig(config);
        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });
        return await conn.sendMessage(jid, { text: '🔴 *Sistema di benvenuto disattivato.*' }, { quoted: m });
    } 
    
    else if (cleanText.toLowerCase() === 'setimage' || cleanText.toLowerCase() === 'setwelcomeimage') {
        let quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let targetMessage = m;
        
        if (quotedMessage && quotedMessage.imageMessage) {
            targetMessage = {
                key: {
                    remoteJid: jid,
                    fromMe: false,
                    id: m.message.extendedTextMessage.contextInfo.stanzaId
                },
                message: quotedMessage
            };
        }

        let hasImage = targetMessage.message?.imageMessage;

        if (!hasImage) {
            return await conn.sendMessage(jid, { text: '⚠️ Rispondi a un\'immagine scrivendo \`.welcome setimage\` per impostarla!' }, { quoted: m });
        }

        try {
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
            }

            // Scarica l'immagine a cui hai risposto e la salva sul disco di Termux
            let buffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: conn.logger });
            let fileName = `welcome_${jid.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
            let filePath = path.join(mediaDir, fileName);

            fs.writeFileSync(filePath, buffer);
            config[jid].imagePath = filePath;
            saveConfig(config);

            await conn.sendMessage(jid, { react: { text: '🖼️', key: m.key } });
            return await conn.sendMessage(jid, { text: '🖼️ *Immagine di benvenuto configurata e salvata con successo!*' }, { quoted: m });
        } catch (err) {
            console.error('Errore salvataggio immagine:', err);
            return await conn.sendMessage(jid, { text: '❌ Errore interno durante il salvataggio della foto profilo.' }, { quoted: m });
        }
    } 
    
    else {
        let status = config[jid].active ? 'ATTIVO 🟢' : 'SPENTO 🔴';
        let infoLayout = `⚙️ *CONFIGURAZIONE BENVENUTO ZENO BOT*\n\n` +
                          `📊 Stato: *${status}*\n` +
                          `📝 Frase: "${config[jid].text}"\n\n` +
                          `📌 *Comandi:*\n` +
                          `• \`.welcome on\` [Attiva]\n` +
                          `• \`.welcome on [testo]\` [Imposta frase e attiva]\n` +
                          `• \`.welcome off\` [Disattiva]\n` +
                          `• \`.welcome setimage\` [Rispondi a una foto per salvarla]`;
        
        return await conn.sendMessage(jid, { text: infoLayout }, { quoted: m });
    }
};

handler.help = ['welcome'];
handler.tags = ['moderazione'];
handler.command = /^(welcome|benvenuto)$/i;

export default handler;
