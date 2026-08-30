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

    // 1. REAZIONE INIZIALE: Clessidra
    await conn.sendMessage(jid, {
        react: { text: '⏳', key: m.key }
    });

    try {
        let stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        let tmpInput = path.resolve(`tmp_st_${Date.now()}.webp`);
        let tmpOutput = isAnimated ? path.resolve(`tmp_vi_${Date.now()}.mp4`) : path.resolve(`tmp_ph_${Date.now()}.png`);
        fs.writeFileSync(tmpInput, buffer);

        if (!isAnimated) {
            // --- STICKER STATICO -> FOTO REALE ---
            // Usiamo convert/magick locale impostando la decodifica forzata per evitare schermi neri
            exec(`magick "${tmpInput}" "${tmpOutput}" || convert "${tmpInput}" "${tmpOutput}"`, async (error) => {
                if (error) {
                    console.error(error);
                    // Fallback estremo se imagemagick fallisce: lo invia come file png forzato
                    await conn.sendMessage(jid, { image: buffer, caption: '✅ Ecco la tua foto!' }, { quoted: m });
                } else {
                    let photoBuffer = fs.readFileSync(tmpOutput);
                    await conn.sendMessage(jid, { image: photoBuffer, caption: '✅ Ecco la tua foto!' }, { quoted: m });
                }
                cleanup();
            });
        } else {
            // --- STICKER ANIMATO -> VIDEO REALE (NO SCHERMO NERO) ---
            // Eseguiamo una conversione a due stadi nativa di ffmpeg che decodifica correttamente i WebP animati di WhatsApp
            let cmd = `ffmpeg -v quiet -y -i "${tmpInput}" -vcodec libx264 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${tmpOutput}"`;
            
            exec(cmd, async (error) => {
                if (error) {
                    console.error('Errore ffmpeg, tento fallback frame:', error);
                    // Fallback se lo sticker ha frame rate variabile corrotto
                    let cmdFallback = `ffmpeg -v quiet -y -ignore_loop 0 -i "${tmpInput}" -vcodec libx264 -pix_fmt yuv420p -movflags faststart -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" "${tmpOutput}"`;
                    exec(cmdFallback, async (err2) => {
                        if (err2) {
                            // Se tutto fallisce, lo mandiamo come documento per non perdere il file
                            await conn.sendMessage(jid, { document: buffer, mimetype: 'video/mp4', fileName: 'video.mp4', caption: '⚠️ Riproduzione fallita, inviato come file.' }, { quoted: m });
                        } else {
                            await sendVideo();
                        }
                        cleanup();
                    });
                } else {
                    await sendVideo();
                    cleanup();
                }
            });
        }

        async function sendVideo() {
            if (fs.existsSync(tmpOutput)) {
                let videoBuffer = fs.readFileSync(tmpOutput);
                await conn.sendMessage(jid, { 
                    video: videoBuffer, 
                    caption: '✅ Ecco il tuo video animato!', 
                    gifPlayback: true 
                }, { quoted: m });
            }
        }

        function cleanup() {
            // Rimuove i file temporanei per non riempire la memoria del telefono
            if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            conn.sendMessage(jid, { react: { text: '✅', key: m.key } }).catch(() => {});
        }

    } catch (e) {
        console.error('Errore generale:', e.message);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
    }
};

handler.help = ['toimg'];
handler.tags = ['media'];
handler.command = /^(toimg|toimage|aimg)$/i;

export default handler;
