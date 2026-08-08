module.exports = {
    name: 'palla',
    description: 'Risponde alle tue domande stile Magic 8-Ball',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        const query = args.join(' ');

        if (!query) {
            await sock.sendMessage(sender, { text: '🎱 Fai una domanda alla palla magica! Esempio: `.palla passerò l\'esame?`' }, { quoted: m });
            return;
        }

        // Lista di risposte stile Magic 8-Ball
        const replies = [
            '🎱 È certamente così.',
            '🎱 Senza dubbio.',
            '🎱 Sì, decisamente.',
            '🎱 Puoi contarci.',
            '🎱 I miei calcoli dicono di sì.',
            '🎱 Non è molto chiaro, riprova.',
            '🎱 Chiedi di nuovo più tardi.',
            '🎱 Meglio non dirtelo adesso.',
            '🎱 Non ci fare affidamento.',
            '🎱 La mia risposta è no.',
            '🎱 Le mie fonti dicono di no.',
            '🎱 Molto dubbio.'
        ];

        // Sceglie una risposta casuale
        const randomReply = replies[Math.floor(Math.random() * replies.length)];

        const textResponse = `🎱 *Domanda:* ${query}\n\n${randomReply}`;

        await sock.sendMessage(sender, { text: textResponse }, { quoted: m });
    }
};

