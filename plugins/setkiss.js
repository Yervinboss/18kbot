const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'setkiss',
    description: 'Imposta il video o la GIF locale per il comando kiss',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Controlliamo se c'è un video (GIF) nel messaggio o in quello quotato
        const mediaMessage = m.message?.videoMessage || quotedMessage?.videoMessage;

        if (!mediaMessage) {
            await sock.sendMessage(sender, { 
                text: '⚠️ *Attenzione!* Rispondi a un video o a una GIF con il comando `.setkiss` per impostarla come animazione del bacio.' 
            }, { quoted: m });
            return;
        }

        try {
            // Scarichiamo il flusso del video
            const stream = await downloadContentFromMessage(mediaMessage, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Assicuriamoci che la cartella assets esista prima di scrivere
            const assetsFolder = path.join(__dirname, 'assets');
            if (!fs.existsSync(assetsFolder)) {
                fs.mkdirSync(assetsFolder, { recursive: true });
            }

            const filePath = path.join(assetsFolder, 'kiss.mp4');
            fs.writeFileSync(filePath, buffer);

            await sock.sendMessage(sender, { 
                text: '✅ *Animazione Kiss salvata in locale con successo!* Ora prova il comando `.kiss` taggando qualcuno.' 
            }, { quoted: m });

        } catch (error) {
            console.error('Errore nel comando setkiss:', error);
            await sock.sendMessage(sender, { text: '❌ Errore durante il salvataggio del file multimediale.' }, { quoted: m });
        }
    }
};

