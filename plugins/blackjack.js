import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/rpg.json');
global.blackjack = global.blackjack || {};

const SYMBOLS = '2,3,4,5,6,7,8,9,10,J,Q,K,A'.split(',');
const CARD_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };

function getDB() {
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}
function saveDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }
function pureId(jid) { return jid ? jid.replace(/[^0-9]/g, '') : ''; }
function formatMoney(n) { return '€' + n.toLocaleString('it-IT'); }

function calculateScore(hand) {
    let score = 0, aces = 0;
    for (let card of hand) { score += CARD_VALUES[card]; if (card === 'A') aces++; }
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
}
function drawCard() { return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    let senderJid = m.key.participant || m.key.remoteJid;
    let userId = pureId(senderJid);

    let cmd = (command || '').toLowerCase().trim();
    let cleanText = (text || m.text || '').toLowerCase().trim();

    let isHit = cmd === 'carta' || cmd === 'bjhit' || cleanText.includes('carta') || cleanText.includes('hit');
    let isStand = cmd === 'stai' || cmd === 'bjstand' || cleanText.includes('stai') || cleanText.includes('stand');

    if (isHit) {
        if (!global.blackjack[userId]) return;
        let game = global.blackjack[userId];
        game.playerHand.push(drawCard());
        let playerScore = calculateScore(game.playerHand);

        if (playerScore > 21) {
            let db = getDB();
            // INIEZIONE DI SICUREZZA: Evita il crash se l'utente non è inizializzato nell'azione
            if (!db[userId]) db[userId] = { level: 1, xp: 0, money: 2000, lastWork: 0 };
            
            db[userId].money -= game.bet;
            saveDB(db);
            delete global.blackjack[userId];
            await conn.sendMessage(jid, { react: { text: '💥', key: m.key } });
            return await conn.sendMessage(jid, { text: `💥 *SBALLATO!* Hai superato 21 con [ ${game.playerHand.join(' | ')} ]. *Perdi ${formatMoney(game.bet)}.*` }, { quoted: m });
        }

        let bodyText = `🃏 *BLACKJACK ZENO* 🃏\n\n🫵 *Tua mano:* [ ${game.playerHand.join(' | ')} ] (Totale: *${playerScore}*)\n🏦 *Banco:* [ ${game.dealerHand} | ❓ ]\n\n💰 Puntata: *${formatMoney(game.bet)}*\n\n🔒 Sessione riservata a: @${userId}`;
        let buttonsConfig = [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🃏 Carta (Hit)", id: `.carta` }) }, 
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🛑 Stai (Stand)", id: `.stai` }) }
        ];
        
        let msgContent = { viewOnceMessage: { message: { interactiveMessage: { body: { text: bodyText }, footer: { text: "Zeno Casino ⚙️" }, nativeFlowMessage: { buttons: buttonsConfig }, contextInfo: { mentionedJid: [senderJid] } } } } };
        return await conn.relayMessage(jid, msgContent, { quoted: m });
    }

    if (isStand) {
        if (!global.blackjack[userId]) return;
        let game = global.blackjack[userId];
        let playerScore = calculateScore(game.playerHand);
        let dealerScore = calculateScore(game.dealerHand);

        while (dealerScore < 17) { game.dealerHand.push(drawCard()); dealerScore = calculateScore(game.dealerHand); }

        let db = getDB();
        // INIEZIONE DI SICUREZZA: Evita il crash se l'utente non è inizializzato nell'azione
        if (!db[userId]) db[userId] = { level: 1, xp: 0, money: 2000, lastWork: 0 };
        
        let outcomeText = '';

        if (dealerScore > 21 || playerScore > dealerScore) {
            db[userId].money += game.bet;
            outcomeText = `🎉 *HAI VINTO!* Guadagni *${formatMoney(game.bet * 2)}*!`;
        } else if (playerScore < dealerScore) {
            db[userId].money -= game.bet;
            outcomeText = `💔 *VINCE IL BANCO!* Perdi *${formatMoney(game.bet)}*.`;
        } else {
            outcomeText = `🤝 *PAREGGIO!* I tuoi soldi rimangono intatti.`;
        }
        saveDB(db);
        delete global.blackjack[userId];
        return await conn.sendMessage(jid, { text: `🃏 *VERDETTO BLACKJACK* 🃏\n\n🫵 *Tu:* [ ${game.playerHand.join(' | ')} ] (Totale: *${playerScore}*)\n🏦 *Banco:* [ ${game.dealerHand.join(' | ')} ] (Totale: *${dealerScore}*)\n\n${outcomeText}\n💰 Saldo: *${formatMoney(db[userId].money)}*` }, { quoted: m });
    }

    if (cmd === 'bj' || cmd === 'blackjack') {
        let db = getDB();
        if (!db[userId]) db[userId] = { level: 1, xp: 0, money: 2000, lastWork: 0 };

        let bet = parseInt(text);
        if (isNaN(bet) || bet <= 0) return await conn.sendMessage(jid, { text: '❌ Cifra non valida! Esempio: `.bj 100`' }, { quoted: m });
        if (db[userId].money < bet) return await conn.sendMessage(jid, { text: `❌ Soldi insufficienti! Ne hai ${formatMoney(db[userId].money)}.` }, { quoted: m });
        if (global.blackjack[userId]) return await conn.sendMessage(jid, { text: '⚠️ Hai già una mano aperta!' }, { quoted: m });

        let d1 = drawCard();
        global.blackjack[userId] = { bet: bet, playerHand: [drawCard(), drawCard()], dealerHand: [d1] };
        let playerScore = calculateScore(global.blackjack[userId].playerHand);

        if (playerScore === 21) {
            db[userId].money += (bet * 2); saveDB(db); delete global.blackjack[userId];
            return await conn.sendMessage(jid, { text: `👑 *BLACKJACK NATURALE!* Vinci il triplo: *${formatMoney(bet * 3)}*!` }, { quoted: m });
        }

        let bodyText = `🃏 *CASINÒ BLACKJACK ZENO* 🃏\n\n🫵 *Le tue carte:* [ ${global.blackjack[userId].playerHand.join(' | ')} ] (Totale: *${playerScore}*)\n🏦 *Banco mostra:* [ ${d1} | ❓ ]\n\n💰 Puntata: *${formatMoney(bet)}*\n\n🔒 Sessione riservata a: @${userId}`;
        let buttonsConfig = [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🃏 Carta (Hit)", id: `.carta` }) }, 
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🛑 Stai (Stand)", id: `.stai` }) }
        ];
        
        let messageContent = { viewOnceMessage: { message: { interactiveMessage: { body: { text: bodyText }, footer: { text: "Usa i pulsanti per giocare" }, nativeFlowMessage: { buttons: buttonsConfig }, contextInfo: { mentionedJid: [senderJid] } } } } };
        return await conn.relayMessage(jid, messageContent, { quoted: m });
    }
};

handler.command = /^(bj|blackjack|bjhit|bjstand|carta|stai|hit|stand)$/i;
handler.help = ['bj <cifra>'];
handler.tags = ['rpg'];

export default handler;
