if (!global.utentiMutati) global.utentiMutati = new Map();

// Funzione helper sicura per estrarre la stringa numerica da qualsiasi tipo di JID
const getCleanNumber = (jid) => {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
};

module.exports = {
    name: 'unmute',
    category: 'admin',
    description: 'Smuta un utente nel gruppo (Solo per Admin ed Owner)',
    
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Questo comando può essere usato solo nei gruppi.' });
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = getCleanNumber(sender);
        
        // Il tuo ID supremo reale estratto dai log precedenti
        const supremoId = '203779773313116'; 

        try {
            // Recupera i dati dei partecipanti del gruppo
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            const esecutore = participants.find(p => p.id === sender);
            const isAdmin = esecutore?.admin === 'admin' || esecutore?.admin === 'superadmin';
            const isOwner = sender.includes(supremoId) || senderClean === supremoId;

            // 1. CONTROLLO DI SICUREZZA RIGIDO: Solo admin o owner possono procedere
            if (!isAdmin && !isOwner) {
                return sock.sendMessage(chatId, { text: '❌ **ACCESSO NEGATO:** Questo comando è riservato esclusivamente agli Amministratori.' }, { quoted: m });
            }

            // 2. CONTROLLO ANTI-FURBO: Se l'admin che lancia il comando è attualmente mutato, bloccalo!
            if (global.utentiMutati.has(chatId)) {
                const mutedSet = global.utentiMutati.get(chatId);
                const isMuted = Array.from(mutedSet).some(mutedJid => getCleanNumber(mutedJid) === senderClean);
                
                // Se l'admin è mutato e NON sei tu l'owner, il bot non esegue lo smuto
                if (isMuted && !isOwner) {
                    return; 
                }
            }

            let target = null;
            if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (m.message?.extendedTextMessage?.contextInfo?.participant) {
                target = m.message.extendedTextMessage.contextInfo.participant;
            } else if (args && args.length > 0) {
                const cleanedArgs = args.join('').replace(/[^0-9]/g, '');
                if (cleanedArgs.length > 5) target = `${cleanedArgs}@s.whatsapp.net`;
            }

            if (!target) {
                return sock.sendMessage(chatId, { text: '⚠️ Rispondi a un messaggio, tagga qualcuno o scrivi il numero per smutarlo!' }, { quoted: m });
            }

            // Rimuove l'utente dalla mappa dei mutati del gruppo
            if (global.utentiMutati.has(chatId)) {
                global.utentiMutati.get(chatId).delete(target);
            }

            const targetClean = getCleanNumber(target);
            await sock.sendMessage(chatId, { 
                text: `🔓 **SBLOCCO:** L'utente @${targetClean} è stato smutato con successo!`, 
                mentions: [target] 
            }, { quoted: m });

        } catch (err) {
            console.error(err);
            await sock.sendMessage(chatId, { text: '❌ Errore durante l\'esecuzione del comando.' }, { quoted: m });
        }
    }
};

