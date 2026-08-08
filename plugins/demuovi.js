module.exports = {
    name: 'demuovi',
    description: 'Rimuove i poteri di amministratore a un utente (eseguibile solo da un admin)',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        // Controlla se siamo in un gruppo
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: 'Questo comando può essere usato solo nei gruppi.' }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            // 1. Verifica che CHI ESEGUE il comando sia un amministratore
            const senderJid = m.key.participant || m.participant || m.key.remoteJid;
            const senderParticipant = participants.find(p => p.id === senderJid);
            const isSenderAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');

            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, { text: 'Devi essere un amministratore per usare questo comando.' }, { quoted: m });
                return;
            }

            // 2. Trova l'utente da demuovere (tramite menzione oppure rispondendo al suo messaggio)
            let targetJid = null;
            const mentionedJids = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;

            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else if (quotedParticipant) {
                targetJid = quotedParticipant;
            }

            if (!targetJid) {
                await sock.sendMessage(chatId, { text: 'Tagga un amministratore o rispondi al suo messaggio per rimuovergli i poteri.' }, { quoted: m });
                return;
            }

            // 3. Esegue la rimozione dei poteri nel gruppo tramite Baileys
            await sock.groupParticipantsUpdate(chatId, [targetJid], 'demote');
            
            await sock.sendMessage(chatId, { text: 'Utente rimosso da amministratore con successo.' }, { quoted: m });

        } catch (error) {
            console.error('Errore nel comando demuovi:', error);
            await sock.sendMessage(chatId, { text: 'Errore durante l\'operazione. Assicurati che il bot sia amministratore del gruppo.' }, { quoted: m });
        }
    }
};

