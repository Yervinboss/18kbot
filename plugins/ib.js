const fs = require('fs');

module.exports = {
    name: 'ib',
    description: 'Mostra lo stato del bot e i plugin installati',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;

        // Calcola il tempo di attività del bot (Uptime)
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);
        
        const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

        // Conta automaticamente quanti file ci sono nella cartella dei plugin
        let totalPlugins = 0;
        try {
            const files = fs.readdirSync('./plugins');
            totalPlugins = files.filter(file => file.endsWith('.js') || file.endsWith('.mjs')).length;
        } catch (e) {
            totalPlugins = 'Errore nel conteggio';
        }

        // Messaggio con lo stile del tuo bot
        const statusMessage = 
            '🌸 *- 18K // BOT STATUS -* 🌸\n\n' +
            '🟢 *Stato:* Operativo\n' +
            '⏳ *Online da:* ' + uptimeString + '\n' +
            '🔌 *Plugin installati:* ' + totalPlugins + '\n\n' +
            '✨ _Il conteggio dei comandi si aggiorna da solo ad ogni aggiunta!_';

        await sock.sendMessage(chatId, { text: statusMessage }, { quoted: m });
    }
};

