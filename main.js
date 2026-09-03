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
        if (file.endsWith('.js')) {
            try {
                let filePath = path.join(pluginFolder, file);
                let module = await import(`${pathToFileURL(filePath)}?update=${Date.now()}`);
                plugins[file] = module.default;

                if (typeof module.messageHook === 'function') {
                    plugins[file].messageHook = module.messageHook;
                }

                if (!global.zenoPluginsList) global.zenoPluginsList = [];
                global.zenoPluginsList = global.zenoPluginsList.filter(p => p.file !== file);
                global.zenoPluginsList.push({
                    file,
                    tags: module.default.tags || ['altro'],
                    help: module.default.help || []
                });

                loadedCount++;
            } catch (e) {
                failedCount++;
                console.log(chalk.red(`[Errore Plugin] ${file}: ${e.message}`));
            }
        }
    }

    console.log(chalk.green(`🟢 Caricati con successo ${loadedCount} comandi plugin!`));
    if (failedCount > 0) {
        console.log(chalk.yellow(`⚠️ ${failedCount} plugin non caricati (vedi errori sopra)`));
    }
}

async function startZenoBot() {
    await loadPlugins();
    const { state, saveCreds } = await useMultiFileAuthState('sessions');

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
                console.log(chalk.red(`[!] Connessione chiusa (codice: ${reason}), riavvio in corso...`));
                startZenoBot();
            }
        } else if (connection === 'open') {
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

            const groupMetadata = await conn.groupMetadata(jid).catch(() => null);
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
                    let res = await fetch(profileLink).catch(() => null);
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

            if (budy.toLowerCase().includes('ping') && !budy.startsWith('.')) budy = '.ping';
            if (budy.toLowerCase().includes('menu') && !budy.startsWith('.')) budy = '.menu';

            let customPrefix = getPrefix();
            let prefix = budy.startsWith(customPrefix)
                ? customPrefix
                : (/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&*.\\/\\#]/.test(budy) ? budy[0] : '');
            let isCmd = budy.startsWith(prefix);
            let cmdPart = isCmd ? budy.slice(prefix.length).trim().split(' ') : budy.split(' ');
            let command = (cmdPart && cmdPart.length > 0) ? cmdPart[0].toLowerCase() : '';

            let jidCorrente = m.key.remoteJid;
            let senderCorrente = m.key.participant || m.key.remoteJid;

            if (jidCorrente.endsWith('@g.us') && isSoloAdminActive(jidCorrente)) {
                let isToggleCommand = command === 'soloadminon' || command === 'soloadminoff';
                if (!isToggleCommand && !isOwner(senderCorrente)) {
                    let groupMetadata = await conn.groupMetadata(jidCorrente).catch(() => null);
                    let senderPure = senderCorrente.replace(/[^0-9]/g, '');
                    let senderIsAdmin = groupMetadata?.participants?.find(p => p.id.replace(/[^0-9]/g, '') === senderPure && p.admin);
                    if (!senderIsAdmin) return;
                }
            }

            for (let name in plugins) {
                let plugin = plugins[name];
                if (plugin.command && plugin.command.test(command)) {
                    let extra = { conn, text: budy.slice(prefix.length + command.length).trim(), command };
                    await plugin(m, extra);
                }
            }
        } catch (e) {
            console.error(e);
        }
    });
}

startZenoBot();
