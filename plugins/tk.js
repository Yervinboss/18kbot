// plugins/tk.js - DOWNLOADER UNIVERSALE

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
    });
});

let handler = async (m, { conn, text, command }) => {
    let action = (command || '').trim().toLowerCase();
    let query = (text || '').trim();
    let chatId = m.key.remoteJid;

    // ============ COMANDO PRINCIPALE ============
    if (action === 'tk' || action === 'video' || action === 'scarica' || action === 'download') {
        if (!query) {
            return conn.sendMessage(chatId, { 
                text: `📥 *DOWNLOADER UNIVERSALE*\n\n` +
                      `Inviami un link e ti mando il video!\n\n` +
                      `📝 *Esempi:*\n` +
                      `• .tk <link tiktok>\n` +
                      `• .tk <link instagram>\n` +
                      `• .tk <link youtube>\n` +
                      `• .tk <link facebook>\n\n` +
                      `🎬 Formato: MP4` 
            }, { quoted: m });
        }

        // Verifica che sia un link valido
        if (!query.match(/^https?:\/\//i)) {
            return conn.sendMessage(chatId, { 
                text: '❌ Inserisci un link valido che inizia con http:// o https://' 
            }, { quoted: m });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        let timestamp = Date.now();
        let outputPath = path.join(os.tmpdir(), `video_${timestamp}.mp4`);

        try {
            // Comando yt-dlp universale per tutti i siti
            let yt_command = `yt-dlp -f "best[ext=mp4]/best" --no-part --extractor-args youtube:player-client=android,web -o "${outputPath}" "${query}"`;

            await execPromise(yt_command);

            if (!fs.existsSync(outputPath)) {
                await conn.sendMessage(chatId, { react: { text: '❌', key: m.key } });
                return conn.sendMessage(chatId, { 
                    text: '❌ Impossibile scaricare il video. Link non supportato o video non disponibile.' 
                }, { quoted: m });
            }

            // Controlla dimensione file
            let stats = fs.statSync(outputPath);
            let fileSizeMB = stats.size / (1024 * 1024);

            if (fileSizeMB > 50) {
                fs.unlinkSync(outputPath);
                await conn.sendMessage(chatId, { react: { text: '⚠️', key: m.key } });
                return conn.sendMessage(chatId, { 
                    text: `⚠️ Il video è troppo grande (${fileSizeMB.toFixed(1)}MB).\nMassimo consentito: 50MB` 
                }, { quoted: m });
            }

            // Invia il video
            let videoBuffer = fs.readFileSync(outputPath);
            
            await conn.sendMessage(chatId, {
                video: videoBuffer,
                caption: `✅ Ecco il tuo video!\n\n🔗 Fonte: ${query}`,
                mimetype: 'video/mp4'
            }, { quoted: m });

            await conn.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (e) {
            console.error('Errore download video:', e.message);
            await conn.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            
            return conn.sendMessage(chatId, { 
                text: `❌ Errore durante il download.\n\n` +
                      `Possibili cause:\n` +
                      `• Link non valido\n` +
                      `• Video privato\n` +
                      `• Video rimosso\n` +
                      `• Sito non supportato` 
            }, { quoted: m });
        } finally {
            // Pulisci file temporaneo
            setTimeout(() => {
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }, 5000);
        }
        return;
    }

    // ============ COMANDO AUDIO (estrai solo audio) ============
    if (action === 'tkaudio' || action === 'tka') {
        if (!query || !query.match(/^https?:\/\//i)) {
            return conn.sendMessage(chatId, { 
                text: '❌ Inserisci un link valido!\nEsempio: .tkaudio <link>' 
            }, { quoted: m });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        let timestamp = Date.now();
        let inputFile = path.join(os.tmpdir(), `_temp_${timestamp}.mp3`);
        let outputOgg = path.join(os.tmpdir(), `audio_${timestamp}.ogg`);

        try {
            // Scarica solo audio
            let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 192k --no-part --extractor-args youtube:player-client=android,web -o "${inputFile}" "${query}"`;
            await execPromise(yt_command);

            // Converti in ogg
            let ffmpeg_command = `ffmpeg -y -i "${inputFile}" -c:a libopus -b:a 128k -ar 48000 -ac 1 -f ogg "${outputOgg}"`;
            await execPromise(ffmpeg_command);

            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);

            if (!fs.existsSync(outputOgg)) {
                throw new Error('File audio non generato');
            }

            let audioBuffer = fs.readFileSync(outputOgg);
            await conn.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: m });

            await conn.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (e) {
            console.error('Errore download audio:', e.message);
            await conn.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            return conn.sendMessage(chatId, { 
                text: '❌ Errore durante il download audio.' 
            }, { quoted: m });
        } finally {
            setTimeout(() => {
                if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
            }, 5000);
        }
        return;
    }
};

handler.command = /^(tk|video|scarica|download|tkaudio|tka)$/i;
handler.help = ['tk <link>', 'tkaudio <link>'];
handler.tags = ['downloader'];

export default handler;
