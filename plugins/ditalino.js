module.exports = {
    name: 'ditalino',
    category: 'fun',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = sender.split(':')[0].split('@')[0];
        let target = m.message?.extendedTextMessage?.contextInfo?.participant || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (!target) return sock.sendMessage(chatId, { text: '⚠️ Tagga qualcuno!' }, { quoted: m });

        const targetClean = target.split(':')[0].split('@')[0];
        const azioni = [
            `☝️ @${senderClean} si sta dando da fare con un ditalino selvaggio a @${targetClean}!`,
            `💦 @${senderClean} è un maestro nel fare i ditalini a @${targetClean}, guarda che roba!`,
            `😈 @${senderClean} ha le dita molto agili e sta facendo impazzire @${targetClean} con un ditalino da urlo.`
        ];

        await sock.sendMessage(chatId, { text: azioni[Math.floor(Math.random() * azioni.length)], mentions: [sender, target] }, { quoted: m });
    }
};
