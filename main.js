import { makeWASocket, useMultiFileAuthState } from '@itsliaaa/baileys';
import { Boom } from '@hapi/boom';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { isSoloAdminActive } from './plugins/soloadmin.js';
import { isOwner } from './plugins/owner.js';
import { getPrefix } from './plugins/prefix.js';

const plugins = {};
const pluginFolder = path.resolve('plugins');
const SESSION_PATH = process.env.ZENO_SESSION_PATH || 'sessions';
const LOG_DIR = path.resolve('logs');

// Cache metadati gruppi con TTL (5 minuti)
const groupMetadataCache = new Map(); 
const GROUP_METADATA_TTL = 5 * 60 * 1000; 

// Cooldown utenti per anti-spam (sender -> timestamp)
const userCooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 secondi

let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60_000; // 1 minuto

// Sistema di Logging Avanzato su File
function logToFile(type, text) {
    try {
        if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
        const logFile = path.join(LOG_DIR, 'zenobot.log');
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${type.toUpperCase()}] ${text}\n`;
        fs.appendFileSync(logFile, logLine, 'utf-8');
    } catch (e) {
        // Fallback silenzioso
    }
}

// Scrittura Atomica JSON (Evita corruzione database)
global.saveJsonAtomic = function(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
};

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || reason;
    console.log(chalk.red('[!] Promise non gestita (il bot resta acceso):'), msg);
    logToFile('error', `Unhandled Rejection: ${msg}`);
});

process.on('uncaughtException', (err) => {
    const msg = err?.message || err;
    console.log(chalk.red('[!] Eccezione non gestita (il bot resta acceso):'), msg);
    logToFile('error', `Uncaught Exception: ${msg}`);
});

// Caricamento Dinamico dei Plugin (Supporta Hot-Reload)
async function loadPlugins() {
    if (!fs.existsSync(pluginFolder)) {
        fs.mkdirSync(pluginFolder, { recursive: true });
    }
    
    Object.keys(plugins).forEach(key => delete plugins[key]);
    if (global.zenoPluginsList) global.zenoPluginsList = [];

    const files = fs.readdirSync(pluginFolder);
    let loadedCount = 0;
    let failedCount = 0;

    for (let file of files) {
        if (!file.endsWith('.js')) continue;

        try {
            let filePath = path.join(pluginFolder, file);
            let module = await import(`${pathToFileURL(filePath)}?update=${Date.now()}`);

            if (typeof module.default !== 'function') {
                throw new Error(`export default mancante o non è una funzione (trovato: ${typeof module.default})`);
            }

            plugins[file] = module.default;

            if (typeof module.messageHook === 'function') {
                plugins[file].messageHook = module.messageHook;
            }

            let cmdName = file;
            if (module.default.command?.source) {
                let firstAlias = module.default.command.source
                    .replace(/[\^$()]/g, '')
                    .split('|')[0];
                if (firstAlias) cmdName = firstAlias;
            }

            if (!global.zenoPluginsList) global.zenoPluginsList = [];
            global.zenoPluginsList.push({
                file,
                name: cmdName,
                desc: module.default.desc || '',
                tags: module.default.tags || ['altro'],
                help: module.default.help || []
            });

            loadedCount++;
        } catch (e) {
            failedCount++;
            console.log(chalk.red(`[Errore Plugin] ${file}: ${e.message}`));
            logToFile('error', `Plugin Error [${file}]: ${e.message}`);
        }
    }

    console.log(chalk.green(`🟢 Caricati con successo ${loadedCount} comandi plugin!`));
    logToFile('info', `Caricati con successo ${loadedCount} comandi plugin (${failedCount} falliti).`);
    if (failedCount > 0) {
        console.log(chalk.yellow(`⚠️ ${failedCount} plugin non caricati (vedi errori sopra)`));
    }
}

// Recupero metadati con cache attiva
async function getGroupMetadataCached(conn, jid) {
    const cached = groupMetadataCache.get(jid);
    if (cached && (Date.now() - cached.ts) < GROUP_METADATA_TTL) {
        return cached.data;
    }
    const data = await conn.groupMetadata(jid).catch(() => null);
    if (data) groupMetadataCache.set(jid, { data, ts: Date.now() });
    return data;
}

function initSocket() {
    useMultiFileAuthState(SESSION_PATH).then(async ({ state, saveCreds }) => {
        const conn = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: (await import('pino')).default({ level: 'silent' }),
            // Salvagente crittografico per evitare il blocco "In attesa del messaggio" nei gruppi
            getMessage: async (key) => {
                return {
                    conversation: "ZenoBot sync message"
                };
            }
        });

        conn.plugins = plugins;

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                console.log(chalk.yellow('\n[!] Scansiona questo QR Code con WhatsApp:\n'));
            }
            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                if (reason === 401) {
                    console.log(chalk.red('[!] Sessione invalidata (401). Cancella la cartella sessions e riscansiona il QR.'));
                    logToFile('error', 'Sessione invalidata (401).');
                    process.exit(1);
                } else {
                    reconnectAttempts++;
                    const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
                    console.log(chalk.red(`[!] Connessione chiusa (codice: ${reason}), riconnessione tra ${delay / 1000}s (tentativo ${reconnectAttempts})...`));
                    logToFile('warn', `Connessione chiusa (codice: ${reason}), riconnessione tra ${delay / 1000}s.`);
                    setTimeout(() => initSocket(), delay);
                }
            } else if (connection === 'open') {
                reconnectAttempts = 0;
                console.log(chalk.green('\n✓ Zeno Bot connesso a WhatsApp con successo!\n'));
                logToFile('info', 'Zeno Bot connesso a WhatsApp con successo.');
            }
        });

        conn.ev.on('creds.update', saveCreds);

        // Gestione messaggi in arrivo
        conn.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                let m = chatUpdate.messages[0];
                if (!m.message) return;
                if (m.key.fromMe) return;

                let msg = m.message;

                // Filtro anti-blocco: ignora messaggi di servizio di cifratura che causano "In attesa del messaggio"
                if (msg.protocolMessage || msg.senderKeyDistributionMessage) {
                    return;
                }

                m.chat = m.key.remoteJid;
                m.sender = m.key.participant || m.key.remoteJid;

                if (m.chat === 'status@broadcast') return;

                // Prevenzione Memory Leak per i messaggi processati
                if (!global.processedMessages) global.processedMessages = new Set();
                if (global.processedMessages.has(m.key.id)) return;
                global.processedMessages.add(m.key.id);
                if (global.processedMessages.size > 500) {
                    const iterator = global.processedMessages.values();
                    for (let i = 0; i < 250; i++) {
                        global.processedMessages.delete(iterator.next().value);
                    }
                }

                // Esecuzione messageHooks dei plugin
                for (let name in plugins) {
                    let plugin = plugins[name];
                    if (typeof plugin.messageHook === 'function') {
                        try {
                            await plugin.messageHook(conn, m);
                        } catch (e) {
                            console.error(`Errore messageHook in ${name}:`, e);
                        }
                    }
                }

                let body = '';

                if (msg.conversation) {
                    body = msg.conversation;
                } else if (msg.extendedTextMessage) {
                    body = msg.extendedTextMessage.text;
                } else if (msg.buttonsResponseMessage) {
                    body = msg.buttonsResponseMessage.selectedButtonId;
                } else if (msg.templateButtonReplyMessage) {
                    body = msg.templateButtonReplyMessage.selectedId;
                } else if (msg.listResponseMessage) {
                    body = msg.listResponseMessage.singleSelectReply.selectedRowId;
                } else if (msg.interactiveResponseMessage) {
                    let interactive = msg.interactiveResponseMessage;
                    if (interactive.nativeFlowResponseMessage?.paramsJson) {
                        try {
                            let parsedValue = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson);
                            body = parsedValue.id || parsedValue.rowId || '';
                        } catch (e) {
                            body = '';
                        }
                    }
                }

                if (!body && msg.buttonsResponseMessage) {
                    body = msg.buttonsResponseMessage.selectedDisplayText;
                }

                if (!body) return;
                let budy = body.trim();

                let customPrefix = getPrefix();
                let prefix = '';

                if (budy.startsWith(customPrefix)) {
                    prefix = customPrefix;
                } else {
                    let firstChar = budy[0];
                    if (/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&*.\\/\\#]/.test(firstChar)) {
                        prefix = firstChar;
                    }
                }

                let isCmd = prefix !== '' && budy.startsWith(prefix);
                let isInteractiveResponse = Boolean(
                    msg.buttonsResponseMessage ||
                    msg.templateButtonReplyMessage ||
                    msg.listResponseMessage ||
                    msg.interactiveResponseMessage
                );

                if (!isCmd && !isInteractiveResponse) return;

                let command = '';
                let textArg = '';

                if (isCmd) {
                    let cmdPart = budy.slice(prefix.length).trim().split(' ');
                    command = cmdPart[0].toLowerCase();
                    textArg = budy.slice(prefix.length + command.length).trim();
                } else if (isInteractiveResponse) {
                    command = budy.toLowerCase();
                    textArg = '';
                }

                let jidCorrente = m.key.remoteJid;
                let senderCorrente = m.key.participant || m.key.remoteJid;

                // Gestione Comando Hot-Reload (.reload) riservato all'owner
                if (command === 'reload' && isOwner(senderCorrente)) {
                    await loadPlugins();
                    await conn.sendMessage(jidCorrente, { text: '🟢 Tutti i plugin sono stati ricaricati con successo a caldo!' }, { quoted: m });
                    return;
                }

                // Controllo Anti-Spam / Cooldown (esclude l'owner)
                if (!isOwner(senderCorrente)) {
                    const lastTime = userCooldowns.get(senderCorrente) || 0;
                    const now = Date.now();
                    if (now - lastTime < COOLDOWN_TIME) {
                        return; // Ignora silenziosamente lo spam
                    }
                    userCooldowns.set(senderCorrente, now);
                }

                // Controllo SoloAdmin
                if (jidCorrente.endsWith('@g.us') && isSoloAdminActive(jidCorrente)) {
                    let isToggleCommand = command === 'soloadminon' || command === 'soloadminoff';
                    if (!isToggleCommand && !isOwner(senderCorrente)) {
                        let groupMetadata = await getGroupMetadataCached(conn, jidCorrente);
                        let senderPure = senderCorrente.replace(/[^0-9]/g, '');
                        let senderIsAdmin = groupMetadata?.participants?.find(p => p.id.replace(/[^0-9]/g, '') === senderPure && p.admin);
                        if (!senderIsAdmin) return;
                    }
                }

                // Esecuzione dei comandi plugin
                for (let name in plugins) {
                    let plugin = plugins[name];
                    if (plugin.command && plugin.command.test(command)) {
                        try {
                            let extra = { conn, text: textArg, command };
                            await plugin(m, extra);
                        } catch (e) {
                            console.error(`Errore nel plugin "${name}" (comando "${command}"):`, e);
                            logToFile('error', `Plugin Execution Error [${name} / ${command}]: ${e.message}`);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        });
    }).catch((e) => {
        console.error(chalk.red('[!] Errore inizializzazione socket, riprovo tra 5s:'), e);
        logToFile('error', `Socket Init Error: ${e.message}`);
        setTimeout(() => initSocket(), 5000);
    });
}

async function startZenoBot() {
    await loadPlugins();
    initSocket();
}

// Chiusura pulita dei processi
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n[!] Arresto richiesto (SIGINT), chiudo Zeno Bot...'));
    logToFile('info', 'Arresto richiesto (SIGINT).');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n[!] Arresto richiesto (SIGTERM), chiudo Zeno Bot...'));
    logToFile('info', 'Arresto richiesto (SIGTERM).');
    process.exit(0);
});

startZenoBot();
