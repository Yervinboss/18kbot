const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../warnings.json');

function getWarningsData() {
    try {
        if (!fs.existsSync(dbPath)) return {};
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

function saveWarningsData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = {
    name: 'unwarn',
    description: 'Rimuove un avvertimento a un utente (tramite menzione o rispondendo al suo messaggio).',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;

        if (!sender.endsWith('@g.us')) {
            await sock.sendMessage(sender, { text: '⚠️ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
            return;
        }

        try {
            const groupMetadata = await sock.groupMetadata(sender);
            const partecipanti = groupMetadata.participants;

            const authorJid = m.key.participant || m.participant;
            const senderParticipant = partecipanti.find(p => p.id === authorJid);
            const isSenderAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');

            if (!isSenderAdmin) {
                await sock.sendMessage(sender, { text: '❌ Solo gli amministratori possono rimuovere gli avvertimenti!' }, { quoted: m });
                return;
            }

            // --- SISTEMA FLESSIBILE: RISPOSTA AL MESSAGGIO O MENZIONE ---
            let targetUser = null;

            // 1. Controlla se l'utente ha risposto a un messaggio (quoted message)
            const quotedMessage = m.message.extendedTextMessage?.contextInfo;
            if (quotedMessage && quotedMessage.participant) {
                targetUser = quotedMessage.participant;
            }
            // 2. Se non ha risposto a nessuno, controlla se ha usato la menzione (@)
            else if (quotedMessage && quotedMessage.mentionedJid && quotedMessage.mentionedJid.length > 0) {
                targetUser = quotedMessage.mentionedJid[0]; // Estrae il primo utente menzionato dall'array
            }

            if (!targetUser) {
                await sock.sendMessage(sender, { text: '⚠️ Devi menzionare un utente oppure **rispondere** a un suo messaggio!' }, { quoted: m });
                return;
            }

            const db = getWarningsData();
            if (!db[sender]) db[sender] = {};
            if (!db[sender][targetUser]) db[sender][targetUser] = 0;

            // Se l'utente ha già 0 warn, non possiamo scendere sotto zero
            if (db[sender][targetUser] === 0) {
                await sock.sendMessage(sender, {
                    text: `✨ *@${targetUser.split('@')[0]}* non ha alcun avvertimento attivo da rimuovere.`,
                    mentions: [targetUser]
                }, { quoted: m });
                return;
            }

            // Sottrae un avvertimento
            db[sender][targetUser] -= 1;
            saveWarningsData(db);

            const currentWarns = db[sender][targetUser];

            await sock.sendMessage(sender, {
                text: `✅ Rimosso un avvertimento a *@${targetUser.split('@')[0]}*.\nAvvertimenti rimanenti: *${currentWarns}/3*`,
                mentions: [targetUser]
            }, { quoted: m });

        } catch (error) {
            console.error('Errore nel comando unwarn:', error);
            await sock.sendMessage(sender, { text: '❌ Si è verificato un errore durante la gestione dell\'unwarn.' }, { quoted: m });
        }
    }
};

