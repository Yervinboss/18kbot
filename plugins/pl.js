import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import yts from 'yt-search';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playlistDbPath = path.join(__dirname, '../playlist_db.json');

global.plQueues = global.plQueues || {};

const readDb = (p) => {
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {}; }
};

const writeDb = (p, data) => {
    try {
        fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Errore scrittura database playlist:', e);
    }
};

// ============================================================
// SPOTIFY - Versione stabile con fetch e scraping diretto
// ============================================================
const extractSpotifyTracksNoClient = async (url) => {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = await response.text();
        
        // Estrai il titolo della pagina
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        if (!titleMatch) {
            return [];
        }

        let title = titleMatch[1]
            .replace(' - Spotify', '')
            .replace(' | Spotify', '')
            .replace('• Spotify', '')
            .trim();

        // Se è una playlist o album, cerchiamo di estrarre più tracce
        const isPlaylist = url.includes('playlist') || url.includes('album');
        
        if (isPlaylist) {
            const trackMatches = html.match(/<span class="track-name">(.*?)<\/span>/g) || 
                               html.match(/"name":"(.*?)"/g);
            
            if (trackMatches && trackMatches.length > 0) {
                const tracks = trackMatches.map(t => {
                    let name = t.replace(/<[^>]*>/g, '').replace(/"name":"/g, '').replace(/"$/g, '');
                    return { title: name };
                }).filter(t => t.title && t.title.length > 0);
                
                if (tracks.length > 0) {
                    return tracks;
                }
            }
        }

        // Per singola traccia o fallback
        if (title) {
            return [{ title: title }];
        }

        return [];
    } catch (e) {
        console.error('Errore Spotify:', e.message);
        return [];
    }
};

