const ownerId = '203779773313116'; // Il tuo ID supremo reale

if (!global.utentiMutati) global.utentiMutati = new Map();

// FUNZIONE CORRETTA: Ritorna solo la stringa numerica pulita prima dell'arroba (@) o dei due punti (:)
const getCleanNumber = (jid) => {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
};

module.exports = {
    name: 'tag',
    category: 'admin',
    description: 'Manda un messaggio taggando tutti i partecipanti (Solo per Admin)',
    
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = getCleanNumber(sender);

        // Controlla se siamo in un gruppo
        if (!chatId.endsWith('@g.us')) {
            return; // Gosta silenziosamente se provano a usarlo in privato
        }

        try {
            // Ottiene le informazioni del gruppo
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            const esecutore = participants.find(p => p.id === sender);
            
            // Se l'utente non viene trovato nei partecipanti del gruppo, lo gostiamo per sicurezza
            if (!esecutore) return;

            const isAdmin = esecutore.admin === 'admin' || esecutore.admin === 'superadmin';
            const isOwner = sender.includes(ownerId) || senderClean === ownerId;

            // --- SE NON È ADMIN NÉ OWNER: GOSTING TOTALE ---
            if (!isAdmin && !isOwner) {
                return; // Esce dalla funzione senza rispondere o fare nulla
            }
            // -------------------------------------------------

            // CONTROLLO ANTI-FURBO: Se l'admin è mutato, viene gostato anche lui
            if (global.utentiMutati.has(chatId)) {
                const mutedSet = global.utentiMutati.get(chatId);
                const isMuted = Array.from(mutedSet).some(mutedJid => getCleanNumber(mutedJid) === senderClean);
                if (isMuted && !isOwner) return;
            }

            const messaggioDaInviare = args.join(' ');
            if (!messaggioDaInviare) {
                return sock.sendMessage(chatId, { text: '⚠️ Scrivi un messaggio dopo il comando! Esempio: `.tag Ciao a tutti`' }, { quoted: m });
            }

            // Estrae gli ID di tutti i membri per il tag multiplo
            const listajids = participants.map(p => p.id);

            // Manda il messaggio mostrando SOLO ed ESCLUSIVAMENTE il testo scritto dall'utente
            await sock.sendMessage(chatId, {
                text: messaggioDaInviare,
                mentions: listajids
            }, { quoted: m });

        } catch (error) {
            console.error('Errore durante l\'esecuzione del comando tag:', error);
        }
    }
};

