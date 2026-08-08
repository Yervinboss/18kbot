const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'kiss',
    description: 'Manda un bacio anime a un utente taggato usando file locali',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        
        // 1. Recuperiamo chi viene taggato o quotato
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        const mentionedJids = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targetJid = mentionedJids[0] || quotedParticipant;

        if (!targetJid) {
            await sock.sendMessage(sender, { 
                text: '⚠️ *Attenzione!* Devi taggare qualcuno o rispondere al suo messaggio per baciarlo! Es: `.kiss @utente`' 
            }, { quoted: m });
            return;
        }

        // 2. Definiamo il percorso dei file locali (proprio come menu_media)
        const assetsFolder = path.join(__dirname, 'assets');
        
        // Se non hai ancora inserito file tuoi, usiamo questo video di test sicuro e pre-ottimizzato
        let localGifPath = path.join(assetsFolder, 'kiss.mp4');

        // Fallback automatico: se non trova il file locale, usa un link super-compatibile
        let videoOption = fs.existsSync(localGifPath) ? { url: localGifPath } : { url: 'https://giphy.com' };

        // Estrae i numeri puliti per il testo
        const senderNumber = m.key.participant || m.key.remoteJid;
        const cleanSender = `@${senderNumber.split('@')[0]}`;
        const cleanTarget = `@${targetJid.split('@')[0]}`;

        try {
            // 3. Invio immediato con lo stesso metodo del menu
            await sock.sendMessage(sender, {
                video: videoOption, // Usa il file locale come fa .menu!
                caption: `🌸 ${cleanSender} *ha dato un bacio a* ${cleanTarget}! 💕`,
                gifPlayback: true,
                mimetype: 'video/mp4',
                mentions: [senderNumber, targetJid]
            }, { quoted: m });

        } catch (error) {
            console.error('Errore nel comando kiss stile menu:', error);
            await sock.sendMessage(sender, { text: '❌ Errore durante l\'invio dell\'animazione.' }, { quoted: m });
        }
    }
};

