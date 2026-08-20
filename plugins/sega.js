module.exports = {
    name: 'sega',
    category: 'fun',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = sender.split(':')[0].split('@')[0];
        let target = m.message?.extendedTextMessage?.contextInfo?.participant || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (!target) return sock.sendMessage(chatId, { text: '⚠️ Tagga qualcuno per usare questo comando!' }, { quoted: m });
        
        const targetClean = target.split(':')[0].split('@')[0];
        const azioni = [
            `💦 @${senderClean} si è messo all'opera e ha fatto una sega supersonica a @${targetClean}!`,
            `✋ @${senderClean} sta allenando il polso su @${targetClean}, che goduria!`,
            `🍆 @${senderClean} non resiste e si sta facendo una sega leggendaria pensando a @${targetClean}.`
        ];
        
        await sock.sendMessage(chatId, { text: azioni[Math.floor(Math.random() * azioni.length)], mentions: [sender, target] }, { quoted: m });
    }
};

