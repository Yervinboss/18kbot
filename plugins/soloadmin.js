// ID del creatore supremo
const ownerId = '129601359589600'; 

module.exports = {
    name: 'soloadmin',
    aliases: ['botadmin', 'lockbot'],
    category: 'admin',
    description: 'Attiva o disattiva la modalità Solo Admin per il bot',
    
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) return;

        // Recupera i dati per vedere se chi scrive è admin o owner
        const groupMetadata = await sock.groupMetadata(chatId, true);
        const participants = groupMetadata.participants;
        const esecutore = participants.find(p => p.id === sender);
        
        const isAdmin = esecutore?.admin === 'admin' || esecutore?.admin === 'superadmin';
        const isOwner = sender.includes(ownerId) || sender.replace(/[^0-9]/g, '').includes(ownerId);

        // Se non è admin o owner, gostalo totale
        if (!isAdmin && !isOwner) return;

        // Inizializza la mappa globale se non esiste
        if (!global.botSoloAdmin) global.botSoloAdmin = new Map();

        // Controlla lo stato attuale del gruppo
        const currentState = global.botSoloAdmin.get(chatId) || false;
        
        // Inverte lo stato (se era attivo diventa disattivo, e viceversa)
        const newState = !currentState;
        global.botSoloAdmin.set(chatId, newState);

        if (newState) {
            await sock.sendMessage(chatId, { text: '🔒 **MODALITÀ PRIVATA ATTIVATA:** Da adesso il bot risponderà **solo ed esclusivamente agli Amministratori** del gruppo. Gli altri utenti verranno gostati.' }, { quoted: m });
        } else {
            await sock.sendMessage(chatId, { text: '🔓 **MODALITÀ PUBBLICA ATTIVATA:** Il bot è di nuovo disponibile per tutti i membri del gruppo!' }, { quoted: m });
        }
    }
};

