import { makeWASocket, useMultiFileAuthState } from '@realvare/baileys';
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

// Cache metadata gruppi (per evitare troppe chiamate a conn.groupMetadata)
const groupMetadataCache = new Map(); // jid -> { data, ts }
const GROUP_METADATA_TTL = 5 * 60 * 1000; // 5 minuti

let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60_000; // 1 minuto

process.on('unhandledRejection', (reason) => {
    console.log(chalk.red('[!] Promise non gestita (il bot resta acceso):'), reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.log(chalk.red('[!] Eccezione non gestita (il bot resta acceso):'), err?.message || err);
});

async function loadPlugins() {
    if (!fs.existsSync(pluginFolder)) {
        fs.mkdirSync(pluginFolder, { recursive: true });
    }
    const files = fs.readdirSync(pluginFolder);
    let loadedCount = 0;
    let failedCount = 0;

    for (let file of files) {
        if (!file.endsWith('.js')) continue;

        try {
            let filePath = path.join(pluginFolder, file);
            let module = await import(`${pathToFileURL(filePath)}?update=${Date.now()}`);

            // Validazione: un plugin deve esportare una funzione come default
            if (typeof module.default !== 'function') {
                throw new Error(`export default mancante o non è una funzione (trovato: ${typeof module.default})`);
            }

            plugins[file] = module.default;

            if (typeof module.messageHook === 'function') {
                plugins[file].messageHook = module.messageHook;
            }

            // Ricava il nome comando vero dal primo alias della regex (es. "song" da /^(song|play)$/i)
            let cmdName = file;
            if (module.default.command?.source) {
                let firstAlias = module.default.command.source
                    .replace(/[\^$()]/g, '')
                    .split('|')[0];
                if (firstAlias) cmdName = firstAlias;
            }

            if (!global.zenoPluginsList) global.zenoPluginsList = [];
            global.zenoPluginsList = global.zenoPluginsList.filter(p => p.file !== file);
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
        }
    }

    console.log(chalk.green(`🟢 Caricati con successo ${loadedCount} comandi plugin!`));
    if (failedCount > 0) {
        console.log(chalk.yellow(`⚠️ ${failedCount} plugin non caricati (vedi errori sopra)`));
    }
}

// Fetch con timeout, per non restare mai appesi su host lenti/morti
async function fetchWithTimeout(url, ms = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { signal: controller.signal });
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

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
    const authPromise = useMultiFileAuthState(SESSION_PATH);

    authPromise.then(async ({ state, saveCreds }) => {
        const conn = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: (await import('pino')).default({ level: 'silent' })
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
                    process.exit(1);
                } else {
                    reconnectAttempts++;
                    const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
                    console.log(chalk.red(`[!] Connessione chiusa (codice: ${reason}), riconnessione tra ${delay / 1000}s (tentativo ${reconnectAttempts})...`));
                    setTimeout(() => initSocket(), delay);
                }
            } else if (connection === 'open') {
                reconnectAttempts = 0;
                console.log(chalk.green('\n✓ Zeno Bot connesso a WhatsApp con successo!\n'));
            }
        });

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('group-participants.update', async (anu) => {
            try {
                if (anu.action !== 'add') return;

                const jid = anu.id;
                const welcomeDbPath = path.resolve('database/welcome.json');
                if (!fs.existsSync(welcomeDbPath)) return;

                const db = JSON.parse(fs.readFileSync(welcomeDbPath, 'utf-8'));
                if (!db[jid] || !db[jid].enabled) return;

                const groupMetadata = await getGroupMetadataCached(conn, jid);
                const groupName = groupMetadata ? groupMetadata.subject : 'Gruppo';

                for (let num of anu.participants) {
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    let userId = num.replace(/[^0-9]/g, '');
                    let userIdJid = num.includes('@') ? num : num + '@s.whatsapp.net';

                    let msgText = db[jid].message.replace(/@user/g, '').trim() + ' @' + userId;

                    let profileLink = null;
                    try {
                        let pfp = await conn.profilePictureUrl(userIdJid, 'image').catch(() => null);
                        if (pfp) profileLink = pfp;
                    } catch (e) {}

                    if (!profileLink) {
                        profileLink = `https://ui-avatars.com/api/?name=WA&size=512&background=random&bold=true`;
                    }

                    let thumbBuffer = null;
                    try {
                        let res = await fetchWithTimeout(profileLink);
                        if (res && res.ok && res.headers.get('content-type')?.startsWith('image/')) {
                            let arrayBuffer = await res.arrayBuffer();
                            thumbBuffer = Buffer.from(arrayBuffer);
                        }
                    } catch (e) {}

                    await conn.sendMessage(jid, {
                        text: msgText,
                        contextInfo: {
                            mentionedJid: [userIdJid],
                            externalAdReply: {
                                title: `✨ Benvenuto in ${groupName}`,
                                body: `Sei il membro numero ${groupMetadata?.participants?.length || 'nuovo'}`,
                                previewType: 'PHOTO',
                                thumbnail: thumbBuffer,
                                jpegThumbnail: thumbBuffer,
                                sourceUrl: 'https://wa.me/' + userId,
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    });
                }
            } catch (e) {
                console.error('Errore nel sistema Welcome automatico:', e);
            }
        });

        conn.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                let m = chatUpdate.messages[0];
                if (!m.message) return;
                if (m.key.fromMe) return;

                m.chat = m.key.remoteJid;
                m.sender = m.key.participant || m.key.remoteJid;

                // Ignora status/broadcast e chat non rilevanti
                if (m.chat === 'status@broadcast') return;

                if (!global.processedMessages) global.processedMessages = new Set();
                if (global.processedMessages.has(m.key.id)) return;
                global.processedMessages.add(m.key.id);
                if (global.processedMessages.size > 500) {
                    global.processedMessages = new Set([...global.processedMessages].slice(-250));
                }

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

                let msg = m.message;
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

                if (!isCmd && !isInteractiveResponse) {
                    return;
                }

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

                if (jidCorrente.endsWith('@g.us') && isSoloAdminActive(jidCorrente)) {
                    let isToggleCommand = command === 'soloadminon' || command === 'soloadminoff';
                    if (!isToggleCommand && !isOwner(senderCorrente)) {
                        let groupMetadata = await getGroupMetadataCached(conn, jidCorrente);
                        let senderPure = senderCorrente.replace(/[^0-9]/g, '');
                        let senderIsAdmin = groupMetadata?.participants?.find(p => p.id.replace(/[^0-9]/g, '') === senderPure && p.admin);
                        if (!senderIsAdmin) return;
                    }
                }

                for (let name in plugins) {
                    let plugin = plugins[name];
                    if (plugin.command && plugin.command.test(command)) {
                        try {
                            let extra = { conn, text: textArg, command };
                            await plugin(m, extra);
                        } catch (e) {
                            console.error(`Errore nel plugin "${name}" (comando "${command}"):`, e);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        });
    }).catch((e) => {
        console.error(chalk.red('[!] Errore inizializzazione socket, riprovo tra 5s:'), e);
        setTimeout(() => initSocket(), 5000);
    });
}

async function startZenoBot() {
    await loadPlugins();
    initSocket();
}

// Chiusura pulita
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n[!] Arresto richiesto (SIGINT), chiudo Zeno Bot...'));
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n[!] Arresto richiesto (SIGTERM), chiudo Zeno Bot...'));
    process.exit(0);
});

startZenoBot();
