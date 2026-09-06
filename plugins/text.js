// plugins/text.js - Scarica e invia l'audio DIRETTAMENTE (Senza comando .song)
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { search } from 'yt-search'; // Libreria corretta per cercare
import youtubedl from 'youtube-dl-exec'; // Libreria per scaricare audio

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../text_config.json');

// ============================================================
// LEGGI CHIAVI DAL DATABASE
// ============================================================
const getGeniusKey = () => {
    try {
        if (fs.existsSync(configPath)) {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return data.genius_token || '';
        }
    } catch (e) {}
    return '';
};

// ============================================================
// CERCA SU YOUTUBE
// ============================================================
async function findYtUrl(query) {
    try {
        const r = await search(query);
        if (r.videos.length > 0) {
            return { url: r.videos[0].url, title: r.videos[0].title };
        }
    } catch (e) {
        console.error('Errore ricerca YouTube:', e);
    }
    return null;
}

// ============================================================
// FUNZIONE CHE SCARICA L'AUDIO E LO INVIA SUBITO (VOCALE)
// ============================================================
async function sendDirectAudio(conn, jid, ytUrl, title, quotedMsg) {
    try {
        // Reazione di caricamento
        await conn.sendMessage(jid, { react: { text: '🎧', key: quotedMsg.key } });

        // Scarica l'audio in un file temporaneo
        const output = path.join(__dirname, `../tmp/${Date.now()}.mp3`);
        await youtubedl(ytUrl, {
            output: output,
            extractAudio: true,
            audioFormat: 'mp3',
            noPlaylist: true
        });

        // Leggi il file audio
        const audioBuffer = fs.readFileSync(output);

        // Invia il vocale immediatamente
        await conn.sendMessage(jid, { 
            audio: audioBuffer, 
            mimetype: 'audio/mpeg', 
            fileName: `${title || 'Audio'}.mp3`,
            ptt: true // true = Lo manda come "vocale" di WhatsApp
        }, { quoted: quotedMsg });

        // Elimina il file temporaneo per non riempire la memoria
        fs.unlinkSync(output);

    } catch (e) {
        console.error('Errore invio audio diretto:', e);
        await conn.sendMessage(jid, { text: '❌ Errore nel download della canzone.' }, { quoted: quotedMsg });
    }
}

// ============================================================
// CERCA TESTO
// ============================================================
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

// ============================================================
// HANDLER PRINCIPALE (.text)
// ============================================================
let handler = async (m, { conn, text, command }) => {
    const jid = m.key.remoteJid;

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

        // Costruisci il messaggio del testo con il pulsante
        let messageContent = {
            text: `📝 *${source}*\n\n${lyrics.length > 4000 ? lyrics.substring(0, 4000) : lyrics}`,
            footer: ytTitle ? `🎵 *${ytTitle}*` : ''
        };

        if (ytUrl) {
            messageContent.buttons = [
                {
                    buttonId: `direct_audio_${ytUrl}`, 
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

// ============================================================
// GESTORE DEL CLICK SUL PULSANTE (INVIA DIRETTAMENTE IL VOCALE)
// ============================================================
let buttonHandler = async (m, { conn }) => {
    if (!m.message?.buttonsResponseMessage) return;
    
    const selectedId = m.message.buttonsResponseMessage.selectedButtonId;
    
    if (selectedId && selectedId.startsWith('direct_audio_')) {
        const ytUrl = selectedId.replace('direct_audio_', '');
        const jid = m.key.remoteJid;
        
        // Chiama la funzione che scarica e manda SUBITO l'audio
        await sendDirectAudio(conn, jid, ytUrl, 'Canzone', m);
    }
};

handler.command = /^(text|testo|lyrics)$/i;
handler.button = buttonHandler; // Collega il gestore del click
handler.help = ['text'];
handler.tags = ['musica'];

export default handler;
