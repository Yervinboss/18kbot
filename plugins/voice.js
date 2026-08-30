import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import pkg from '@realvare/baileys';
const { downloadMediaMessage, proto } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let handler = async (m, { conn, text }) => {
    let chatId = m.key.remoteJid;

    // Struttura corretta per intercettare il messaggio citato (quoted)
    let q = m.quoted ? m.quoted : m;
    
    // Estrazione pulita del tipo MIME
    let mime = (q.msg || q).mimetype || q.mediaType || '';
    if (q.message) {
        const messageType = Object.keys(q.message);
        if (q.message[messageType]?.mimetype) {
            mime = q.message[messageType].mimetype;
        }
    }

    if (!mime && (q.msg?.audioMessage || q.audioMessage)) {
        mime = 'audio/ogg';
    }

    if (!mime || !mime.includes('audio')) {
        return await conn.sendMessage(chatId, { 
            text: '❌ *Errore:* Per favore, **rispondi direttamente** a un messaggio vocale o audio con il comando `.v deep`!' 
        }, { quoted: m });
    }

    await conn.sendMessage(chatId, { react: { text: '🎙️', key: m.key } });

    let mediaBuffer;
    try {
        // Se il messaggio è quotato, Baileys richiede la ricostruzione del proto.WebMessageInfo per scaricarlo
        let downloadObject = q;
        if (m.quoted) {
            downloadObject = proto.WebMessageInfo.fromObject({
                key: {
                    remoteJid: chatId,
                    fromMe: m.message?.extendedTextMessage?.contextInfo?.participant === conn.user.jid,
                    id: m.message?.extendedTextMessage?.contextInfo?.stanzaId,
                    participant: m.message?.extendedTextMessage?.contextInfo?.participant
                },
                message: m.message?.extendedTextMessage?.contextInfo?.quotedMessage
            });
        }

        mediaBuffer = await downloadMediaMessage(
            downloadObject,
            'buffer',
            {},
            { 
                logger: console,
                reconnectMode: 'always'
            }
        );
    } catch (e) {
        console.error(e);
        return await conn.sendMessage(chatId, { text: '❌ Errore nel recuperare l\'audio del messaggio.' }, { quoted: m });
    }

    let effect = (text || '').trim().toLowerCase();
    let audioFilter = 'asetrate=44100*0.75,aresample=44100'; // Default deep

    if (effect.includes('chipmunk') || effect.includes('scoiattolo')) {
        audioFilter = 'asetrate=44100*1.3,aresample=44100';
    } else if (effect.includes('robot')) {
        audioFilter = 'vibrato=f=15:d=0.7,flanger=delay=4:depth=1:regen=60:speed=0.5';
    } else if (effect.includes('echo')) {
        audioFilter = 'aecho=0.8:0.9:40:0.5';
    }

    let inputPath = path.join(__dirname, `_input_${Date.now()}.ogg`);
    let outputPath = path.join(__dirname, `_output_${Date.now()}.ogg`);

    try {
        fs.writeFileSync(inputPath, mediaBuffer);

        let ffmpegCmd = `ffmpeg -i "${inputPath}" -filter:a "${audioFilter}" -c:a libopus -b:a 128k -ar 48000 -ac 1 -f ogg "${outputPath}"`;

        exec(ffmpegCmd, async (error) => {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

            if (error || !fs.existsSync(outputPath)) {
                return await conn.sendMessage(chatId, { text: '❌ Errore di l\'elaborazione con FFmpeg.' }, { quoted: m });
            }

            let resultBuffer = fs.readFileSync(outputPath);
            await conn.sendMessage(chatId, {
                audio: resultBuffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: m });

            await conn.sendMessage(chatId, { react: { text: '✅', key: m.key } });

            setTimeout(() => {
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }, 5000);
        });

    } catch (err) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        return await conn.sendMessage(chatId, { text: '❌ Errore durante la conversione.' }, { quoted: m });
    }
};

handler.command = /^v$/i;
handler.help = ['v [deep/chipmunk/robot/echo]'];
handler.tags = ['tools'];

export default handler;
