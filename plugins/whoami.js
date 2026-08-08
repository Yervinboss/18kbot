module.exports = {
    name: 'id',
    description: 'Mostra come il bot vede il tuo numero e i tuoi dati',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        const participant = m.key.participant || sender;
        const pushName = m.pushName || 'Sconosciuto';

        const infoText = `🤖 *Info Rilevate dal Bot:*\n\n` +
                         `👤 *Nome in chat:* ${pushName}\n` +
                         `📱 *JID / Numero:* \`${sender}\`\n` +
                         `📌 *Partecipante effettivo:* \`${participant}\``;

        await sock.sendMessage(sender, { text: infoText }, { quoted: m });
    }
};

