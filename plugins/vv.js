module.exports = {
    name: 'vv',
    description: 'Salva e rispedisce i media visualizza una volta sola',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        // Cerca il messaggio quotato (il messaggio a cui l'utente risponde scrivendo .vv)
        const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMessage) {
            await sock.sendMessage(chatId, { text: 'Rispondi a un messaggio "visualizza una volta sola" (foto o video) con .vv' }, { quoted: m });
            return;
        }

        // Estrae il contenuto multimediale (supporta sia imageMessage che videoMessage, anche nelle versioni viewOnce)
        let mediaMessage = quotedMessage.imageMessage || 
                           quotedMessage.videoMessage || 
                           quotedMessage.viewOnceMessage?.message?.imageMessage || 
                           quotedMessage.viewOnceMessage?.message?.videoMessage ||
                           quotedMessage.viewOnceMessageV2?.message?.imageMessage ||
                           quotedMessage.viewOnceMessageV2?.message?.videoMessage;

        if (!mediaMessage) {
            await sock.sendMessage(chatId, { text: 'Il messaggio quotato non è una foto o un video valido.' }, { quoted: m });
            return;
        }

        try {
            // Importa il modulo per scaricare il media tramite Baileys
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            
            // Crea un finto oggetto messaggio compatibile con il downloader di Baileys
            const fakeMessage = {
                key: m.message.extendedTextMessage.contextInfo.stanzaId,
                message: quotedMessage
            };

            const buffer = await downloadMediaMessage(
                fakeMessage,
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            const caption = mediaMessage.caption || '';
            const isVideo = !!mediaMessage.seconds;

            if (isVideo) {
                await sock.sendMessage(chatId, { 
                    video: buffer, 
                    caption: caption 
                }, { quoted: m });
            } else {
                await sock.sendMessage(chatId, { 
                    image: buffer, 
                    caption: caption 
                }, { quoted: m });
            }

        } catch (error) {
            console.error('Errore nel comando vv:', error);
            await sock.sendMessage(chatId, { text: 'Errore durante il recupero del file multimediale.' }, { quoted: m });
        }
    }
};
