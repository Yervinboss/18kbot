import { downloadContentFromMessage } from '@realvare/baileys';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;

    // Estrazione del file multimediale (sia diretto che citato)
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || '';
    
    if (!mime && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        let quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
        let type = Object.keys(quotedMsg);
        mime = quotedMsg[type]?.mimetype || '';
        if (mime) {
            q.msg = quotedMsg[type];
        }
    }

    if (!mime) {
        return await conn.sendMessage(jid, { 
            text: `❌ *Istruzioni:* Invia una foto/video con la didascalia \`.s\` oppure rispondi a un elemento multimediale!` 
        }, { quoted: m });
    }

    let isImage = mime.includes('image');
    let isVideo = mime.includes('video') || mime.includes('gif');

    if (!isImage && !isVideo) {
        return await conn.sendMessage(jid, { text: `❌ Puoi convertire solo foto, GIF o brevi video!` }, { quoted: m });
    }

    // 1. REAZIONE INIZIALE: Clessidra sul messaggio dell'utente per indicare il caricamento
    await conn.sendMessage(jid, {
        react: { text: '⏳', key: m.key }
    });

    try {
        let mediaMessage = q.msg || q;
        let messageType = isImage ? 'image' : 'video';
        
        let stream = await downloadContentFromMessage(mediaMessage, messageType);
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        let tmpInput = path.resolve(`tmp_input_${Date.now()}`);
        let tmpOutput = path.resolve(`tmp_output_${Date.now()}.webp`);
        fs.writeFileSync(tmpInput, buffer);

        let ff = ffmpeg(tmpInput);
        
        // Ritaglio 1:1 quadrato perfetto ad alta definizione
        if (isImage) {
            ff.outputOptions([
                '-vf', 'crop=w=min(iw\\,ih):h=min(iw\\,ih),scale=512:512:flags=lanczos',
                '-vcodec', 'libwebp',
                '-lossless', '1',
                '-q:v', '90'
            ]);
        } else {
            ff.outputOptions([
                '-vf', 'crop=w=min(iw\\,ih):h=min(iw\\,ih),scale=512:512:flags=lanczos,fps=15',
                '-vcodec', 'libwebp',
                '-loop', '0',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-s', '512x512'
            ]);
        }

        ff.save(tmpOutput)
            .on('end', async () => {
                let stickerBuffer = fs.readFileSync(tmpOutput);
                
                // 2. Invia lo sticker finale senza alcun testo di contorno
                await conn.sendMessage(jid, { sticker: stickerBuffer }, { quoted: m });
                
                // 3. REAZIONE FINALE: Aggiorna l'emoji sul messaggio con la spunta verde
                await conn.sendMessage(jid, {
                    react: { text: '✅', key: m.key }
                });
                
                if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
                if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            })
            .on('error', async (err) => {
                console.error(err);
                if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
                if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
                
                // In caso di errore toglie la clessidra e mette una X
                await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
            });

    } catch (e) {
        console.error(e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
    }
};

handler.help = ['s'];
handler.tags = ['media'];
handler.command = /^(s|sticker)$/i;

export default handler;
