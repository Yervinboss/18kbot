import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from '@realvare/baileys';

const execPromise = util.promisify(exec);

async function downloadMedia(mediaMessage, type) {
    let stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (let chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;

    let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
    else if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
    else if (quoted?.viewOnceMessageV2Extension?.message) quoted = quoted.viewOnceMessageV2Extension.message;

    let videoMessage = quoted?.videoMessage || m.message?.videoMessage;

    if (!videoMessage) {
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return await conn.sendMessage(jid, { text: '🎵 *ZENO VIDEO TO AUDIO*\n\n❌ Devi fare *Rispondi* direttamente sopra il video!\nEsempio: rispondi a un video con `.toaudio`' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    let tmpIn = path.resolve(`toaud_in_${m.key.id}.mp4`);
    
    // 🚀 FIX IMMORTALE IPHONE: Cambiata l'estensione finale in .m4a per la massima compatibilità iOS
    let tmpOut = path.resolve(`toaud_out_${m.key.id}.m4a`);

    try {
        let mediaBuffer = await downloadMedia(videoMessage, 'video');
        if (!mediaBuffer) throw new Error('Download video fallito');

        fs.writeFileSync(tmpIn, mediaBuffer);

        // 🚀 CODEC UNIVERSALE AAC NATIVO APPLE: Estrae l'audio forzando i parametri puliti che l'iPhone adora
        await execPromise(`ffmpeg -y -i "${tmpIn}" -vn -c:a aac -b:a 64k -ar 44100 "${tmpOut}"`);

        if (!fs.existsSync(tmpOut)) throw new Error('Conversione fallita');

        let audioBuffer = fs.readFileSync(tmpOut);

        await conn.sendMessage(jid, { react: { text: '🎵', key: m.key } });

        // Invia il file specificando il mimetype audio/mp4 perfetto per le note vocali iOS/Android
        return await conn.sendMessage(jid, {
            audio: audioBuffer,
            mimetype: 'audio/mp4',
            ptt: true
        }, { quoted: m });

    } catch (e) {
        console.error('Errore nel plugin toaudio:', e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return await conn.sendMessage(jid, { text: '❌ Errore durante l\'estrazione audio del file!' }, { quoted: m });
    } finally {
        if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
};

handler.help = ['toaudio'];
handler.tags = ['media'];
handler.command = /^(toaudio|tomp3|mp3|audio)$/i;

export default handler;
