module.exports = {
    name: 'ping',
    description: 'Calcola la latenza del bot',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        
        // Salva il momento in cui riceviamo il comando
        const start = Date.now();

        // Invia un messaggio temporaneo o diretto
        const sentMsg = await sock.sendMessage(sender, { text: 'Calcolando il ping...' });

        // Calcola la differenza
        const latency = Date.now() - start;

        // Modifica il messaggio con il risultato finale
        await sock.sendMessage(sender, { 
            text: `Pong! 🏓 Latenza: ${latency}ms`, 
            edit: sentMsg.key 
        });
    }
};

