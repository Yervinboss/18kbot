module.exports = {
    name: 'kickall',
    aliases: ['svuota', 'evacua'],
    category: 'admin',
    description: 'Espelle tutti i membri dal gruppo WhatsApp (Solo Proprietario)',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '⚠️ Questo comando può essere usato solo nei gruppi.' });
            return;
        }

        const sender = m.key.participant || m.key.remoteJid;
        
        if (sender !== '129601359589600@lid') {
            await sock.sendMessage(chatId, { text: '❌ **ERRORE CRITICO:** Questo comando può essere usato SOLO dal Creatore del bot!' });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            // Crea la lista di persone da cacciare escludendo te e il bot stesso
            let daCacciare = [];
            for (let participant of participants) {
                const userJid = participant.id;
                const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                if (userJid === '129601359589600@lid' || userJid === botJid) {
                    continue;
                }
                daCacciare.push(userJid);
            }

            if (daCacciare.length === 0) {
                await sock.sendMessage(chatId, { text: '⚠️ Non ci sono membri da cacciare in questo gruppo.' });
                return;
            }

            await sock.sendMessage(chatId, { text: `🚨 **AVVIO EVACUAZIONE...** Sto rimuovendo ${daCacciare.length} membri in un colpo solo!` });

            // Esegue la rimozione in blocco di tutti i membri insieme
            await sock.groupParticipantsUpdate(chatId, daCacciare, 'remove');

            await sock.sendMessage(chatId, { text: `⚠️ **PROTOCOLLO COMPLETATO!** Il gruppo è stato svuotato con successo.` });

        } catch (error) {
            console.error('Errore durante il comando kickall:', error);
            await sock.sendMessage(chatId, { text: '❌ Errore: Assicurati al 100% che il bot sia **Amministratore** del gruppo, altrimenti WhatsApp rifiuta il comando!' });
        }
    }
};