async function processQueue(conn, jid, sender) {
    let queueData = global.plQueues[sender];
    if (!queueData || queueData.tracks.length === 0) {
        if (queueData) delete global.plQueues[sender];
        await conn.sendMessage(jid, { text: '✅ Playlist completata!' }).catch(() => {});
        return;
    }

    let track = queueData.tracks.shift();
    let timestamp = Date.now();
    let inputMp3 = path.join(__dirname, `_temp_pl_${timestamp}.mp3`);
    let outputOgg = path.join(__dirname, `vocale_pl_${timestamp}.ogg`);

    let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 128k --no-part --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${track.url}"`;

    exec(yt_command, async (error) => {
        if (error) {
            if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);
            return processQueue(conn, jid, sender);
        }

        let ffmpeg_command = `ffmpeg -y -i "${inputMp3}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 -threads 0 -f ogg "${outputOgg}"`;

        exec(ffmpeg_command, async (err2) => {
            if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);

            if (err2 || !fs.existsSync(outputOgg)) {
                if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                return processQueue(conn, jid, sender);
            }

            if (!global.plQueues[sender]) {
                if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                return;
            }

            try {
                let audioBuffer = fs.readFileSync(outputOgg);
                await conn.sendMessage(jid, {
                    audio: audioBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                });
            } catch (e) {
                console.error(e);
            } finally {
                if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                if (global.plQueues[sender]) {
                    processQueue(conn, jid, sender);
                }
            }
        });
    });
}

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.fromMe ? jid : (m.sender || m.key.participant || m.participant || jid);

    let selectedCmd = command ? `.${command}` : '';
    if (text) selectedCmd += ` ${text}`;
    selectedCmd = selectedCmd.trim().toLowerCase();

    if (selectedCmd === '.pl_stop' || command === 'pl_stop' || text === 'stop') {
        if (global.plQueues[sender]) {
            delete global.plQueues[sender];
            return await conn.sendMessage(jid, { text: '⏹️ Riproduzione della playlist interrotta.' }, { quoted: m });
        } else {
            return await conn.sendMessage(jid, { text: '⚠️ Nessuna riproduzione in corso al momento.' }, { quoted: m });
        }
    }

    if (selectedCmd.startsWith('.pl_del') || command === 'pl_del' || (text && text.startsWith('del'))) {
        let cleanText = text ? text.replace('del', '').trim() : '';
        let indexNum = parseInt(cleanText) - 1;
        let plDb = readDb(playlistDbPath);
        let userTracks = plDb[sender] || [];

        if (isNaN(indexNum) || indexNum < 0 || indexNum >= userTracks.length) {
            return await conn.sendMessage(jid, { text: '❌ Specifica un numero di traccia valido da eliminare (Esempio: `.pl del 2`).' }, { quoted: m });
        }

        let removed = userTracks.splice(indexNum, 1);
        plDb[sender] = userTracks;
        writeDb(playlistDbPath, plDb);

        return await conn.sendMessage(jid, { text: `🗑️ Brano rimosso con successo:\n*${removed[0].title || 'Sconosciuto'}*` }, { quoted: m });
    }

    let isAddAction = command === 'pl_add' || selectedCmd.startsWith('.pl_add') || (text && text.toLowerCase().startsWith('add'));
    if (isAddAction) {
        let linkTootip = '';
        if (text && text.toLowerCase().startsWith('add')) {
            linkTootip = text.replace(/^add\s*/i, '').trim();
        } else {
            linkTootip = text ? text.trim() : '';
        }

        if (!linkTootip.startsWith('http')) {
            return await conn.sendMessage(jid, { text: '❌ Inserisci un link valido dopo `add` (Esempio: `.pl add [link]`).' }, { quoted: m });
        }

        // 🔥 SPOTIFY CON fetch
        if (linkTootip.includes('spotify.com')) {
            await conn.sendMessage(jid, { text: '⏳ Analisi link Spotify in corso...' }, { quoted: m });

            const tracks = await extractSpotifyTracksNoClient(linkTootip);
            
            if (tracks.length === 0) {
                return await conn.sendMessage(jid, { text: '❌ Nessun brano trovato su Spotify.' }, { quoted: m });
            }

            let plDb = readDb(playlistDbPath);
            plDb[sender] = plDb[sender] || [];
            let added = 0;

            for (let track of tracks) {
                try {
                    const search = await yts(track.title);
                    if (search && search.videos && search.videos.length > 0) {
                        const video = search.videos[0];
                        plDb[sender].push({
                            title: video.title,
                            url: video.url,
                            duration: video.timestamp || '--:--'
                        });
                        added++;
                    }
                } catch (e) {
                    console.error('Errore ricerca YouTube:', e);
                }
            }

            if (added === 0) {
                return await conn.sendMessage(jid, { text: '❌ Nessun brano trovato su YouTube per questi titoli.' }, { quoted: m });
            }

            writeDb(playlistDbPath, plDb);
            return await conn.sendMessage(jid, { 
                text: `✅ Aggiunti **${added}** brani da Spotify alla playlist!`
            }, { quoted: m });
        }

        // YouTube standard
        let dumpCmd = `yt-dlp --flat-playlist --dump-json "${linkTootip}"`;

        exec(dumpCmd, { maxBuffer: 1024 * 1024 * 10 }, async (err, stdout) => {
            if (err) {
                return await conn.sendMessage(jid, { text: '❌ Errore durante la lettura del link. Assicurati che sia un link valido.' }, { quoted: m });
            }

            let lines = stdout.trim().split('\n');
            let addedTracks = [];
            let plDb = readDb(playlistDbPath);
            plDb[sender] = plDb[sender] || [];

            for (let line of lines) {
                try {
                    let info = JSON.parse(line);
                    let trackUrl = info.url || (info.id ? `https://www.youtube.com/watch?v=${info.id}` : null);
                    let trackTitle = info.title || 'Brano importato';

                    if (trackUrl) {
                        if (!trackUrl.startsWith('http')) {
                            trackUrl = `https://www.youtube.com/watch?v=${info.id}`;
                        }
                        plDb[sender].push({ title: trackTitle, url: trackUrl });
                        addedTracks.push(trackTitle);
                    }
                } catch (e) {}
            }

            if (addedTracks.length === 0) {
                return await conn.sendMessage(jid, { text: '❌ Nessun brano trovato in questo link.' }, { quoted: m });
            }

            writeDb(playlistDbPath, plDb);
            return await conn.sendMessage(jid, { text: `✅ Aggiunti con successo **${addedTracks.length}** brani alla tua playlist!\nUsa \`.pl\` per vederla o \`.pl all\` per avviare l'ascolto.` }, { quoted: m });
        });
        return;
    }

    if (selectedCmd === '.pl_all' || command === 'pl_all') {
        let plDb = readDb(playlistDbPath);
        let userTracks = plDb[sender] || [];

        if (userTracks.length === 0) {
            return await conn.sendMessage(jid, { text: '❌ La tua playlist è vuota.' }, { quoted: m });
        }

        if (global.plQueues[sender]) {
            return await conn.sendMessage(jid, { text: '⚠️ Coda già attiva! Usa `.pl stop` per fermarla.' }, { quoted: m });
        }

        global.plQueues[sender] = { tracks: [...userTracks], currentIndex: 1, total: userTracks.length };
        await conn.sendMessage(jid, { text: `▶️ Avvio riproduzione continua di ${userTracks.length} brani!` }, { quoted: m });
        return processQueue(conn, jid, sender);
    }

    if (selectedCmd.startsWith('.pl_select_') || command.startsWith('pl_select_')) {
        let indexStr = selectedCmd.replace('.pl_select_', '').replace('pl_select_', '').trim();
        let index = parseInt(indexStr);
        let plDb = readDb(playlistDbPath);
        let userTracks = plDb[sender] || [];
        let track = userTracks[index];

        if (!track || !track.url) {
            return await conn.sendMessage(jid, { text: '❌ Brano non trovato.' }, { quoted: m });
        }

        await conn.sendMessage(jid, { react: { text: '🎧', key: m.key } });
        let timestamp = Date.now();
        let inputMp3 = path.join(__dirname, `_temp_pl_${timestamp}.mp3`);
        let outputOgg = path.join(__dirname, `vocale_pl_${timestamp}.ogg`);
        let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 128k --no-part --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${track.url}"`;

        exec(yt_command, async (error) => {
            if (error) {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);
                return await conn.sendMessage(jid, { text: '❌ Errore download.' }, { quoted: m });
            }

            let ffmpeg_command = `ffmpeg -y -i "${inputMp3}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 -threads 0 -f ogg "${outputOgg}"`;

            exec(ffmpeg_command, async (err2) => {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);
                if (err2 || !fs.existsSync(outputOgg)) {
                    if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                    return await conn.sendMessage(jid, { text: '❌ Errore conversione.' }, { quoted: m });
                }

                try {
                    let audioBuffer = fs.readFileSync(outputOgg);
                    await conn.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m });
                } catch (e) {
                    console.error(e);
                } finally {
                    setTimeout(() => { if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg); }, 5000);
                }
            });
        });
        return;
    }

    let plDb = readDb(playlistDbPath);
    let userTracks = plDb[sender] || [];

    if (userTracks.length === 0) {
        return await conn.sendMessage(jid, { text: '❌ La tua playlist (.pl) è vuota! Aggiungi un brano o una playlist con `.pl add [link]`.' }, { quoted: m });
    }

    let rows = userTracks.map((track, idx) => ({
        title: `${idx + 1}. ${track.title || 'Sconosciuto'}`,
        rowId: `.pl_select_${idx}`,
        description: `Rimuovi con .pl del ${idx + 1}`
    }));

    rows.unshift({ title: "⏹️ Ferma Riproduzione (Stop)", rowId: ".pl_stop", description: "Interrompi la coda" });
    rows.unshift({ title: "▶️ Riproduci Intera Playlist", rowId: ".pl_all", description: "Ascolta in sequenza" });

    let listMessage = {
        text: `✨ *Zeno Bot - La tua Playlist*\n\nGestisci i tuoi brani o aggiungi nuovi link con \`.pl add [link]\`:`,
        footer: "Zeno Bot • Playlist Personale",
        title: "📂 Archivio Musica",
        buttonText: "📜 Gestisci Playlist",
        sections: [{ title: `🎵 Brani (${userTracks.length})`, rows }]
    };

    await conn.sendMessage(jid, listMessage, { quoted: m });
};

