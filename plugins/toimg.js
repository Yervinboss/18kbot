import { downloadContentFromMessage } from '@realvare/baileys';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;

    let q = m.quoted ? m.quoted : m;
    let stickerMessage = null;

    if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage) {
        stickerMessage = m.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage;
    } else if (q.msg && (q.msg.mimetype || '').includes('sticker')) {
        stickerMessage = q.msg;
    } else if (q.mimetype && q.mimetype.includes('sticker')) {
        stickerMessage = q;
    }

    if (!stickerMessage) {
        return await conn.sendMessage(jid, { 
            text: `❌ *Istruzioni:* Rispondi a uno sticker digitando il comando \`.toimg\` per convertirlo!` 
        }, { quoted: m });
    }

    let isAnimated = stickerMessage.isAnimated || false;

    await conn.sendMessage(jid, {
        react: { text: '⏳', key: m.key }
    });

    try {
        let stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        let tmpDir = path.resolve('./tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        let fileId = Date.now();
        let tmpInput = path.join(tmpDir, `input_${fileId}.webp`);
        let tmpOutput = path.join(tmpDir, isAnimated ? `output_${fileId}.mp4` : `output_${fileId}.png`);
        
        fs.writeFileSync(tmpInput, buffer);

        // Usiamo un comando ffmpeg sicuro con -ignore_loop 0 che gestisce sia statici che animati
        let cmd = isAnimated 
            ? `ffmpeg -y -i "${tmpInput}" -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${tmpOutput}"`
            : `ffmpeg -y -i "${tmpInput}" -vframes 1 "${tmpOutput}"`;
        
        exec(cmd, async (error) => {
            if (error || !fs.existsSync(tmpOutput)) {
                console.error('Errore conversione ffmpeg:', error);
                // Fallback estremo: invia il file webp nativo come documento o immagine
                await conn.sendMessage(jid, { document: buffer, mimetype: 'image/webp', fileName: 'sticker.webp', caption: '⚠️ Conversione fallita, ecco il file originale.' }, { quoted: m });
            } else {
                let outBuffer = fs.readFileSync(tmpOutput);
                if (isAnimated) {
                    await conn.sendMessage(jid, { 
                        video: outBuffer, 
                        caption: '✅ Ecco il tuo video animato!', 
                        gifPlayback: true 
                    }, { quoted: m });
                } else {
                    await conn.sendMessage(jid, { image: outBuffer, caption: '✅ Ecco la tua foto!' }, { quoted: m });
                }
            }
            cleanup();
        });

        function cleanup() {
            if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            conn.sendMessage(jid, { react: { text: '✅', key: m.key } }).catch(() => {});
        }

    } catch (e) {
        console.error('Errore generale toimg:', e.message);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
    }
};

handler.help = ['toimg'];
handler.tags = ['media'];
handler.command = /^(toimg|toimage|aimg)$/i;

export default handler;
