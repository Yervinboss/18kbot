// plugins/text.js - Versione CORRETTA e ottimizzata
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'yt-search';
const { search } = pkg;
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findYtUrl(query) {
    try {
        const r = await search(query);
        if (r.videos && r.videos.length > 0) {
            let img = r.videos[0].image || r.videos[0].thumbnail || '';
            
            if (img && img.includes('default.jpg')) {
                img = img.replace('default.jpg', 'hqdefault.jpg');
            }

            // 🔥 FIX definitivo: Inserito "images.weserv.nl" con i backtick corretti
            let croppedImage = img ? `https://images.weserv.nl/?url=${encodeURIComponent(img)}&w=500&h=500&fit=cover` : '';

            return { 
                url: r.videos[0].url, 
                title: r.videos[0].title,
                image: croppedImage || img
            };
        }
    } catch (e) {
        console.error('Errore findYtUrl:', e.message);
    }
    return null;
}

async function getLyrics(query) {
    let artist = '';
    let title = query;

    if (query.includes(' - ')) {
        const parts = query.split(' - ');
        artist = parts[0] ? parts[0].trim() : '';
        title = parts[1] ? parts[1].trim() : query;
    }

    // 🔥 URL corretta per LrcLib
    try {
        const lrclibUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const lrclibRes = await axios.get(lrclibUrl);
        if (lrclibRes.data && lrclibRes.data.length > 0) {
            const song = lrclibRes.data[0]; 
            return { lyrics: song.plainLyrics, source: `🎵 ${song.artistName} - ${song.trackName}` };
        }
    } catch (e) {
        console.error('Errore LrcLib:', e.message);
    }

    // 🔥 URL corretta per Lyrics.ovh
    try {
        if (artist) {
            let url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
            const res = await axios.get(url);
            if (res.data && res.data.lyrics) {
                return { lyrics: res.data.lyrics, source: '📝 Lyrics.ovh' };
            }
        }
    } catch (e) {
        console.error('Errore Lyrics.ovh:', e.message);
    }

    return null;
}

let handler = async (m, { conn, text, command }) => {
    const jid = m.key.remoteJid;

    let buttonId = 
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.templateButtonReplyMessage?.selectedId ||
        m.msg?.selectedButtonId || 
        m.text; 

    if (buttonId && buttonId.startsWith('textplay_')) {
        let videourl = buttonId.replace('textplay_', '');
        await conn.sendMessage(jid, { react: { text: '🎧', key: m.key } });

        let inputMp3 = path.join(__dirname, `_temp_text_${Date.now()}.mp3`);
        let outputOgg = path.join(__dirname, `vocale_text_${Date.now()}.ogg`);

        let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 192k --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${videourl}"`;
        
        exec(yt_command, async (error) => {
            if (error) {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);
                return await conn.sendMessage(jid, { text: '❌ Errore durante il download.' }, { quoted: m });
            }

            let ffmpeg_command = `ffmpeg -i "${inputMp3}" -c:a libopus -b:a 128k -ar 48000 -ac 1 -f ogg "${outputOgg}"`;
            
            exec(ffmpeg_command, async (err2) => {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);

                if (err2 || !fs.existsSync(outputOgg)) {
                    if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                    return await conn.sendMessage(jid, { text: '❌ Errore conversione.' }, { quoted: m });
                }

                try {
                    let audioBuffer = fs.readFileSync(outputOgg);
                    await conn.sendMessage(jid, {
                        audio: audioBuffer,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, { quoted: m });
                    await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });
                } catch (err) {
                    console.error('Errore invio audio:', err);
                } finally {
                    setTimeout(() => {
                        if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                    }, 5000);
                }
            });
        });
        return; 
    }

    if (!text) {
        return await conn.sendMessage(jid, {
            text: `📝 *CERCA TESTO CANZONE*\n\n📌 *Uso:* \`.text [artista - titolo]\`\n📎 *Esempio:* \`.text Sfera Ebbasta - Visiera H\``
        }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '🔍', key: m.key } });

    try {
        let result = await getLyrics(text);

        if (!result || !result.lyrics) {
            return await conn.sendMessage(jid, {
                text: `❌ Testo non trovato per: "${text}"`
            }, { quoted: m });
        }

        let { lyrics, source } = result;

        let ytUrl = '';
        let ytTitle = '';
        let ytImage = '';
        
        try {
            const yt = await findYtUrl(text); 
            if (yt) {
                ytUrl = yt.url;
                ytTitle = yt.title;
                ytImage = yt.image;
            }
        } catch (e) {}

        let messageText = `📝 *${source}*\n\n${lyrics.length > 4000 ? lyrics.substring(0, 4000) : lyrics}`;
        let footerText = ytTitle ? `🎵 *${ytTitle}*` : '';

        let messageContent = {};

        if (ytImage) {
            messageContent = {
                image: { url: ytImage },
                caption: messageText,
                footer: footerText
            };
        } else {
            messageContent = {
                text: messageText,
                footer: footerText
            };
        }

        if (ytUrl) {
            messageContent.buttons = [
                {
                    buttonId: `textplay_${ytUrl}`, 
                    buttonText: { displayText: '🎵 Riproduci' },
                    type: 1
                }
            ];
            messageContent.headerType = ytImage ? 4 : 1; 
        }

        await conn.sendMessage(jid, messageContent, { quoted: m });
        
        if (lyrics.length > 4000) {
            const parts = lyrics.substring(4000).match(/[\s\S]{1,4000}/g) || [];
            for (let part of parts) {
                await conn.sendMessage(jid, { text: part });
            }
        }

        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error('Errore text handler:', error);
        await conn.sendMessage(jid, { text: '❌ Errore nella ricerca.' }, { quoted: m });
    }
};

handler.command = /^(text|testo|lyrics|textplay_.*)$/i;
handler.help = ['text'];
handler.tags = ['musica'];

export default handler;
