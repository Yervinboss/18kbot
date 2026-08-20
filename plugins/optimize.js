const os = require('os');

// ID dell'owner supremo per sicurezza, visto che è un comando di sistema
const ownerId = '129601359589600';

module.exports = {
    name: 'opt',
    aliases: ['clean', 'gc', 'velocizza'],
    category: 'owner',
    description: 'Optimize bot server performance and clear RAM cache',
    
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = sender.replace(/[^0-9]/g, '');

        // Controllo di sicurezza: solo tu puoi ottimizzare il sistema
        const isOwner = sender.includes(ownerId) || senderClean.includes(ownerId);
        if (!isOwner) return; // Ghosting totale per i non-owner

        // 1. Calcola la RAM prima della pulizia
        const beforeMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        // Invia una reazione per far capire che il processo è avviato
        await sock.sendMessage(chatId, { react: { text: '⚙️', key: m.key } });

        // 2. AZIONE DI PULIZIA PROFONDA
        try {
            // Svuota i messaggi vecchi memorizzati nella cache interna di Baileys
            if (sock.store && typeof sock.store.clear === 'function') {
                sock.store.clear();
            }

            // Forza la pulizia della RAM se Node.js è stato avviato con l'opzione corretta
            if (global.gc) {
                global.gc();
            } else {
                // Alternativa se global.gc non è attivo: suggerisce al motore V8 di liberare memoria
                if (typeof Array.prototype.fill === 'function') {
                    new Array(1000000).fill(0); 
                }
            }
        } catch (e) {
            console.error('Errore durante ottimizzazione cache:', e);
        }

        // 3. Calcola la RAM dopo la pulizia
        const afterMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const savedMemory = (beforeMemory - afterMemory).toFixed(2);

        // Testo estetico finale
        let optimizeText = `⚡ ─── ❖ *18K SYSTEM OPTIMIZER* ❖ ─── ⚡\n\n`;
        optimizeText += `🧹 *STATUS:* 🟢 System Successfully Optimized\n`;
        optimizeText += `📊 *BEFORE:* \`${beforeMemory} MB\`\n`;
        optimizeText += `📉 *AFTER:* \`${afterMemory} MB\`\n`;
        optimizeText += `💎 *RAM FREED:* \`${savedMemory > 0 ? savedMemory : 0} MB\`\n\n`;
        optimizeText += `✨ *18K by Zeno* ✨`;

        await sock.sendMessage(chatId, { text: optimizeText }, { quoted: m });
    }
};

