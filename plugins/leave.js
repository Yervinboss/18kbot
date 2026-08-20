module.exports = {
    name: 'leave',
    aliases: ['esci', 'abbandona'],
    category: 'owner',
    description: 'Fa uscire il bot dal gruppo corrente con insulto (Solo Creatore)',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        // 1. Controlla se siamo in un gruppo
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '⚠️ Questo comando può essere usato solo nei gruppi.' }, { quoted: m });
            return;
        }

        // Identifica chi manda il comando
        const sender = m.key.participant || m.key.remoteJid;

        // Il tuo ID reale blindato
        const ownerId = '129601359589600@lid'; 

        // 2. Controllo di sicurezza: risponde SOLO a te, il creatore
        if (sender !== ownerId && !sender.includes('129601359589600')) {
            return; // Ignora gli altri utenti
        }

        try {
            // Sostituito il testo con il saluto pesante richiesto
            await sock.sendMessage(chatId, { text: '🖕 *Ordine del Creatore ricevuto.* Me ne vado da sto gruppo di merda, ciao figli di puttana! 👋🖕' });
            
            // Aspetta un secondo per dare tempo a Baileys di inviare l'insulto
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Il bot abbandona ufficialmente il gruppo
            await sock.groupLeave(chatId);

        } catch (error) {
            console.error('Errore durante il comando leave:', error);
        }
    }
};
