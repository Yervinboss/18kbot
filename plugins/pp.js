module.exports = {
    name: 'pp',
    description: 'Prende la foto profilo dell\'utente taggato',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;

        // 1. Recuperiamo il JID di chi viene taggato o del messaggio a cui rispondi
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        const mentionedJids = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // Se non tagghi nessuno, il bersaglio sei tu stesso
        const targetJid = mentionedJids[0] || quotedParticipant || m.key.participant || m.key.remoteJid;

        try {
            // Mette la reazione di caricamento
            await sock.sendMessage(sender, { react: { text: '🔍', key: m.key } });

            // 2. Chiediamo a WhatsApp il link della foto profilo ad alta risoluzione
            const picUrl = await sock.profilePictureUrl(targetJid, 'image');

            // 3. Inviamo la foto profilo trovata nella chat
            await sock.sendMessage(sender, {
                image: { url: picUrl },
                caption: `📸 *Ecco la foto profilo richiesta!*`
            }, { quoted: m });

            // Reazione di successo
            await sock.sendMessage(sender, { react: { text: '✅', key: m.key } });

        } catch (error) {
            console.error('Errore nel comando pp:', error);
            
            // Gestione errore se l'utente non ha una foto profilo o ha la privacy al massimo
            await sock.sendMessage(sender, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(sender, { 
                text: '⚠️ *Impossibile recuperare la foto!* L\'utente potrebbe non avere una foto profilo o ha impostato le restrizioni sulla privacy.' 
            }, { quoted: m });
        }
    }
};

