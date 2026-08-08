const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 's', // Cambiato il nome principale in 's' così risponde a .s
    description: 'Converte immagini o video in sticker (.s o .sticker)',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        
        // Estrai il messaggio multimediale (diretto o risposto)
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isQuotedImage = quoted?.imageMessage;
        const isQuotedVideo = quoted?.videoMessage;
        const isDirectImage = m.message?.imageMessage;
        const isDirectVideo = m.message?.videoMessage;

        if (!isDirectImage && !isDirectVideo && !isQuotedImage && !isQuotedVideo) {
            await sock.sendMessage(sender, { text: '❌ Rispondi a una foto o a un video breve con `.s`!' }, { quoted: m });
            return;
        }

        // Metti la reazione di caricamento
        await sock.sendMessage(sender, { react: { text: '⏳', key: m.key } });

        const isVideo = isDirectVideo || isQuotedVideo;
        const downloadType = isVideo ? 'video' : 'image';
        const messageContent = isDirectImage || isDirectVideo || isQuotedImage || isQuotedVideo;

        const tempInput = path.join(__dirname, `../temp_stk_${m.key.id}`);
        const tempOutput = path.join(__dirname, `../temp_stk_${m.key.id}.webp`);

        try {
            // Scarica il file media da WhatsApp
            const stream = await downloadContentFromMessage(messageContent, downloadType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            fs.writeFileSync(tempInput, buffer);

            // Converti in WebP con ffmpeg
            if (isVideo) {
                await execPromise(`ffmpeg -y -i "${tempInput}" -vcodec libwebp -filter_complex "fps=15,scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(512-iw)/2:(512-ih)/2:color=#00000000" -loop 0 -vsync 0 "${tempOutput}"`);
            } else {
                await execPromise(`ffmpeg -y -i "${tempInput}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=#00000000" "${tempOutput}"`);
            }

            if (!fs.existsSync(tempOutput)) {
                throw new Error('Conversione fallita');
            }

            // Invia lo sticker e metti il ✅
            await sock.sendMessage(sender, { sticker: fs.readFileSync(tempOutput) }, { quoted: m });
            await sock.sendMessage(sender, { react: { text: '✅', key: m.key } });

            // Pulizia file
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);

        } catch (error) {
            console.error(error);
            await sock.sendMessage(sender, { react: { text: '❌', key: m.key } });
            if (fs.existsSync(tempInput)) try { fs.unlinkSync(tempInput); } catch(e) {}
            if (fs.existsSync(tempOutput)) try { fs.unlinkSync(tempOutput); } catch(e) {}
        }
    }
};

