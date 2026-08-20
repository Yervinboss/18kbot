const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const configPath = path.join(__dirname, '..', 'database', 'welcome.json');
const mediaDir = path.join(__dirname, '..', 'database', 'media');

const loadConfig = () => {
    if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    return fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
};

const saveConfig = (data) => fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

module.exports = {
    name: 'welcome',
    description: 'Gestione automatica benvenuto',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        let config = loadConfig();
        
        // Testo di default automatico già pronto, così non devi impazzire
        if (!config[chatId]) {
            config[chatId] = { active: false, text: 'Benvenuto @user nel gruppo!', imagePath: null };
        }

        const subCommand = args[0] ? args[0].toLowerCase() : '';

        if (subCommand === 'on') {
            config[chatId].active = true;
            const customText = args.slice(1).join(' ');
            if (customText.trim()) {
                config[chatId].text = customText; // Se scrivi .welcome on [frase], imposta quella
            }
            await sock.sendMessage(chatId, { text: `✅ Benvenuto attivato automaticamente!\nMessaggio: "${config[chatId].text}"` });
        } else if (subCommand === 'off') {
            config[chatId].active = false;
            await sock.sendMessage(chatId, { text: '❌ Benvenuto disattivato.' });
        } else if (subCommand === 'setimage' || subCommand === 'setwelcomeimage') {
            const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            let targetMessage = m;
            
            if (quotedMessage && quotedMessage.imageMessage) {
                targetMessage = {
                    key: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: m.message.extendedTextMessage.contextInfo.stanzaId
                    },
                    message: quotedMessage
                };
            }

            const hasImage = targetMessage.message?.imageMessage;

            if (!hasImage) {
                await sock.sendMessage(chatId, { text: '⚠️ Manda o rispondi a un\'immagine con `.welcome setimage` per impostarla!' });
                return;
            }

            try {
                if (!fs.existsSync(mediaDir)) {
                    fs.mkdirSync(mediaDir, { recursive: true });
                }

                const buffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: sock.logger });
                const fileName = `welcome_${chatId.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
                const filePath = path.join(mediaDir, fileName);

                fs.writeFileSync(filePath, buffer);
                config[chatId].imagePath = filePath;

                await sock.sendMessage(chatId, { text: '🖼️ Immagine di benvenuto impostata con successo!' });
            } catch (err) {
                console.error('Errore salvataggio immagine welcome:', err);
                await sock.sendMessage(chatId, { text: '❌ Errore durante il salvataggio dell\'immagine.' });
            }
        } else {
            // Se scrivi direttamente una frase dopo .welcome (es. .welcome Benvenuti a tutti @user)
            const fullText = args.join(' ');
            if (fullText.trim()) {
                config[chatId].text = fullText;
                await sock.sendMessage(chatId, { text: `✨ Frase di benvenuto impostata:\n"${fullText}"` });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `📌 Comandi veloci:\n• \`.welcome on\` (attiva con testo automatico)\n• \`.welcome on [testo]\` (attiva con testo personalizzato)\n• \`.welcome off\` (disattiva)\n• \`.welcome setimage\` (sull'immagine)` 
                });
            }
        }
        
        saveConfig(config);
    }
};

