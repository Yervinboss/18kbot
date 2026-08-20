const ytSearch = require('yt-search');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'song',
    description: 'Scarica brani musicali e copertina da YouTube senza cookie e in modo ottimizzato',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const q = args.join(' ');

        if (!q) {
            return await sock.sendMessage(chatId, { text: '❌ Per favore, inserisci il titolo della canzone!' }, { quoted: m });
        }

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

            const search = await ytSearch(q);
            const videos = search.videos;
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ Nessun risultato trovato per la ricerca: ${q}` }, { quoted: m });
            }

            const song = videos[0];
            const audioUrl = song.url;
            const thumbnail = song.thumbnail;
            const title = song.title;
            const duration = song.timestamp;

            const outputFileName = `audio_${Date.now()}.mp3`;
            const outputPath = path.join(__dirname, '../', outputFileName);

// Comando yt-dlp super compatibile (seleziona automaticamente il miglior audio disponibile)
const ytdlpCommand = `yt-dlp --extractor-args "youtube:player-client=android,web" -f "bestaudio/best" -x --audio-format mp3 --no-playlist -o "${outputPath}" "${audioUrl}"`;

            exec(ytdlpCommand, async (error, stdout, stderr) => {
                // BLOCCO TRY...CATCH INTERNO: Protegge l'invio ed evita crash globali
                try {
                    if (error) {
                        console.error("Errore yt-dlp:", error);
                        return await sock.sendMessage(chatId, { text: '❌ Si è verificato un errore durante il download del brano.' }, { quoted: m });
                    }

                    if (fs.existsSync(outputPath)) {
                        if (thumbnail) {
                            await sock.sendMessage(chatId, {
                                image: { url: thumbnail },
                                caption: `🎵 *${title}*\n⏱️ **Durata:** ${duration}`
                            }, { quoted: m });
                        }

                        // Invio del file audio effettivo
                        await sock.sendMessage(chatId, {
                            audio: { url: outputPath },
                            mimetype: 'audio/mpeg',
                            ptt: false
                        }, { quoted: m });

                        await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
                        
                        // Elimina il file temporaneo mp3 locale
                        if (fs.existsSync(outputPath)) {
                            fs.unlinkSync(outputPath);
                        }
                    } else {
                        await sock.sendMessage(chatId, { text: '❌ Errore: il file audio non è stato generato correttamente.' }, { quoted: m });
                    }
                } catch (internalError) {
                    console.error("Errore gestito nell'invio dei media di song:", internalError.message);
                    // Rimuove il file se è rimasto appeso per evitare di intasare la memoria
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                }
            });

        } catch (e) {
            console.error("Errore generale nel plugin song:", e);
            await sock.sendMessage(chatId, { text: `❌ Errore imprevisto: ${e.message}` }, { quoted: m });
        }
    }
};

