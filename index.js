const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.commands = new Map();
    const pluginsPath = path.join(__dirname, 'plugins');

    if (fs.existsSync(pluginsPath)) {
        const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
        let loadedCount = 0;

        for (const file of pluginFiles) {
            const filePath = path.join(pluginsPath, file);
            const plugin = require(filePath);
            if ('name' in plugin && 'execute' in plugin) {
                sock.commands.set(plugin.name, plugin);
                loadedCount++;
            }
        }
        console.log(`[⚡] 18K System: Caricati con successo ${loadedCount} plugin!`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('Scansiona questo QR code con WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const rimaniSpento = reason === DisconnectReason.loggedOut;
            
            if (!rimaniSpento) {
                console.log('Connessione persa. Riavvio in corso...');
                setTimeout(() => startBot(), 3000);
            } else {
                console.log('❌ Sessione chiusa dal telefono (Logged Out).');
            }
        } else if (connection === 'open') {
            console.log('Bot WhatsApp connesso con successo tramite plugin! 🚀');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message) return;

        try {
            const blacklistPath = path.join(__dirname, 'blacklist.json');
            if (fs.existsSync(blacklistPath)) {
                const blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
                const messageSender = m.key.participant || m.key.remoteJid;
                
                if (messageSender && typeof messageSender === 'string') {
                    const isBlocked = blacklist.includes(messageSender) || blacklist.some(id => {
                        return id && typeof id === 'string' && messageSender.includes(id.split('@')[0]);
                    });
                    if (isBlocked) return;
                }
            }
        } catch (e) {
            console.error('Errore blacklist:', e.message);
        }

        // CICLO FONDAMENTALE PER IL MUTE IN TEMPO REALE
        for (let plugin of sock.commands.values()) {
            if (typeof plugin.handleMessage === 'function') {
                try {
                    await plugin.handleMessage(sock, m);
                } catch (err) {
                    console.error('Errore handleMessage plugin:', err);
                }
            }
        }

        const messageContent = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!messageContent || !messageContent.startsWith('.')) return;

        const args = messageContent.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        console.log(`📥 [MSG] Da: ${m.key.remoteJid} -> Comando digitato: .${commandName} ${args.join(' ')}`);

        const command = sock.commands.get(commandName);
        if (!command) return;

        // 👇 INCOLLA IL BLOCCO ESATTAMENTE QUI, PRIMA DEL TRY 👇
        const chatId = m.key.remoteJid;
        if (global.botSoloAdmin && global.botSoloAdmin.get(chatId) === true) {
            const ownerId = '129601359589600';
            const sender = m.key.participant || m.key.remoteJid;
            const senderClean = sender.replace(/[^0-9]/g, '');
            const isOwner = sender.includes(ownerId) || senderClean.includes(ownerId);
            
            if (!isOwner && chatId.endsWith('@g.us')) {
                try {
                    const groupMetadata = await sock.groupMetadata(chatId, true);
                    const esecutore = groupMetadata.participants.find(p => p.id === sender);
                    const isAdmin = esecutore?.admin === 'admin' || esecutore?.admin === 'superadmin';
                    if (!isAdmin) return; // Se non è admin lo gosta
                } catch (e) {
                    console.error(e);
                }
            }
        }
        // 👆 FINE DEL BLOCCO DA INCOLLARE 👆
        try {
            await command.execute(sock, m, args);
        } catch (error) {
            console.error(`Errore nell'esecuzione del plugin ${commandName}:`, error);
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            const chatId = update.id;
            const configPath = path.join(__dirname, 'database', 'welcome.json');
            
            if (fs.existsSync(configPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (config[chatId] && config[chatId].active) {
                        const newUser = update.participants[0];
                        const userJid = typeof newUser === 'string' ? newUser : (newUser.id || newUser.jid || String(newUser));
                        const numeroPulito = userJid.split('@')[0];
                        
                        let welcomeText = config[chatId].text;
                        if (!welcomeText.includes(`@${numeroPulito}`)) {
                            welcomeText += ` @${numeroPulito}`;
                        }
                        
                        let messagePayload = {
                            text: welcomeText,
                            mentions: [userJid]
                        };

                        if (config[chatId].imagePath && fs.existsSync(config[chatId].imagePath)) {
                            const imageBuffer = fs.readFileSync(config[chatId].imagePath);
                            messagePayload = {
                                image: imageBuffer,
                                caption: welcomeText,
                                mentions: [userJid]
                            };
                        }

                        await sock.sendMessage(chatId, messagePayload);
                    }
                } catch (err) {
                    console.error('[ERRORE WELCOME]:', err.message);
                }
            }
        }
    });
}

startBot();
