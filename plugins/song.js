const ytSearch = require('yt-search');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'song',
    description: 'Scarica brani musicali e copertina da YouTube usando i cookie.',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const q = args.join(' ');

        if (!q) {
            await sock.sendMessage(chatId, { text: "Per favore, inserisci il titolo del brano o il link di YouTube da cercare!" }, { quoted: m });
            return;
        }

        try {
            // Mette una reazione (cuore) al messaggio dell'utente per indicare l'avvio
            await sock.sendMessage(chatId, { react: { text: "❤️", key: m.key } });

            const search = await ytSearch(q);
            const videos = search.videos;
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: "Nessun risultato trovato per la tua ricerca." }, { quoted: m });
                return;
            }

            const song = videos[0];
            const audioUrl = song.url;
            const thumbnail = song.thumbnail;
            const title = song.title;

            const outputFileName = `audio_${Date.now()}.mp3`;
            const outputPath = path.join(__dirname, '..', outputFileName);
            const cookiesPath = path.join(__dirname, '..', 'cookies.txt');

            const cookieOption = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
            const ytdlpCommand = `yt-dlp ${cookieOption} -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${audioUrl}"`;

            exec(ytdlpCommand, async (error, stdout, stderr) => {
                if (error) {
                    console.error(error);
                    await sock.sendMessage(chatId, { text: "Si è verificato un errore durante il download del file." }, { quoted: m });
                    return;
                }

                if (fs.existsSync(outputPath)) {
                    // Invia la copertina con i dettagli
                    if (thumbnail) {
                        await sock.sendMessage(chatId, { 
                            image: { url: thumbnail }, 
                            caption: `🎵 *${title}*\n⏱️ Durata: ${song.timestamp}` 
                        }, { quoted: m });
                    }

                    // Invia l'audio
                    await sock.sendMessage(chatId, { 
                        audio: { url: outputPath }, 
                        mimetype: 'audio/mpeg', 
                        ptt: false 
                    }, { quoted: m });

                    // Reazione finale di completamento (opzionale, es. ✔️)
                    await sock.sendMessage(chatId, { react: { text: "✔️", key: m.key } });

                    fs.unlinkSync(outputPath);
                } else {
                    await sock.sendMessage(chatId, { text: "Errore: il file audio non è stato generato correttamente." }, { quoted: m });
                }
            });

        } catch (e) {
            console.error(e);
            await sock.sendMessage(chatId, { text: `Errore imprevisto: ${e.message}` }, { quoted: m });
        }
    }
};
