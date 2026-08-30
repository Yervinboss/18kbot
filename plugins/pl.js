import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { generateWAMessageContent } from '@realvare/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playlistDbPath = path.join(__dirname, '../playlist_db.json');
const plStatePath = path.join(__dirname, '../playlist_state.json');

const makeMessageID = () => {
    return 'ZENO' + crypto.randomBytes(8).toString('hex').toUpperCase();
};

const readDb = (p) => {
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {}; }
};

const writeDb = (p, data) => {
    try { fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8'); } catch (e) { console.error(`[DB Error] ${e}`); }
};

let handler = async (m, { conn, text, command }) => {
    let chatId = m.key.remoteJid;
    let sender = m.key.participant || m.participant || chatId;

    let buttonId = '';
    if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonReplyValue) {
        try {
            let jsonReply = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.buttonReplyValue);
            buttonId = jsonReply.id || jsonReply.rowId || '';
        } catch (e) {}
    }

    let action = (command || '').trim().toLowerCase();
    if (buttonId && buttonId.startsWith('pl_')) {
        action = buttonId.trim().toLowerCase();
    } else if (text && text.startsWith('pl_')) {
        action = text.trim().toLowerCase();
    }

    if (!fs.existsSync(playlistDbPath)) {
        return await conn.sendMessage(chatId, { text: '❌ La tua playlist (.PL) è vuota!' }, { quoted: m });
    }

    let plDb = readDb(playlistDbPath);
    let userTracks = plDb[sender] || [];

    if (userTracks.length === 0) {
        return await conn.sendMessage(chatId, { text: '❌ La tua playlist (.PL) è vuota!' }, { quoted: m });
    }

    let stateDb = readDb(plStatePath);
    if (stateDb[sender] === undefined) stateDb[sender] = 0;
    let currentIndex = stateDb[sender];

    if (action === 'pl_next') {
        currentIndex = (currentIndex + 1) % userTracks.length;
        stateDb[sender] = currentIndex;
        writeDb(plStatePath, stateDb);
    } else if (action === 'pl_prev') {
        currentIndex = (currentIndex - 1 + userTracks.length) % userTracks.length;
        stateDb[sender] = currentIndex;
        writeDb(plStatePath, stateDb);
    } else if (action === 'pl_del') {
        userTracks.splice(currentIndex, 1);
        plDb[sender] = userTracks;
        writeDb(playlistDbPath, plDb);

        if (userTracks.length === 0) {
            return await conn.sendMessage(chatId, { text: '🗑️ Playlist svuotata con successo!' }, { quoted: m });
        }
        currentIndex = currentIndex >= userTracks.length ? userTracks.length - 1 : currentIndex;
        stateDb[sender] = currentIndex;
        writeDb(plStatePath, stateDb);
    } else if (action === 'pl_play') {
        let track = userTracks[currentIndex];
        if (!track || !track.url) return await conn.sendMessage(chatId, { text: '❌ Traccia non valida.' }, { quoted: m });

        await conn.sendMessage(chatId, { react: { text: '🎧', key: m.key } });

        let timestamp = Date.now();
        let inputMp3 = path.join(__dirname, `_temp_pl_${timestamp}.mp3`);
        let outputOgg = path.join(__dirname, `vocale_pl_${timestamp}.ogg`);

        let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 128k --no-part --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${track.url}"`;

        exec(yt_command, async (error) => {
            if (error) {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);
                return await conn.sendMessage(chatId, { text: '❌ Errore durante il download da YouTube.' }, { quoted: m });
            }

            let ffmpeg_command = `ffmpeg -y -i "${inputMp3}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 -threads 0 -f ogg "${outputOgg}"`;

            exec(ffmpeg_command, async (err2) => {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);

                if (err2 || !fs.existsSync(outputOgg)) {
                    if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                    return await conn.sendMessage(chatId, { text: '❌ Errore durante la conversione audio.' }, { quoted: m });
                }

                try {
                    let audioBuffer = fs.readFileSync(outputOgg);
                    await conn.sendMessage(chatId, {
                        audio: audioBuffer,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, { quoted: m });
                } catch (e) {
                    console.error(e);
                } finally {
                    setTimeout(() => { if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg); }, 5000);
                }
            });
        });
        return;
    }

    let track = userTracks[currentIndex];
    let txt = `🎶 *ZENO MUSIC PLAYER (.PL)* 🎶\n\n` +
              `📌 *Brano ${currentIndex + 1} di ${userTracks.length}*\n` +
              `🎵 *Titolo:* ${track.title || 'Sconosciuto'}\n` +
              `⏱️ *Durata:* ${track.duration || '--:--'}\n` +
              `🔗 ${track.url}`;

    let match = track.url ? track.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/) : null;
    let imageUrl = match && match[1] ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;

    let nativeFlowButtons = [
        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "⬅️ Indietro", id: "pl_prev" }) },
        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎵 Ascolta", id: "pl_play" }) },
        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "➡️ Avanti", id: "pl_next" }) },
        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🗑️ Rimuovi", id: "pl_del" }) }
    ];

    // Costruiamo l'header con l'immagine incorporata (un solo messaggio,
    // niente piu' foto separata prima del pannello) usando
    // generateWAMessageContent per caricare/preparare il media come
    // farebbe normalmente sendMessage con { image: ... }.
    let header = { title: '', hasMediaAttachment: false };

    if (imageUrl) {
        try {
            let response = await fetch(imageUrl);
            let buffer = Buffer.from(await response.arrayBuffer());

            let generated = await generateWAMessageContent(
                { image: buffer },
                { upload: conn.waUploadToServer }
            );

            if (generated?.imageMessage) {
                header = {
                    title: '',
                    hasMediaAttachment: true,
                    imageMessage: generated.imageMessage
                };
            }
        } catch (e) {
            console.error('Errore preparazione immagine header pl.js:', e.message);
        }
    }

    let interactivePayload = {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: header,
                    body: { text: txt },
                    footer: { text: `⚡ Zeno Bot - Playlist Interattiva` },
                    nativeFlowMessage: {
                        buttons: nativeFlowButtons
                    }
                }
            }
        }
    };

    if (buttonId && m.quoted) {
        let keyToDelete = m.quoted?.vM?.key || m.key;
        if (m.message?.extendedTextMessage?.contextInfo?.stanzaId) {
            keyToDelete = {
                remoteJid: chatId,
                id: m.message.extendedTextMessage.contextInfo.stanzaId,
                fromMe: m.message.extendedTextMessage.contextInfo.participant === conn.user.jid,
                participant: m.message.extendedTextMessage.contextInfo.participant
            };
        }
        try { await conn.sendMessage(chatId, { delete: keyToDelete }); } catch (e) {}
    }

    await conn.relayMessage(chatId, interactivePayload, { messageId: makeMessageID() });
};

handler.command = /^(pl|pl_next|pl_prev|pl_play|pl_del)$/i;

handler.all = async function (m, { conn }) {
    if (m.isBaileys || !m.message) return;

    let buttonId = '';
    if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonReplyValue) {
        try {
            let jsonReply = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.buttonReplyValue);
            buttonId = jsonReply.id || jsonReply.rowId || '';
        } catch (e) {}
    }

    if (buttonId && buttonId.startsWith('pl_')) {
        return await this.plugins['pl.js'].handler(m, { conn, text: buttonId, command: '' });
    }
};

handler.help = ['pl'];
handler.tags = ['downloader'];

export default handler;

