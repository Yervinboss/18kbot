const fs = require('fs');
const path = require('path');
const ecoPath = path.join(__dirname, '../economy.json');

function getEconomy() {
    if (!fs.existsSync(ecoPath)) {
        fs.writeFileSync(ecoPath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(ecoPath, 'utf8'));
}

function saveEconomy(data) {
    fs.writeFileSync(ecoPath, JSON.stringify(data, null, 2));
}

// Funzione per estrarre un simbolo con probabilità reali (Pesi)
function getRandomSymbol() {
    const r = Math.random() * 100;
    if (r < 35) return '🍒';      // 35% di probabilità (Comune)
    if (r < 65) return '🍋';      // 30% di probabilità (Comune)
    if (r < 80) return '🍉';      // 15% di probabilità (Non comune)
    if (r < 90) return '🔔';      // 10% di probabilità (Raro)
    if (r < 96) return '⭐';      // 6% di probabilità (Molto raro)
    if (r < 99) return '💎';      // 3% di probabilità (Epico)
    return '7️⃣';                 // 1% di probabilità (Jackpot Supremo)
}

module.exports = {
    name: 'slot',
    category: 'economy',
    description: 'Tenta la fortuna alla slot machine con pulsanti',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        let eco = getEconomy();
        if (!eco[sender]) {
            eco[sender] = { coins: 500, xp: 0, level: 1, job: 'Disoccupato 🛋️' };
        }

        let user = eco[sender];

        // SE L'UTENTE NON SPECIFICA LA PUNTATA, MOSTRA I PULSANTI INTERATTIVI
        if (!args || args.length === 0) {
            const buttons = [
                { buttonId: '.slot 50', buttonText: { displayText: '💵 Punta 50' }, type: 1 },
                { buttonId: '.slot 100', buttonText: { displayText: '💵 Punta 100' }, type: 1 },
                { buttonId: '.slot 200', buttonText: { displayText: '💵 Punta 200' }, type: 1 }
            ];

            const buttonMessage = {
                text: `🎰 *BIENVENUTO ALLA SLOT MACHINE* 🎰\n\n💰 *Il tuo Saldo:* ${user.coins} soldi\n\n📌 Seleziona una delle puntate rapide qui sotto per girare i rulli:`,
                footer: "Slot Machine Bot",
                buttons: buttons,
                headerType: 1
            };

            return sock.sendMessage(chatId, buttonMessage, { quoted: m });
        }

        // Se l'utente ha premuto un pulsante o scritto la cifra (es. .slot 100)
        const bet = parseInt(args[0]);

        if (isNaN(bet) || bet <= 0) {
            return sock.sendMessage(chatId, { text: '⚠️ Inserisci una cifra valida! Esempio: `.slot 100` o usa i pulsanti.' }, { quoted: m });
        }

        if (user.coins < bet) {
            return sock.sendMessage(chatId, { text: `⚠️ Non hai abbastanza soldi! Il tuo saldo attuale è di ${user.coins} soldi.` }, { quoted: m });
        }

        // Sottrae la puntata scelta
        user.coins -= bet;

        // Estrazione con il nuovo sistema a percentuali reali
        const slot1 = getRandomSymbol();
        const slot2 = getRandomSymbol();
        const slot3 = getRandomSymbol();

        let winnings = 0;
        let resultText = '';

        // CALCOLO DELLE VINCITE BILANCIATO
        if (slot1 === slot2 && slot2 === slot3) {
            // TRIS (JACKPOT)
            let multiplier = 5; // Moltiplicatore base per i tris comuni (🍒, 🍋)
            if (slot1 === '🍉' || slot1 === '🔔') multiplier = 8;
            if (slot1 === '⭐') multiplier = 12;
            if (slot1 === '💎') multiplier = 20;
            if (slot1 === '7️⃣') multiplier = 50; // Il jackpot massimo paga 50 volte la puntata!

            winnings = bet * multiplier;
            user.coins += winnings;
            resultText = `🎉 **JACKPOT TRIS!** Hai fatto tris di ${slot1} e vinto **${winnings}** soldi!`;

        } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
            // AMBO (Solo 2 uguali) - Adesso restituisce solo l'80% o il 100% per non rompere l'economia
            // In questo modo l'ambo ammortizza la perdita ma non fa arricchire l'utente
            winnings = Math.floor(bet * 1.2); 
            user.coins += winnings;
            resultText = `✨ **Ambo!** Due simboli uguali. Hai recuperato e vinto **${winnings}** soldi.`;
        } else {
            // SCONFITTA
            resultText = `💸 **Hai perso!** I rulli non combinano. **-${bet}** soldi.`;
        }

        saveEconomy(eco);

        const slotDisplay = `🎰 | ${slot1} | ${slot2} | ${slot3} |\n\n${resultText}\n💵 **Nuovo Saldo:** ${user.coins} soldi`;
        await sock.sendMessage(chatId, { text: slotDisplay }, { quoted: m });
    }
};

