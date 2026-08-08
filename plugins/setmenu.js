const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const menuConfigPath = path.join(__dirname, '../menu_config.json');

module.exports = {
    name: 'setmenu',
    description: 'Imposta l\'immagine o la GIF per il menù',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Controlliamo se c'è un'immagine o un video (GIF) nel messaggio corrente o in quello quotato
        const mediaMessage = m.message?.imageMessage || m.message?.videoMessage || 
                             quotedMessage?.imageMessage || quotedMessage?.videoMessage;

        if (!mediaMessage) {
            await sock.sendMessage(sender, { 
                text: '⚠️ *Attenzione!* Invia un\'immagine/GIF o rispondi a una di esse con il comando `.setmenu` per impostarla come sfondo del menù.' 
            }, { quoted: m });
            return;
        }

        try {
            // Rileviamo se è un video (spesso usato per le GIF) o un'immagine
            const isVideo = !!(m.message?.videoMessage || quotedMessage?.videoMessage);
            const mediaType = isVideo ? 'video' : 'image';

            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const ext = isVideo ? 'mp4' : 'jpg';
            const filePath = path.join(__dirname, `../menu_media.${ext}`);
            
            // Se esiste già un file multimediale precedente con estensione diversa, lo puliamo
            const oldJpg = path.join(__dirname, '../menu_media.jpg');
            const oldMp4 = path.join(__dirname, '../menu_media.mp4');
            try { if (fs.existsSync(oldJpg)) fs.unlinkSync(oldJpg); } catch(e) {}
            try { if (fs.existsSync(oldMp4)) fs.unlinkSync(oldMp4); } catch(e) {}

            fs.writeFileSync(filePath, buffer);

            // Aggiorniamo la configurazione JSON includendo anche la variabile isVideo corretta
            let menuData = { 
                caption: undefined, 
                image: filePath,
                isVideo: isVideo // SBLOCCATO: Ora scrive true se è un video/GIF o false se è una foto
            };

            if (fs.existsSync(menuConfigPath)) {
                try {
                    const existing = JSON.parse(fs.readFileSync(menuConfigPath, 'utf8'));
                    if (existing.caption) menuData.caption = existing.caption;
                } catch(e) {}
            }

            fs.writeFileSync(menuConfigPath, JSON.stringify(menuData, null, 2));

            await sock.sendMessage(sender, { 
                text: '✅ *Menù aggiornato con successo!* Adesso digita `.menu` per vedere la nuova grafica in azione.' 
            }, { quoted: m });

        } catch (error) {
            console.error('Errore nel comando setmenu:', error);
            await sock.sendMessage(sender, { text: '❌ Errore durante il salvataggio del file multimediale.' }, { quoted: m });
        }
    }
};

