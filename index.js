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

    // Caricamento dei plugin dalla cartella 'plugins'
    sock.commands = new Map();
    const pluginsPath = path.join(__dirname, 'plugins');

    if (fs.existsSync(pluginsPath)) {
        const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
        let loadedCount = 0; // Contatore iniziale dei plugin

        for (const file of pluginFiles) {
            const filePath = path.join(pluginsPath, file);
            const plugin = require(filePath);
            if ('name' in plugin && 'execute' in plugin) {
                sock.commands.set(plugin.name, plugin);
                loadedCount++; // Incrementa per ogni plugin valido
            }
        }
        // Stampa un'unica riga pulita con il totale dei plugin
        console.log(`[⚡] 18K System: Caricati con successo ${loadedCount} plugin!`);
    }

    sock.ev.on('creds.update', saveCreds);

    // Gestione della connessione e del QR code
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

    // Gestione dei messaggi e dei comandi
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message || m.key.fromMe) return;

        // CONTROLLO BLACKLIST INTERNA SINGOLO E SICURO
        try {
            const blacklistPath = path.join(__dirname, 'blacklist.json');
            if (fs.existsSync(blacklistPath)) {
                const blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
                const messageSender = m.key.participant || m.key.remoteJid;
                
                if (messageSender && typeof messageSender === 'string') {
                    const isBlocked = blacklist.includes(messageSender) || blacklist.some(id => {
                        return id && typeof id === 'string' && messageSender.includes(id.split('@')[0]);
                    });
                    if (isBlocked) return; // Ignora l'utente e non calcolarlo!
                }
            }
        } catch (e) {
            console.error('Errore blacklist:', e.message);
        }

        // // ---> AGGIUNGI QUESTO CICLO QUI <---
        // Fa scorrere tutti i plugin per vedere se ce n'è uno in ascolto (es. il gioco della bandiera)
        for (let plugin of sock.commands.values()) {
            if (typeof plugin.handleMessage === 'function') {
                await plugin.handleMessage(sock, m);
            }
        }

        const messageContent = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!messageContent || !messageContent.startsWith('.')) return;

        const args = messageContent.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // STAMPA IL COMANDO RICEVUTO SUL TERMINALE DI TERMUX CON LA TUA GRAFICA ORIGINALe
        console.log(`📥 [MSG] Da: ${m.key.remoteJid} -> Comando digitato: .${commandName} ${args.join(' ')}`);

        const command = sock.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(sock, m, args);
        } catch (error) {
            console.error(`Errore nell'esecuzione del plugin ${commandName}:`, error);
        }
    });
}

startBot();
