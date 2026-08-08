module.exports = {
    name: 'lyrics',
    description: 'Get lyrics of a song along with artist and image',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const songTitle = args.join(' ').trim();
        
        if (!songTitle) {
            await sock.sendMessage(chatId, {
                text: '*Please enter the song name to get the lyrics!*\nUsage: `.lyrics <song name>`',
                quoted: m
            });
            return;
        }

        try {
            const apiUrl = `https://discardapi.dpdns.org/api/music/lyrics?apikey=qasim&song=${encodeURIComponent(songTitle)}`;
            const res = await fetch(apiUrl);
            
            if (!res.ok) {
                throw new Error(`API request failed with status ${res.status}`);
            }

            const data = await res.json();
            const messageData = data?.result?.message;

            if (!messageData?.lyrics) {
                await sock.sendMessage(chatId, {
                    text: `❌ Sorry, I couldn't find any lyrics for "${songTitle}".`,
                    quoted: m
                });
                return;
            }

            const { artist, lyrics, image, title, url } = messageData;
            const maxChars = 4096;
            const lyricsOutput = lyrics.length > maxChars ? `${lyrics.slice(0, maxChars - 3)}...` : lyrics;
            
            const caption = `
🎵 *${title}*
👤 *Artist:* ${artist}
🔗 *URL:* ${url}

📝 *Lyrics:*
${lyricsOutput}
            `.trim();

            if (image) {
                await sock.sendMessage(chatId, {
                    image: { url: image },
                    caption,
                    quoted: m
                }, { quoted: m });
            } else {
                await sock.sendMessage(chatId, {
                    text: caption
                }, { quoted: m });
            }
        } catch (error) {
            console.error('Lyrics Command Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ An error occurred while fetching the lyrics for "${songTitle}".`,
                quoted: m
            }, { quoted: m });
        }
    }
};

