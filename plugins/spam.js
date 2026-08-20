// ID corretto estratto dai tuoi log precedenti
const ownerId = '129601359589600@lid'; 

module.exports = {
    name: 'spam',
    category: 'owner',
    description: 'Spamma un messaggio con tagall per un numero specifico di volte (Solo Owner)',
    
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        // Estrae la stringa numerica pulita dal mittente
        const senderClean = sender.split(':')[0].split('@')[0];

        // Protezione owner aggiornata con il tuo ID reale
        const isOwner = sender.includes(ownerId) || senderClean.includes(ownerId) || senderClean.includes('zenov2');
        
        if (!isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Questo comando è riservato al Creatore.' }, { quoted: m });
        }

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Questo comando può essere usato solo nei gruppi.' });
        }

        // Estrae il numero di volte e il testo
        const count = parseInt(args[0]);
        const textToSpam = args.slice(1).join(' ');

        if (isNaN(count) || count <= 0 || !textToSpam) {
            return sock.sendMessage(chatId, { text: '⚠️ Usa il formato corretto! Esempio: `.spam 20 Ciao a tutti`' }, { quoted: m });
        }

        // Limite di sicurezza per evitare il ban istantaneo del bot da parte di WhatsApp
        const maxSpam = Math.min(count, 100);

        try {
            // Recupera i dettagli del gruppo e i partecipanti
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;
            const mentions = participants.map(p => p.id);

            // Genera la lista visiva dei tag (es. @39333xxxx @203779...)
            const tagList = participants.map(p => `@${p.id.split(':')[0].split('@')[0]}`).join(' ');
            const messageText = `${textToSpam}\n\n${tagList}`;

            // Reazione iniziale di avvio
            await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

            // Ciclo di invio dei messaggi spammati
            for (let i = 0; i < maxSpam; i++) {
                await sock.sendMessage(chatId, { 
                    text: messageText, 
                    mentions: mentions 
                });
                // Pausa di 1.2 secondi per evitare il sovraccarico di Baileys e ridurre il rischio ban
                await new Promise(resolve => setTimeout(resolve, 1200));
            }

            // Reazione di successo a fine ciclo
            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });

        } catch (err) {
            console.error('Errore spam:', err);
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(chatId, { text: '❌ Errore durante l\'esecuzione dello spam.' }, { quoted: m });
        }
    }
};

