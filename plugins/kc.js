const axios = require('axios');

module.exports = {
    name: 'kc',
    category: 'fun',
    description: 'Crea uno sticker con la scritta personalizzata',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const text = args.join(' ');

        if (!text) {
            return sock.sendMessage(chatId, { text: '⚠️ Scrivi qualcosa dopo il comando! Esempio: `.kc ciao`' });
        }

        try {
            // Reagisce subito al messaggio con un'emoji verde di elaborazione silenziosa (opzionale) o va diretto
            const encodedText = encodeURIComponent(text);
            
            // Richiesta dell'immagine generata con il testo
            const response = await axios.get(`https://single-developers.cloud/api/maker/carbon?text=${encodedText}&apikey=free`, {
                responseType: 'arraybuffer'
            }).catch(async () => {
                return await axios.get(`https://api.erdwst.com/api/maker/textpro?text=${encodedText}&theme=neon`, { responseType: 'arraybuffer' });
            });

            const buffer = Buffer.from(response.data);

            // Invia direttamente lo sticker/immagine senza messaggi di testo in mezzo
            await sock.sendMessage(chatId, { 
                image: buffer
            });

        } catch (err) {
            console.error('Errore kc:', err);
            // Segnale visivo rosso in caso di fallimento
            await sock.sendMessage(chatId, { text: '🔴' });
        }
    }
};

