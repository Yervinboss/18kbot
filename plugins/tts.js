import googleTTS from 'google-tts-api';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const chatId = m.chat || m.from || (m.key && m.key.remoteJid);
    if (!chatId) return;

    if (!text) {
        return conn.sendMessage(chatId, { text: `*Uso corretto:* \n${usedPrefix + command} <testo>\n\n*Esempio:* \n${usedPrefix + command} Ciao Luis, come va?` });
    }

    try {
        const audioUrl = googleTTS.getAudioUrl(text, {
            lang: 'it',
            slow: false,
            host: 'https://translate.google.com',
        });

        const timestamp = Date.now();
        const inputMp3 = path.join('./tmp', `tts_${timestamp}.mp3`);
        const outputOpus = path.join('./tmp', `tts_${timestamp}.opus`);

        if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });

        // Scarica il file audio di Google
        const response = await fetch(audioUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(inputMp3, buffer);

        // Converte in Opus ad alta fedeltà con ffmpeg
        await execAsync(`ffmpeg -i "${inputMp3}" -c:a libopus -b:a 192k -ar 48000 "${outputOpus}"`);

        // Invia il vocale verde perfetto
        await conn.sendMessage(chatId, { 
            audio: { url: outputOpus }, 
            mimetype: 'audio/ogg; codecs=opus', 
            ptt: true 
        });

        // Pulizia file temporanei
        setTimeout(() => {
            try { if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3); } catch {}
            try { if (fs.existsSync(outputOpus)) fs.unlinkSync(outputOpus); } catch {}
        }, 5000);

    } catch (e) {
        console.error(e);
        await conn.sendMessage(chatId, { text: 'Errore durante la generazione del testo in vocale.' });
    }
};

handler.help = ['tts <testo>'];
handler.tags = ['tools'];
handler.command = /^(tts|say)$/i;

export default handler;

