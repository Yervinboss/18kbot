import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/rpg.json');

const RINGS = {
    bronzo: { name: '💍 Anello di Bronzo', price: 5000 },
    argento: { name: '💍 Anello d\'Argento', price: 20000 },
    oro: { name: '💍 Anello d\'Oro', price: 50000 },
    diamante: { name: '💎 Anello di Diamante', price: 150000 }
};

function getDB() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Pulisce l'ID ignorando eventuali prefissi o suffissi di dispositivi collegati (:1, :2)
function pureId(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function getUser(db, userId) {
    if (!db[userId]) {
        db[userId] = { level: 1, xp: 0, money: 0, spouse: null };
    }
    return db[userId];
}

function formatMoney(n) {
    return '€' + n.toLocaleString('it-IT');
}

let handler = async (m, { conn, command, text }) => {
    let jid = m.key.remoteJid;
    let userId = pureId(m.key.participant || m.key.remoteJid);
    let db = getDB();
    let user = getUser(db, userId);

    let cmd = (command || '').toLowerCase();
    let msgText = (m.text || '').toLowerCase();

    // 1. Comando iniziale: .sposa (tramite menzione o risposta al messaggio)
    if (cmd === 'sposa') {
        let quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        let mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        let targetJid = quotedParticipant || mentionedJid[0];

        if (!targetJid) {
            return await conn.sendMessage(jid, { 
                text: '❌ Devi menzionare la persona che vuoi sposare oppure rispondere a un suo messaggio! Esempio: .sposa @utente' 
            }, { quoted: m });
        }

        let targetId = pureId(targetJid);
        if (targetId === userId) {
            return await conn.sendMessage(jid, { text: '❌ Non puoi sposarti da solo/a!' }, { quoted: m });
        }

        let targetData = getUser(db, targetId);

        if (user.spouse || targetData.spouse) {
            return await conn.sendMessage(jid, { text: '❌ Uno di voi due è già impegnato o sposato!' }, { quoted: m });
        }

        let buttons = [
            { buttonId: `proposta_si_${targetId}_${userId}`, buttonText: { displayText: '❤️ Sposati' }, type: 1 },
            { buttonId: `proposta_no_${targetId}_${userId}`, buttonText: { displayText: '💔 Rifiuta' }, type: 1 }
        ];

        return await conn.sendMessage(jid, {
            text: `💒 @${targetId}, hai ricevuto una proposta di matrimonio da @${userId}!\n\nAccetti di convolare a nozze?`,
            mentions: [`${targetId}@s.whatsapp.net`, `${userId}@s.whatsapp.net`],
            buttons: buttons,
            headerType: 1
        }, { quoted: m });
    }

    // 2. Risposta (Sì)
    if (cmd.startsWith('proposta_si_') || msgText.startsWith('proposta_si_')) {
        let fullCmd = cmd.startsWith('proposta_si_') ? cmd : msgText;
        let parts = fullCmd.replace('proposta_si_', '').split('_');
        let invitedId = parts[0];
        let proposerId = parts[1];

        if (userId !== invitedId) {
            return await conn.sendMessage(jid, { text: '❌ Questa proposta non è per te!' }, { quoted: m });
        }

        let ringButtons = Object.keys(RINGS).map(key => ({
            buttonId: `compraanello_${key}_${proposerId}_${invitedId}`,
            buttonText: { displayText: `${RINGS[key].name} (${formatMoney(RINGS[key].price)})` },
            type: 1
        }));

        return await conn.sendMessage(jid, {
            text: `💖 *Proposta accettata!* Ora @${invitedId} e @${proposerId} devono scegliere l'anello di nozze.\n\nScegliete l'anello da acquistare:`,
            mentions: [`${proposerId}@s.whatsapp.net`, `${invitedId}@s.whatsapp.net`],
            buttons: ringButtons,
            headerType: 1
        }, { quoted: m });
    }

    // 3. Risposta (Rifiuta)
    if (cmd.startsWith('proposta_no_') || msgText.startsWith('proposta_no_')) {
        let fullCmd = cmd.startsWith('proposta_no_') ? cmd : msgText;
        let parts = fullCmd.replace('proposta_no_', '').split('_');
        let invitedId = parts[0];
        let proposerId = parts[1];

        if (userId !== invitedId) {
            return await conn.sendMessage(jid, { text: '❌ Questa proposta non è per te!' }, { quoted: m });
        }

        return await conn.sendMessage(jid, {
            text: `💔 @${invitedId} ha rifiutato la proposta di matrimonio di @${proposerId}. Che troia...`,
            mentions: [`${proposerId}@s.whatsapp.net`, `${invitedId}@s.whatsapp.net`]
        }, { quoted: m });
    }

    // 4. Scelta e acquisto Anello
    if (cmd.startsWith('compraanello_') || msgText.startsWith('compraanello_')) {
        let fullCmd = cmd.startsWith('compraanello_') ? cmd : msgText;
        let parts = fullCmd.replace('compraanello_', '').split('_');
        let ringKey = parts[0];
        let proposerId = parts[1];
        let invitedId = parts[2];

        if (userId !== proposerId && userId !== invitedId) {
            return await conn.sendMessage(jid, { text: '❌ Non puoi comprare l\'anello per loro!' }, { quoted: m });
        }

        let ring = RINGS[ringKey];
        if (!ring) return;

        let proposerData = getUser(db, proposerId);
        let invitedData = getUser(db, invitedId);

        let totalMoney = proposerData.money + invitedData.money;

        if (totalMoney < ring.price) {
            return await conn.sendMessage(jid, {
                text: `❌ *Matrimonio annullato per fondi insufficienti!* 💸\n\nNessuno di voi ha abbastanza soldi per comprare il ${ring.name} (${formatMoney(ring.price)}).`,
            }, { quoted: m });
        }

        if (proposerData.money >= ring.price) {
            proposerData.money -= ring.price;
        } else {
            let diff = ring.price - proposerData.money;
            proposerData.money = 0;
            invitedData.money -= diff;
        }

        proposerData.spouse = invitedId;
        invitedData.spouse = proposerId;

        saveDB(db);

        return await conn.sendMessage(jid, {
            text: `🎉💍 *EVVIVA GLI SPOSI!* 🥂❤️\n\n@${proposerId} e @${invitedId} si sono ufficialmente sposati acquistando il magnifico *${ring.name}*!\nTanti auguri alla nuova coppia! 🎊`,
            mentions: [`${proposerId}@s.whatsapp.net`, `${invitedId}@s.whatsapp.net`]
        }, { quoted: m });
    }
};

handler.command = /^(sposa|proposta_si_.*|proposta_no_.*|compraanello_.*)$/i;
handler.help = ['sposa'];
handler.tags = ['rpg'];

export default handler;

