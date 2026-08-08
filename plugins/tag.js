module.exports = {
    name: 'tag',
    description: 'Manda un messaggio taggando tutti i partecipanti (usabile da chiunque)',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;

        // Controlla se siamo in un gruppo
        if (!sender.endsWith('@g.us')) {
            await sock.sendMessage(sender, { text: '⚠️ Questo comando può essere usato solo all\'interno dei gruppi!' }, { quoted: m });
            return;
        }

        const messaggioDaInviare = args.join(' ');
        if (!messaggioDaInviare) {
            await sock.sendMessage(sender, { text: '⚠️ Scrivi un messaggio dopo il comando! Esempio: *.tag Ciao a tutti*' }, { quoted: m });
            return;
        }

        try {
            // Ottiene le informazioni del gruppo
            const groupMetadata = await sock.groupMetadata(sender);
            const partecipanti = groupMetadata.participants;

            // Estrae gli ID di tutti i membri per il tag multiplo (supporta sia numeri che LID)
            const listaIds = partecipanti.map(p => p.id);

            // Manda il messaggio mostrando SOLO ed ESCLUSIVAMENTE il testo scritto dall'utente
            await sock.sendMessage(sender, {
                text: messaggioDaInviare,
                mentions: listaIds
            }, { quoted: m });

        } catch (error) {
            console.error('Errore durante l\'esecuzione del comando tag:', error);
            await sock.sendMessage(sender, { text: '❌ Si è verificato un errore nel recupero della lista dei membri.' }, { quoted: m });
        }
    }
};

