module.exports = {
    name: 'sex',
    aliases: ['sesso', 'scopare'],
    category: 'fun',
    description: 'Fai sesso con un utente menzionato o citato',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;
        const senderClean = sender.split(':')[0].split('@')[0];

        // Estrae il target (chi viene taggato o a cui si risponde)
        let target = null;
        if (m.message?.extendedTextMessage?.contextInfo?.participant) {
            target = m.message.extendedTextMessage.contextInfo.participant;
        } else if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            target = m.message?.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        if (!target) {
            return sock.sendMessage(chatId, { text: '⚠️ Devi rispondere a qualcuno o taggarlo per usare questo comando!' }, { quoted: m });
        }

        const targetClean = target.split(':')[0].split('@')[0];

        // Frasi interattive spinte tra mittente e destinatario
        const azioni = [
            `🔥 @${senderClean} ha saltato addosso a @${targetClean} e ha iniziato a darci dentro senza pietà!`,
            `🥵 @${senderClean} si è chiuso in camera da letto con @... e non si sa quando ne usciranoc, troppa passione! (O meglio, @${targetClean})`,
            `🍆 @${senderClean} ha preso di mira @${targetClean} e la situazione si è fatta subito caldissima...`,
            `💦 Momenti di fuoco tra @${senderClean} e @${targetClean}: colpi proibiti e gemiti in audiovideo!`
        ];

        // Seleziona la frase sistemando i tag corretti
        const randomMsg = [
            `🔥 @${senderClean} si è avventato su @${targetClean} iniziando a fare faville e portandoselo a letto!`,
            `🥵 @${senderClean} ha spinto @${targetClean} contro il muro e ci ha dato dentro tutta la notte.`,
            `🍆 Tra @${senderClean} e @${targetClean} è scoppiata la passione più sfrenata, fuochi d'artificio in chat!`,
            `💦 @${senderClean} si è messo all'opera con @${targetClean}... sessione pesante e senza freni!`
        ][Math.floor(Math.random() * 4)];

        await sock.sendMessage(chatId, { react: { text: '🔥', key: m.key } });
        await sock.sendMessage(chatId, { 
            text: randomMsg, 
            mentions: [sender, target] 
        }, { quoted: m });
    }
};

