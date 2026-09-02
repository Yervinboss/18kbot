import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import yts from 'yt-search';
import { downloadContentFromMessage } from '@realvare/baileys';
import { isOwner } from './owner.js';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve('database/shazam.json');
const shazamMusicDbPath = path.join(__dirname, 'shazam_music_db.json');
const playlistDbPath = path.join(__dirname, '../playlist_db.json'); // Percorso al DB della playlist

const makeMessageID = () => 'ZENO' + crypto.randomBytes(8).toString('hex').toUpperCase();

function getConfig() {
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({ apiKey: '' }));
    }
    try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch (e) { return { apiKey: '' }; }
}

function saveConfig(data) {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

function readMusicDB() {
    if (!fs.existsSync(shazamMusicDbPath)) return {};
    try { return JSON.parse(fs.readFileSync(shazamMusicDbPath, 'utf-8')); } catch (e) { return {}; }
}

function writeMusicDB(data) {
    fs.writeFileSync(shazamMusicDbPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Funzione helper per leggere/scrivere la playlist da shazam
function readPlaylistDB() {
    if (!fs.existsSync(playlistDbPath)) return {};
    try { return JSON.parse(fs.readFileSync(playlistDbPath, 'utf-8')); } catch (e) { return {}; }
}

function writePlaylistDB(data) {
    try { fs.writeFileSync(playlistDbPath, JSON.stringify(data, null, 2), 'utf-8'); } catch (e) {}
}

async function sendWithTwoButtons(conn, jid, text) {
    let payload = {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text },
                    footer: { text: 'Zeno Bot - Shazam & Playlist' },
                    nativeFlowMessage: {
                        buttons: [
                            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 Riproduci', id: 'shazam_play' }) },
                            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '➕ Aggiungi a PL', id: 'shazam_add_pl' }) }
                        ]
                    }
                }
            }
        }
    };
    return await conn.relayMessage(jid, payload, { messageId: makeMessageID() });
}

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.participant || jid;
    let cmd = (command || '').toLowerCase();

    let buttonId = 
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.templateButtonReplyMessage?.selectedId ||
        m.msg?.selectedButtonId;

    if (!buttonId && m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonReplyValue) {
        try {
            let jsonReply = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.buttonReplyValue);
            buttonId = jsonReply.id || jsonReply.rowId || '';
        } catch (e) {}
    }

    if (buttonId) {
        cmd = buttonId.trim().toLowerCase();
    }

    if (cmd === 'setshazamkey') {
        if (!isOwner(sender)) {
            return await conn.sendMessage(jid, { text: '❌ Solo il creatore del bot può impostare la chiave API.' }, { quoted: m });
        }
        let key = (text || '').trim();
        if (!key) {
            return await conn.sendMessage(jid, { text: '❌ Scrivi la chiave API dopo il comando.\nEsempio: `.setshazamkey abc123...`' }, { quoted: m });
        }
        let config = getConfig();
        config.apiKey = key;
        saveConfig(config);
        return await conn.sendMessage(jid, { text: '✅ Chiave API di riconoscimento musicale impostata correttamente!' }, { quoted: m });
    }

    // Gestione del pulsante per aggiungere la traccia di Shazam direttamente alla playlist dell'utente
    if (cmd === 'shazam_add_pl') {
        let musicDb = readMusicDB();
        let trackData = musicDb[jid]; // Può essere un URL stringa o un oggetto salvato in precedenza

        let targetUrl = typeof trackData === 'object' ? trackData.url : trackData;
        let targetTitle = typeof trackData === 'object' ? trackData.title : 'Brano da Shazam';
        let targetDuration = typeof trackData === 'object' ? trackData.duration : '--:--';

        if (!targetUrl) {
            return await conn.sendMessage(jid, { text: '❌ Traccia non trovata o sessione scaduta. Fai di nuovo `.shazam`.' }, { quoted: m });
        }

        let plDb = readPlaylistDB();
        if (!plDb[sender]) plDb[sender] = [];

        // Evitiamo duplicati esatti basati sull'URL
        let exists = plDb[sender].some(t => t.url === targetUrl);
        if (exists) {
            return await conn.sendMessage(jid, { text: '⚠️ Questo brano è già presente nella tua playlist (.pl)!' }, { quoted: m });
        }

        plDb[sender].push({
            title: targetTitle,
            url: targetUrl,
            duration: targetDuration
        });

        writePlaylistDB(plDb);
        return await conn.sendMessage(jid, { text: `✅ Brano aggiunto con successo alla tua playlist (.pl)!\n🎵 *${targetTitle}*` }, { quoted: m });
    }

    if (cmd === 'shazam_play') {
        let musicDb = readMusicDB();
        let trackData = musicDb[jid];
        let videourl = typeof trackData === 'object' ? trackData.url : trackData;

        if (!videourl) {
            return await conn.sendMessage(jid, { text: '❌ Errore: Il link della canzone è scaduto o non trovato. Fai di nuovo `.shazam`.' }, { quoted: m });
        }

        await conn.sendMessage(jid, { react: { text: '🎧', key: m.key } });

        let inputMp3 = path.join(__dirname, `_shazam_temp_${Date.now()}.mp3`);
        let outputOgg = path.join(__dirname, `shazam_vocale_${Date.now()}.ogg`);

        let yt_command = `yt-dlp --extract-audio --audio-format mp3 --audio-quality 0 --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${videourl}"`;
        
        exec(yt_command, async (error, stdout, stderr) => {
            if (error) {
                return await conn.sendMessage(jid, { text: '❌ Errore durante il download del brano.' }, { quoted: m });
            }

            let ffmpeg_command = `ffmpeg -y -i "${inputMp3}" -c:a libopus -b:a 192k -ar 48000 -ac 1 -application voip -map_metadata -1 -threads 4 -f ogg "${outputOgg}"`;
            
            exec(ffmpeg_command, async (err2, stdout2, stderr2) => {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);

                if (err2) {
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
                        console.error('Errore invio audio shazam:', err);
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
        return;
    }

    if (cmd === 'shazam') {
        let config = getConfig();
        if (!config.apiKey) {
            return await conn.sendMessage(jid, { text: '❌ Nessuna chiave API impostata.\nUsa `.setshazamkey <chiave>` (disponibile su https://audd.io)' }, { quoted: m });
        }

        let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
        else if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;

        let audioMsg = quoted?.audioMessage || m.message?.audioMessage;
        let videoMsg = quoted?.videoMessage || m.message?.videoMessage;

        if (!audioMsg && !videoMsg) {
            return await conn.sendMessage(jid, { text: '🎧 *ZENO SHAZAM*\n\n❌ Rispondi a un vocale, audio o video con `.shazam` per riconoscere la canzone!' }, { quoted: m });
        }

        await conn.sendMessage(jid, { react: { text: '🔎', key: m.key } });

        let tmpIn = path.resolve(`shazam_in_${m.key.id}`);
        let tmpMp3 = path.resolve(`shazam_out_${m.key.id}.mp3`);

        try {
            let mediaBuffer;
            if (audioMsg) {
                mediaBuffer = await downloadMedia(audioMsg, 'audio');
                fs.writeFileSync(tmpIn + '.ogg', mediaBuffer);
                await execPromise(`ffmpeg -y -i "${tmpIn}.ogg" -t 15 "${tmpMp3}"`);
            } else {
                mediaBuffer = await downloadMedia(videoMsg, 'video');
                fs.writeFileSync(tmpIn + '.mp4', mediaBuffer);
                await execPromise(`ffmpeg -y -i "${tmpIn}.mp4" -vn -t 15 "${tmpMp3}"`);
            }

            if (!fs.existsSync(tmpMp3)) throw new Error('Estrazione audio fallita');

            let formData = new FormData();
            formData.append('api_token', config.apiKey);
            formData.append('file', new Blob([fs.readFileSync(tmpMp3)]), 'audio.mp3');
            formData.append('return', 'apple_music,spotify');

            let response = await fetch('https://api.audd.io/', { method: 'POST', body: formData });
            let result = await response.json();

            if (result.status !== 'success' || !result.result) {
                await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
                return await conn.sendMessage(jid, { text: '❌ Non sono riuscito a riconoscere questa canzone.' }, { quoted: m });
            }

            let song = result.result;
            let txt = `🎧 *ZENO SHAZAM*\n\n`;
            txt += `🎵 *Titolo:* ${song.title}\n`;
            txt += `🎤 *Artista:* ${song.artist}\n`;
            if (song.album) txt += `💿 *Album:* ${song.album}\n`;

            await conn.sendMessage(jid, { react: { text: '🎵', key: m.key } });

            let hasPlayButton = false;
            try {
                let search = await yts(`${song.artist} ${song.title}`);
                if (search?.videos?.length > 0) {
                    let musicDb = readMusicDB();
                    // Salviamo un oggetto strutturato per ricavare comodamente anche titolo e durata
                    musicDb[jid] = {
                        url: search.videos[0].url,
                        title: `${song.artist} - ${song.title}`,
                        duration: search.videos[0].timestamp || '--:--'
                    };
                    writeMusicDB(musicDb);
                    hasPlayButton = true;
                }
            } catch (e) {
                console.error('Errore ricerca YouTube per shazam:', e);
            }

            if (hasPlayButton) {
                return await sendWithTwoButtons(conn, jid, txt);
            } else {
                return await conn.sendMessage(jid, { text: txt }, { quoted: m });
            }

        } catch (e) {
            console.error('Errore shazam:', e);
            await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
            return await conn.sendMessage(jid, { text: '❌ Errore durante il riconoscimento della canzone.' }, { quoted: m });
        } finally {
            for (let ext of ['.ogg', '.mp4']) {
                if (fs.existsSync(tmpIn + ext)) fs.unlinkSync(tmpIn + ext);
            }
            if (fs.existsSync(tmpMp3)) fs.unlinkSync(tmpMp3);
        }
    }
};

handler.command = /^(shazam|setshazamkey|shazam_play|shazam_add_pl)$/i;
handler.help = ['shazam', 'setshazamkey'];
handler.tags = ['fun'];

export default handler;
