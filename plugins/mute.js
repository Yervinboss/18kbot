const ownerId = '129601359589600'; 

if (!global.utentiMutati) global.utentiMutati = new Map();

// FUNZIONE REALE E SICURA: Estrae solo le cifre numeriche pure senza causare crash di sintassi
const getCleanNumber = (jid) => {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
};

module.exports = {
    name: 'mute',
    category: 'admin',
    description: 'Muta un utente nel gruppo',
    
    async handleMessage(sock, m) {
        if (!m.key.remoteJid || !m.key.participant) return;
        
        const chatId = m.key.remoteJid;
        const sender = m.key.participant;
        const senderClean = getCleanNumber(sender);

        // PROTEZIONE CREATORE SUPREMO: Tu sei l'unico totalmente immune
        if (senderClean === ownerId || sender.includes(ownerId)) return;

        // Se l'utente è nella lista dei mutati della chat, il suo messaggio viene eliminato
        if (global.utentiMutati.has(chatId)) {
            const mutedSet = global.utentiMutati.get(chatId);
            
            for (let mutedJid of mutedSet) {
                const mutedClean = getCleanNumber(mutedJid);
                
                if (senderClean === mutedClean) {
                    try {
                        await sock.sendMessage(chatId, { delete: m.key });
                        break;
                    } catch (e) {
                        console.error("Errore eliminazione messaggio mutato:", e);
                    }
                }
            }
        }
    },

    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = getCleanNumber(sender);

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Questo comando può essere usato solo nei gruppi.' });
        }

        // Recupera i dati dei partecipanti del gruppo
        const groupMetadata = await sock.groupMetadata(chatId);
        const isSenderAdmin = groupMetadata.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
        const isSenderOwner = sender.includes(ownerId) || senderClean === ownerId;

        // 1. CONTROLLO SE CHI COMANDA È AUTORIZZATO (ADMIN O OWNER)
        if (!isSenderAdmin && !isSenderOwner) {
            return sock.sendMessage(chatId, { text: '❌ Questo comando è riservato agli Amministratori del gruppo!' }, { quoted: m });
        }

        // 2. CONTROLLO ANTI-FURBO: Se l'admin che lancia il comando è attualmente mutato, blocco immediato
        if (global.utentiMutati.has(chatId)) {
            const mutedSet = global.utentiMutati.get(chatId);
            const isMuted = Array.from(mutedSet).some(mutedJid => getCleanNumber(mutedJid) === senderClean);
            if (isMuted && !isSenderOwner) return;
        }

        let target = null;
        if (m.message?.extendedTextMessage?.contextInfo?.participant) {
            target = m.message.extendedTextMessage.contextInfo.participant;
        } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (args && args.length > 0) {
            const rawNumber = args.join('').replace(/[^0-9]/g, '');
            if (rawNumber.length > 5) target = `${rawNumber}@s.whatsapp.net`;
        }

        if (!target) {
            return sock.sendMessage(chatId, { text: '⚠️ Rispondi a un utente o taggalo per mutarlo!' }, { quoted: m });
        }

        const targetClean = getCleanNumber(target);

        // PROTEZIONE BERSAGLIO: Nessuno può mutare te (l'Owner)
        if (targetClean === ownerId || target.includes(ownerId)) {
            return sock.sendMessage(chatId, { text: '🧠 Non puoi mutare il creatore del bot!' }, { quoted: m });
        }

        if (!global.utentiMutati.has(chatId)) {
            global.utentiMutati.set(chatId, new Set());
        }
        global.utentiMutati.get(chatId).add(target);

        await sock.sendMessage(chatId, { text: `🔇 **PROVVEDIMENTO DISCIPLINARE:** L'utente @${targetClean} è stato mutato.`, mentions: [target] }, { quoted: m });
    }
};

