import axios from 'axios';

let handler = async (m, { conn, text }) => {
    let jid = m.key.remoteJid;
    if (!text) return await conn.sendMessage(jid, { text: `🎞️ *RICERCA GIF ANIMATE*\n\n❌ Scrivi il personaggio o l'azione da cercare!\nEsempio: \`.gif Miku dance\`` }, { quoted: m });

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
        // Cerca GIF animate tramite l'endpoint pubblico ultra-veloce di Giphy
        let searchUrl = `https://giphy.com{encodeURIComponent(text)}&limit=10`;
        let res = await axios.get(searchUrl);
        let data = res.data?.data;

        if (!data || data.length === 0) {
            await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
            return await conn.sendMessage(jid, { text: '❌ Nessuna GIF animata trovata per questo anime!' }, { quoted: m });
        }

        // Sceglie una GIF casuale tra i risultati stabili
        let randomGif = data[Math.floor(Math.random() * data.length)];
        let gifUrl = randomGif.images.fixed_height.url;

        await conn.sendMessage(jid, { react: { text: '🎞️', key: m.key } });

        // Invio nativo Baileys: invia come video impostando gifPlayback per riprodurla in loop fisso
        return await conn.sendMessage(jid, {
            video: { url: gifUrl },
            caption: `🎬 *GIF Animata:* _${text}_`,
            gifPlayback: true
        }, { quoted: m });

    } catch (e) {
        console.error(e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return await conn.sendMessage(jid, { text: '❌ Errore durante il recupero della GIF animata!' }, { quoted: m });
    }
};

handler.help = ['gif <ricerca>'];
handler.tags = ['media'];
handler.command = /^(gif|animazione)$/i;

export default handler;
