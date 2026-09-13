let handler = async (m, { conn }) => {
    let chatId = m.key.remoteJid;
    let sender = m.key.participant || m.participant || chatId;
    let senderNumber = sender.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');

    try {
        // Interroghiamo il server Express del sito
        let response = await fetch(`http://localhost:3000/api/now-playing/${senderNumber}`);
        
        if (response.status === 404) {
            // Se l'utente non è registrato, generiamo il token e mandiamo il link
            let tokenRes = await fetch('http://localhost:3000/api/generate-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsapp_number: senderNumber })
            });
            let tokenData = await tokenRes.json();
            
            return await conn.sendMessage(chatId, { 
                text: `🎵 *Zeno Music - Registrazione*\n\nNon sei ancora registrato o non hai impostato il profilo. Clicca sul link qui sotto per accedere al sito, inserire il tuo nickname e la foto:\n\n${tokenData.link}` 
            }, { quoted: m });
        }

        let userData = await response.json();

        if (!userData.current_video_id) {
            return await conn.sendMessage(chatId, { 
                text: `🎧 Ciao *${userData.nickname || 'Utente'}*! Al momento non stai riproducendo nessuna canzone sul player del sito. Aprilo e metti su qualcosa!` 
            }, { quoted: m });
        }

        // Se sta ascoltando qualcosa, comporremo la card con i dati e la foto profilo
        let cardText = `🎵 *NOW PLAYING* 🎵\n\n` +
                       `👤 *Ascoltatore:* ${userData.nickname || 'Zeno Music User'}\n` +
                       `🎧 *Brano:* ${userData.current_title || 'Sconosciuto'}\n` +
                       `🎤 *Artista:* ${userData.current_artist || 'N/A'}`;

        if (userData.avatar_url && userData.avatar_url.startsWith('http')) {
            await conn.sendMessage(chatId, {
                image: { url: userData.avatar_url },
                caption: cardText
            }, { quoted: m });
        } else {
            await conn.sendMessage(chatId, { text: cardText }, { quoted: m });
        }

    } catch (err) {
        console.error('Errore nel comando .sp:', err);
        return await conn.sendMessage(chatId, { text: '❌ Errore di comunicazione con il server musicale del sito.' }, { quoted: m });
    }
};

handler.command = /^sp$/i;
handler.help = ['sp'];
handler.tags = ['music'];

export default handler;
