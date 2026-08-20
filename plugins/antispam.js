const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../antispam.json');

// ID dell'owner supremo per l'immunità totale
const ownerId = '129601359589600';

// Cache in memoria per tracciare i messaggi e gli admin senza sovraccaricare WhatsApp
const utentiMessaggi = new Map();
const cacheAdmin = new Map();

function getConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ settings: {}, warns: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveConfig(data) {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

const getCleanNumber = (jid) => {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
};

module.exports = {
    name: 'antispam',
    category: 'admin',
    description: 'Gestisce l\'anti-spam nel gruppo (Solo Admin)',

    // 1. FILTRO IN TEMPO REALE CONTRO LO SPAM DI QUALSIASI MESSAGGIO
    async handleMessage(sock, m) {
        if (!m.key.remoteJid || !m.key.participant || m.key.fromMe) return;

        const chatId = m.key.remoteJid;
        if (!chatId.endsWith('@g.us')) return;

        const db = getConfig();
        const isAntispamActive = db.settings[chatId]?.active || false;
        if (!isAntispamActive) return;

        const sender = m.key.participant;
        const senderClean = getCleanNumber(sender);

        // L'owner supremo non viene mai toccato
        if (sender.includes(ownerId) || senderClean.includes(ownerId)) return;

        try {
            const now = Date.now();
            let participants = [];

            // SISTEMA DI CACHE ADMIN: Controlla se abbiamo già i dati del gruppo salvati negli ultimi 10 secondi
            if (cacheAdmin.has(chatId) && (now - cacheAdmin.get(chatId).timestamp < 10000)) {
                participants = cacheAdmin.get(chatId).participants;
            } else {
                // Se non li abbiamo o sono vecchi, li scarica da WhatsApp e li salva in cache
                const groupMetadata = await sock.groupMetadata(chatId);
                participants = groupMetadata.participants;
                cacheAdmin.set(chatId, { participants, timestamp: now });
            }

            const esecutore = participants.find(p => p.id === sender);
            const isAdmin = esecutore?.admin === 'admin' || esecutore?.admin === 'superadmin';
            if (isAdmin) return;

            const messageContent = m.message.conversation || m.message.extendedTextMessage?.text || JSON.stringify(m.message);

            // Crea la chiave unica per l'utente nel gruppo
            const userKey = `${chatId}_${sender}`;

            if (!utentiMessaggi.has(userKey)) {
                utentiMessaggi.set(userKey, { timestamps: [], lastMessage: '' });
            }

            const userData = utentiMessaggi.get(userKey);
            
            // Pulisce i timestamp più vecchi di 3 secondi
            userData.timestamps = userData.timestamps.filter(time => now - time < 3000);
            
            // Aggiunge l'invio corrente
            userData.timestamps.push(now);

            let isSpamming = false;

            // REGOLA 1: Se invia più di 4 messaggi in meno di 3 secondi
            if (userData.timestamps.length > 4) {
                isSpamming = true;
            }

            // REGOLA 2: Se invia lo stesso identico testo di fila per più di 2 volte
            if (messageContent === userData.lastMessage && userData.timestamps.length > 2) {
                isSpamming = true;
            }

            userData.lastMessage = messageContent;

            // SE VIENE RILEVATO LO SPAM
            if (isSpamming) {
                // A) CANCELLA IL MESSAGGIO ALL'ISTANTE
                await sock.sendMessage(chatId, { delete: m.key });

                const mode = db.settings[chatId]?.mode || 'warn';

                if (mode === 'kick') {
                    // B) BAN DIRETTO
                    await sock.sendMessage(chatId, { text: `🚨 @${senderClean} è stato rimosso immediatamente dal gruppo per SPAM compulsivo!`, mentions: [sender] });
                    await sock.groupParticipantsUpdate(chatId, [sender], "remove");
                } else {
                    // C) SISTEMA AD AVVERTIMENTI (WARN)
                    if (!db.warns[chatId]) db.warns[chatId] = {};
                    if (!db.warns[chatId][sender]) db.warns[chatId][sender] = 0;

                    db.warns[chatId][sender] += 1;
                    const currentWarns = db.warns[chatId][sender];

                    if (currentWarns >= 3) {
                        await sock.sendMessage(chatId, { text: `❌ @${senderClean} ha raggiunto 3/3 ammonizioni per SPAM ed è stato espulso!`, mentions: [sender] });
                        await sock.groupParticipantsUpdate(chatId, [sender], "remove");
                        db.warns[chatId][sender] = 0;
                    } else {
                        await sock.sendMessage(chatId, { text: `⚠️ **ANTI-SPAM:** @${senderClean}, rallenta! Non inviare messaggi così velocemente.\n\n📌 **Ammonizioni:** ${currentWarns}/3 (Al terzo verrai espulso).`, mentions: [sender] });
                    }
                    saveConfig(db);
                }
                
                userData.timestamps = [];
            }

        } catch (err) {
            // Se c'è comunque un errore di overlimit o rete, lo cattura nel catch senza far crashare il file
            console.error('Errore gestito nell\'anti-spam live:', err.message);
        }
    },

    // 2. COMANDO DI CONFIGURAZIONE PER GLI ADMIN
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Questo comando può essere usato solo nei gruppi.' });
        }

        try {
            const groupMetadata = await sock.groupMetadata(chatId, true);
            const esecutore = groupMetadata.participants.find(p => p.id === sender);
            const isAdmin = esecutore?.admin === 'admin' || esecutore?.admin === 'superadmin';
            const isOwner = sender.includes(ownerId) || getCleanNumber(sender) === ownerId;

            if (!isAdmin && !isOwner) return;

            const subCommand = args[0]?.toLowerCase();
            const option = args[1]?.toLowerCase();

            let db = getConfig();
            if (!db.settings[chatId]) {
                db.settings[chatId] = { active: false, mode: 'warn' };
            }

            if (subCommand === 'on') {
                db.settings[chatId].active = true;
                saveConfig(db);
                return sock.sendMessage(chatId, { text: '🛡️ **ANTI-SPAM ATTIVATO:** Il bot ora monitorerà la chat. Chi invia messaggi a raffica o duplicati verrà punito.\n⚙ *Azione configurata:* ' + db.settings[chatId].mode.toUpperCase() });
            }

            if (subCommand === 'off') {
                db.settings[chatId].active = false;
                saveConfig(db);
                return sock.sendMessage(chatId, { text: '🔓 **ANTI-SPAM DISATTIVATO:** I controlli sulla velocità dei messaggi sono stati spenti.' });
            }

            if (subCommand === 'mode') {
                if (option === 'warn' || option === 'kick') {
                    db.settings[chatId].mode = option;
                    saveConfig(db);
                    return sock.sendMessage(chatId, { text: `⚙️ **ANTI-SPAM:** La punizione è stata impostata su **${option.toUpperCase()}**.` });
                } else {
                    return sock.sendMessage(chatId, { text: '⚠️ Usa il comando corretto: `.antispam mode warn` o `.antispam mode kick`.' }, { quoted: m });
                }
            }

            const currentStatus = db.settings[chatId].active ? '🟢 ATTIVO' : '🔴 DISATTIVATO';
            const currentMode = db.settings[chatId].mode.toUpperCase();
            
            const helpText = `⚙️ **PANNELLO CONFIGURAZIONE ANTI-SPAM** ⚙️\n\n` +
                             `📊 **Stato Attuale:** ${currentStatus}\n` +
                             `🎯 **Azione Punizione:** ${currentMode}\n\n` +
                             `🛠️ **Comandi Disponibili:**\n` +
                             `▪️ \`.antispam on\` ➡️ Accende il controllo anti-spam.\n` +
                             `▪️ \`.antispam off\` ➡️ Spegne il controllo anti-spam.\n` +
                             `▪️ \`.antispam mode warn\` ➡️ Raggiunti 3 avvisi scatta il kick.\n` +
                             `▪️ \`.antispam mode kick\` ➡️ Rimuove l'utente al primo spam.`;

            return sock.sendMessage(chatId, { text: helpText }, { quoted: m });

        } catch (e) {
            console.error('Errore comando antispam:', e);
        }
    }
};
