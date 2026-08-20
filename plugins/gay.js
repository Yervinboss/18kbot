module.exports = {
    name: 'gay',
    category: 'fun',
    description: 'Misura la percentuale di gay con battute caustiche e irriverenti',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        // 1. Cerca se c'è un utente taggato
        let target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        // 2. Se non c'è un tag, cerca se si sta rispondendo a un messaggio
        if (!target) {
            target = m.message?.extendedTextMessage?.contextInfo?.participant;
        }

        // 3. Se non c'è né tag né risposta, il bersaglio è chi ha digitato il comando (te stesso)
        if (!target) {
            target = sender;
        }

        const numeroPulito = target.split('@')[0];
        const percentuale = Math.floor(Math.random() * 101); // Genera un numero da 0 a 100

        let battuta = '';
        if (percentuale === 0) {
            battuta = "Sei così etero che persino il tuo deodorante sa di birra Peroni scaduta e cantieri stradali. Un vero cavernicolo.";
        } else if (percentuale < 30) {
            battuta = "Hai la classica energia del tipo che fa il duro sui social ma poi piange guardando i cartoni animati la sera.";
        } else if (percentuale < 60) {
            battuta = "Sei nella zona grigia: un piede nell'armadio e l'altro che valuta seriamente di comprarsi una borsa firmata.";
        } else if (percentuale < 90) {
            battuta = "Amico mio, fai prima ad ammetterlo. Ormai pure i muri di casa tua sanno che preferisci i ragazzi.";
        } else if (percentuale === 100) {
            battuta = "100% puro arcobaleno concentrato. A questo punto il tuo asse da stiro ha più stile della tua intera comitiva.";
        } else {
            battuta = "Il sensore è andato in corto circuito. Sei ufficialmente l'icona suprema del disagio.";
        }

        const text = `🌈 **GAY METER SYSTEM** 🌈\n\n🎯 **Bersaglio:** @${numeroPulito}\n📊 **Tasso registrato:** ${percentuale}%\n\n💬 *Verdetto:* ${battuta}`;

        await sock.sendMessage(chatId, { text, mentions: [target] });
    }
};

