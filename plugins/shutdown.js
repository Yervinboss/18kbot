module.exports = {
    name: 'shutdown',
    aliases: ['spegni', 'stop'],
    category: 'owner',
    description: 'Spegne il processo del bot su Termux (Solo Creatore)',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        // Identifica chi manda il comando (controlla sia participant che l'ID primario)
        const sender = m.key.participant || m.key.remoteJid;

        // Il tuo ID reale estratto dal bot dello screenshot
        const ownerId = '203779773313116@lid'; 

        // 1. Controllo di sicurezza blindato: risponde SOLO a te
        if (sender !== ownerId && !sender.includes('203779773313116')) {
            return sock.sendMessage(chatId, { text: '❌ Questo è un comando esclusivo del *Creatore del Bot*.' }, { quoted: m });
        }

        try {
            // Invia il messaggio di spegnimento
            await sock.sendMessage(chatId, { text: '😴 *Spegnimento in corso...* Il processo su Termux verrà arrestato immediatamente. Alla prossima!' }, { quoted: m });
            
            // Aspetta mezzo secondo per dare tempo a Baileys di inviare il messaggio
            await new Promise(resolve => setTimeout(resolve, 500));

            // Chiude il processo di Node.js su Termux
            process.exit(0);

        } catch (error) {
            console.error('Errore durante lo shutdown:', error);
            process.exit(1);
        }
    }
};
