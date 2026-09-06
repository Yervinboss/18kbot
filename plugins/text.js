// plugins/text.js - Cerca il testo e invia l'audio direttamente tramite pulsante
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { search } from 'yt-search';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findYtUrl(query) {
    try {
        const r = await search(query);
        if (r.videos.length > 0) {
            return { url: r.videos[0].url, title: r.videos[0].title };
        }
    } catch (e) {}
    return null;
}

async function getLyrics(query) {
    let artist = '';
    let title = query;

    if (query.includes(' - ')) {
        const parts = query.split(' - ');
        artist = parts[0].trim();
        title = parts[1].trim();
    }

    try {
        const lrclibUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const lrclibRes = await axios.get(lrclibUrl);
        if (lrclibRes.data && lrclibRes.data.length > 0) {
            const song = lrclibRes.data[0]; 
            return { lyrics: song.plainLyrics, source: `🎵 ${song.artistName} - ${song.trackName}` };
        }
    } catch (e) {}

    try {
        if (artist) {
            let url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
            const res = await axios.get(url);
            if (res.data && res.data.lyrics) {
                return { lyrics: res.data.lyrics, source: '📝 Lyrics.ovh' };
            }
        }
    } catch (e) {}

    return null;
}

let handler = async (m, { conn, text, command }) => {
    const jid = m.key.remoteJid;

    // 1. CONTROLLO PREMUTURA PULSANTE (Intercetta l'ID del bottone premuto)
    let buttonId = 
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.templateButtonReplyMessage?.selectedId ||
        m.msg?.selectedButtonId || 
        m.text; // Alcune librerie passano l'ID direttamente dentro m.text

    if (buttonId && buttonId.startsWith('textplay_')) {
        let videourl = buttonId.replace('textplay_', '');
        await conn.sendMessage(jid, { react: { text: '🎧', key: m.key } });

        let inputMp3 = path.join(__dirname, `_temp_text_${Date.now()}.mp3`);
        let outputOgg = path.join(__dirname, `vocale_text_${Date.now()}.ogg`);

        let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 192k --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${videourl}"`;
        
        exec(yt_command, async (error, stdout, stderr) => {
            if (error) {
                console.error('Errore yt-dlp text:', stderr);
                return await conn.sendMessage(jid, { text: '❌ Errore durante il download del brano.' }, { quoted: m });
            }

            let ffmpeg_command = `ffmpeg -i "${inputMp3}" -c:a libopus -b:a 128k -ar 48000 -ac 1 -f ogg "${outputOgg}"`;
            
            exec(ffmpeg_command, async (err2, stdout2, stderr2) => {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);

                if (err2) {
                    console.error('Errore conversione ffmpeg text:', stderr2);
                    return await conn.sendMessage(jid, { text: '❌ Errore nella conversione del vocale.' }, { quoted: m });
                }

                if (fs.existsSync(outputOgg)) {
                    try {
                        let audioBuffer = fs.readFileSync(outputOgg);
                        await conn.sendMessage(jid, {
                            audio: audioBuffer,
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: m });

                        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });
                    } catch (err) {
                        console.error('Errore invio audio text:', err);
                    } finally {
                        setTimeout(() => {
                            if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                        }, 5000);
                    }
                } else {
                    return await conn.sendMessage(jid, { text: '❌ File vocale non generato.' }, { quoted: m });
                }
            });
        });
        return; // Blocca l'esecuzione qui per evitare che cerchi il testo di "textplay_"
    }

    // 2. FUNZIONE DI RICERCA TESTO STANDARD (.text)
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
        try {
            const yt = await findYtUrl(text); 
            if (yt) {
                ytUrl = yt.url;
                ytTitle = yt.title;
            }
        } catch (e) {}

        let messageContent = {
            text: `📝 *${source}*\n\n${lyrics.length > 4000 ? lyrics.substring(0, 4000) : lyrics}`,
            footer: ytTitle ? `🎵 *${ytTitle}*` : ''
        };

        if (ytUrl) {
            messageContent.buttons = [
                {
                    buttonId: `textplay_${ytUrl}`, 
                    buttonText: { displayText: '🎵 Riproduci' },
                    type: 1
                }
            ];
            messageContent.headerType = 1;
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

// La regex ora accetta sia i comandi normali sia qualsiasi stringa che inizia con textplay_
handler.command = /^(text|testo|lyrics|textplay_.*)$/i;
handler.help = ['text'];
handler.tags = ['musica'];

export default handler;
