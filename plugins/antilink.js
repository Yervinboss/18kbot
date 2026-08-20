const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../antilink.json');

// ID dell'owner supremo per garantire l'immunità totale
const ownerId = '129601359589600';

// Funzione per leggere il database dell'anti-link
function getConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ settings: {}, warns: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Funzione per salvare nel database
function saveConfig(data) {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

// Estrae solo i numeri dal JID
const getCleanNumber = (jid) => {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
};

module.exports = {
    name: 'antilink',
    aliases: ['antilink-setup'],
    category: 'admin',
    description: 'Gestisce l\'anti-link nel gruppo (Solo Admin)',

    // 1. FILTRO IN TEMPO REALE SUI MESSAGGI
    async handleMessage(sock, m) {
        if (!m.key.remoteJid || !m.key.participant || m.key.fromMe) return;

        const chatId = m.key.remoteJid;
        if (!chatId.endsWith('@g.us')) return; // Funziona solo nei gruppi

        const db = getConfig();
        const isAntilinkActive = db.settings[chatId]?.active || false;
        if (!isAntilinkActive) return; // Se l'anti-link è spento, non fa nulla

        const sender = m.key.participant;
        const senderClean = getCleanNumber(sender);

        // Controllo Immunità: L'owner non viene mai toccato
        if (sender.includes(ownerId) || senderClean.includes(ownerId)) return;

        const messageContent = m.message.conversation || m.message.extendedTextMessage?.text || '';
        
        // Espressione regolare per intercettare qualsiasi link (http, https, www ecc.)
        const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
        
        if (linkRegex.test(messageContent)) {
            try {
                // Recupera i partecipanti del gruppo per vedere se chi ha inviato il link è admin
                const groupMetadata = await sock.groupMetadata(chatId);
                const esecutore = groupMetadata.participants.find(p => p.id === sender);
                const isAdmin = esecutore?.admin === 'admin' || esecutore?.admin === 'superadmin';

                // Se il link è inviato da un amministratore, è autorizzato
                if (isAdmin) return;

                // --- GESTIONE ECCEZIONI: TikTok e Instagram passano sempre ---
                const lowerContent = messageContent.toLowerCase();
                if (lowerContent.includes('tiktok.com') || lowerContent.includes('instagram.com')) {
                    return; // Ignora il link e lo lascia passare
                }
                // -------------------------------------------------------------

                // A) CANCELLA IL MESSAGGIO ABUSIVO ALL'ISTANTE
                await sock.sendMessage(chatId, { delete: m.key });

                const mode = db.settings[chatId]?.mode || 'warn'; // Di base usa i warn

                if (mode === 'kick') {
                    // B) BAN DIRETTO
                    await sock.sendMessage(chatId, { text: `🚨 @${senderClean} ha inviato un link non autorizzato ed è stato rimosso immediatamente!`, mentions: [sender] });
                    await sock.groupParticipantsUpdate(chatId, [sender], "remove");
                } else {
                    // C) SISTEMA VANTAGGIOSE AMMONIZIONI (WARN)
                    if (!db.warns[chatId]) db.warns[chatId] = {};
                    if (!db.warns[chatId][sender]) db.warns[chatId][sender] = 0;

                    db.warns[chatId][sender] += 1;
                    const currentWarns = db.warns[chatId][sender];

                    if (currentWarns >= 3) {
                        // Al terzo warn scatta il kick automatico
                        await sock.sendMessage(chatId, { text: `❌ @${senderClean} ha raggiunto 3/3 ammonizioni per invio di link vietati ed è stato espulso!`, mentions: [sender] });
                        await sock.groupParticipantsUpdate(chatId, [sender], "remove");
                        db.warns[chatId][sender] = 0; // Resetta i warn dopo il kick
                    } else {
                        // Messaggio di ammonimento ordinario
                        await sock.sendMessage(chatId, { text: `⚠️ **ANTI-LINK:** @${senderClean}, non puoi inviare link in questo gruppo!\n\n📌 **Ammonizioni:** ${currentWarns}/3 (Al terzo verrai espulso).`, mentions: [sender] });
                    }
                    saveConfig(db);
                }

            } catch (err) {
                console.error('Errore nell\'anti-link live:', err);
            }
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

            // Se chi digita non è admin o owner, lo gosta silenziosamente
            if (!isAdmin && !isOwner) return;

            const subCommand = args[0]?.toLowerCase();
            const option = args[1]?.toLowerCase();

            let db = getConfig();
            if (!db.settings[chatId]) {
                db.settings[chatId] = { active: false, mode: 'warn' };
            }

            // GESTIONE ACCENSIONE / SPEGNIMENTO (.antilink on / .antilink off)
            if (subCommand === 'on') {
                db.settings[chatId].active = true;
                saveConfig(db);
                return sock.sendMessage(chatId, { text: '🛡️ **ANTI-LINK ATTIVATO:** Da adesso tutti i link verranno rimossi all\'istante.\n📌 **Eccezioni concesse:** TikTok e Instagram.\n⚙️ **Modalità corrente:** ' + db.settings[chatId].mode.toUpperCase() });
            }

            if (subCommand === 'off') {
                db.settings[chatId].active = false;
                saveConfig(db);
                return sock.sendMessage(chatId, { text: '🔓 **ANTI-LINK DISATTIVATO:** Ora tutti gli utenti possono inviare nuovamente link.' });
            }

            // GESTIONE MODALITÀ PUNIZIONE (.antilink mode warn / .antilink mode kick)
            if (subCommand === 'mode') {
                if (option === 'warn' || option === 'kick') {
                    db.settings[chatId].mode = option;
                    saveConfig(db);
                    return sock.sendMessage(chatId, { text: `⚙️ **CONFIGURAZIONE AGGIORNATA:** La modalità di punizione è stata impostata su **${option.toUpperCase()}**.` });
                } else {
                    return sock.sendMessage(chatId, { text: '⚠️ Specifica una modalità valida! Usa `.antilink mode warn` oppure `.antilink mode kick`.' }, { quoted: m });
                }
            }

            // Se il comando è incompleto, mostra la guida all'uso
            const currentStatus = db.settings[chatId].active ? '🟢 ATTIVO' : '🔴 DISATTIVATO';
            const currentMode = db.settings[chatId].mode.toUpperCase();
            
            const helpText = `⚙️ **PANNELLO CONFIGURAZIONE ANTI-LINK** ⚙️\n\n` +
                             `📊 **Stato Attuale:** ${currentStatus}\n` +
                             `🎯 **Azione Punizione:** ${currentMode}\n\n` +
                             `🛠️ **Comandi Disponibili:**\n` +
                             `▪️ \`.antilink on\` ➡️ Accende l'anti-link.\n` +
                             `▪️ \`.antilink off\` ➡️ Spegne l'anti-link.\n` +
                             `▪️ \`.antilink mode warn\` ➡️ Punisce con 3 avvisi prima del kick.\n` +
                             `▪️ \`.antilink mode kick\` ➡️ Rimuove l'utente al primo link.`;

            return sock.sendMessage(chatId, { text: helpText }, { quoted: m });

        } catch (e) {
            console.error('Errore esecuzione comando antilink:', e);
        }
    }
};