handler.command = /^(pl|pl_all|pl_stop|pl_del|pl_add|pl_select_\d+)$/i;

handler.all = async function (m, { conn }) {
    if (m.isBaileys || !m.message) return;

    let rowId = '';
    if (m.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
        rowId = m.message.listResponseMessage.singleSelectReply.selectedRowId;
    } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonReplyValue) {
        try {
            let jsonReply = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.buttonReplyValue);
            rowId = jsonReply.id || jsonReply.rowId || '';
        } catch (e) {}
    }

    if (rowId && (rowId.startsWith('.pl_select_') || rowId === '.pl_all' || rowId === '.pl_stop')) {
        let cleanCmd = rowId.replace('.', '');
        m.sender = m.key.fromMe ? m.key.remoteJid : (m.key.participant || m.participant || m.key.remoteJid);
        
        let fakeText = '';
        let fakeCommand = '';

        if (rowId === '.pl_all') {
            fakeCommand = 'pl_all';
        } else if (rowId === '.pl_stop') {
            fakeCommand = 'pl_stop';
        } else {
            fakeCommand = cleanCmd; 
            fakeText = '';
        }

        try {
            await handler(m, { conn, text: fakeText, command: fakeCommand });
        } catch (e) {
            console.error('Errore gestione interazione playlist:', e);
        }
    }
};

handler.help = ['pl'];
handler.tags = ['downloader'];

export default handler;
