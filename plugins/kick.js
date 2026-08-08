module.exports = {
    name: 'kick',
    aliases: ['espelli', 'caccia'],
    category: 'admin',
    description: 'Rimuove un utente dal gruppo (solo admin)',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        // 1. Controlla se siamo in un gruppo
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '⚠️ Questo comando può essere usato solo nei gruppi.' }, { quoted: m });
            return;
        }

        try {
            // Ottiene i metadati freschi del gruppo
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            // Estrae gli amministratori reali dal gruppo
            const groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);

            // Identifica l'ID del mittente (chi scrive il comando)
            const sender = m.key.participant || m.key.remoteJid;

            // 2. Controllo: Chi manda il comando deve essere admin
            if (!groupAdmins.includes(sender)) {
                await sock.sendMessage(chatId, { text: '⚠️ Solo gli *amministratori* del gruppo possono usare questo comando.' }, { quoted: m });
                return;
            }

            // 3. Identifica chi deve essere cacciato
            let userToKick = null;

            if (m.message?.extendedTextMessage?.contextInfo?.participant) {
                // Se rispondi al messaggio di qualcuno
                userToKick = m.message.extendedTextMessage.contextInfo.participant;
            } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                // Se lo tagghi con la @
                userToKick = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (args.length > 0) {
                // Se scrivi il numero di telefono dopo il comando
                let rawNumber = args.join('').replace(/[^0-9]/g, '');
                if (rawNumber.length > 5) {
                    userToKick = `${rawNumber}@s.whatsapp.net`;
                }
            }

            if (!userToKick) {
                await sock.sendMessage(chatId, { 
                    text: '· *Group Kick*\n\nUso corretto:\n· Rispondi al messaggio di qualcuno con *\.kick*\n· id o numero' 
                }, { quoted: m });
                return;
            }

            // 4. Esegue l'azione di rimozione ufficiale
            await sock.groupParticipantsUpdate(chatId, [userToKick], 'remove');

            // Messaggio di conferma finale con tag dell'utente rimosso
            await sock.sendMessage(chatId, { 
                text: `🥾 Rimosso con successo dal gruppo.`,
            });

        } catch (error) {
            console.error('Errore durante il comando kick:', error);
            await sock.sendMessage(chatId, { text: '❌ Errore: Assicurati che io sia admin e riprova.' }, { quoted: m });
        }
    }
};
