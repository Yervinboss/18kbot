import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const playlistDbPath = path.join(__dirname, '../playlist_db.json');

const readDb = (p) => {
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {}; }
};

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    
    // Ripristiniamo la lettura pulita del mittente reale senza alterare il formato del JID
    let sender = m.key.fromMe ? jid : (m.sender || m.key.participant || m.participant || jid);

    let selectedCmd = command ? `.${command}` : '';
    if (text) selectedCmd += ` ${text}`;
    selectedCmd = selectedCmd.trim().toLowerCase();

    // Se l'utente ha cliccato su un brano della lista
    if (selectedCmd.startsWith('.pl_select_') || command.startsWith('pl_select_')) {
        let indexStr = selectedCmd.replace('.pl_select_', '').replace('pl_select_', '').trim();
        let index = parseInt(indexStr);

        let plDb = readDb(playlistDbPath);
        let userTracks = plDb[sender] || [];
        let track = userTracks[index];

        if (!track || !track.url) {
            return await conn.sendMessage(jid, { text: '❌ Brano non trovato nella tua playlist.' }, { quoted: m });
        }

        await conn.sendMessage(jid, { react: { text: '🎧', key: m.key } });

        let timestamp = Date.now();
        let inputMp3 = path.join(__dirname, `_temp_pl_${timestamp}.mp3`);
        let outputOgg = path.join(__dirname, `vocale_pl_${timestamp}.ogg`);

        let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 128k --no-part --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${track.url}"`;

        exec(yt_command, async (error) => {
            if (error) {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);
                return await conn.sendMessage(jid, { text: '❌ Errore durante il download del brano.' }, { quoted: m });
            }

            let ffmpeg_command = `ffmpeg -y -i "${inputMp3}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 -threads 0 -f ogg "${outputOgg}"`;

            exec(ffmpeg_command, async (err2) => {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3);

                if (err2 || !fs.existsSync(outputOgg)) {
                    if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg);
                    return await conn.sendMessage(jid, { text: '❌ Errore durante la conversione audio.' }, { quoted: m });
                }

                try {
                    let audioBuffer = fs.readFileSync(outputOgg);
                    await conn.sendMessage(jid, {
                        audio: audioBuffer,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, { quoted: m });
                } catch (e) {
                    console.error(e);
                } finally {
                    setTimeout(() => { if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg); }, 5000);
                }
            });
        });
        return;
    }

    // Legge la playlist associata al JID esatto dell'utente nel JSON
    let plDb = readDb(playlistDbPath);
    let userTracks = plDb[sender] || [];

    if (userTracks.length === 0) {
        return await conn.sendMessage(jid, { text: '❌ La tua playlist (.pl) è vuota! Aggiungi qualche brano prima.' }, { quoted: m });
    }

    let rows = userTracks.map((track, idx) => ({
        title: `${idx + 1}. ${track.title || 'Brano Sconosciuto'}`,
        rowId: `.pl_select_${idx}`,
        description: `Durata: ${track.duration || '--:--'}`
    }));

    let sections = [
        {
            title: `🎵 I tuoi brani (${userTracks.length})`,
            rows: rows
        }
    ];

    let listMessage = {
        text: `✨ *Zeno Bot - La tua Playlist*\n\nEcco l'elenco dei tuoi brani salvati. Tocca il pulsante qui sotto per scegliere cosa ascoltare:`,
        footer: "Zeno Bot • Playlist Personale",
        title: "📂 Archivio Musica",
        buttonText: "📜 Apri Elenco Brani",
        sections
    };

    await conn.sendMessage(jid, listMessage, { quoted: m });
};

handler.command = /^(pl|pl_select_\d+)$/i;

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

    if (rowId && rowId.startsWith('.pl_select_')) {
        let cleanCmd = rowId.replace('.', '');
        let parts = cleanCmd.split('_');
        
        m.sender = m.key.fromMe ? m.key.remoteJid : (m.key.participant || m.participant || m.key.remoteJid);
        
        return await this.plugins['pl.js'].handler(m, { conn, text: `select_${parts[2]}`, command: 'pl' });
    }
};

handler.help = ['pl'];
handler.tags = ['downloader'];

export default handler;
