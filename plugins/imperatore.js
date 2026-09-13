import { isOwner } from './owner.js';

// ============================================================
// 👑 IMPERATORE - Spam estremo e convocazione (solo creatori)
// ============================================================
const NEW_GROUP_LINK = 'https://chat.whatsapp.com/LD4KX7ZnXnX7ftBAjRYtAr?s=cl&p=a&mlu=4&ilr=4';

let handler = async (m, { conn, text, command }) => {
    let chatId = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    // Solo gruppi
    if (!chatId.endsWith('@g.us')) {
        return conn.sendMessage(chatId, { text: '❌ Questo comando funziona solo nei gruppi.' }, { quoted: m });
    }

    // 🔒 Solo i creatori del bot possono usarlo
    if (!isOwner(sender)) {
        return conn.sendMessage(chatId, { text: '❌ Questo comando è riservato ai *creatori del bot*.' }, { quoted: m });
    }

    // Recupera metadata del gruppo
    let meta;
    try {
        meta = await conn.groupMetadata(chatId);
    } catch (e) {
        return conn.sendMessage(chatId, { text: '❌ Errore lettura gruppo.' }, { quoted: m });
    }

    // Link personalizzato (opzionale: .imperatore [link])
    let link = (text || '').trim();
    if (!link || !link.startsWith('http')) {
        link = NEW_GROUP_LINK;
    }

    // Recupera tutti i JID dei membri per il tag-all
    let tags = meta.participants.map(p => p.id).filter(Boolean);

    // Frasi d'effetto da ciclare per arrivare a 200 messaggi
    let frasiSpam = [
        `👑 *TRASFERIMENTO IMPERIALE IN CORSO!* Entrate subito qui prima che chiuda: ${link}`,
        `⚡ *FORZA RAGAZZI, TUTTI NEL NUOVO GRUPPO!* ➡️ ${link}`,
        `🔥 *ULTIMA CHIAMATA PER IL NUOVO IMPERO:* ${link}`,
        `🚪 *IL VECCHIO GRUPPO È ABBANDONATO, CLICCATE ORA:* ${link}`,
        `🚨 *SPOSTATEVI NEL NUOVO QUARTIERE GENERALE:* ${link}`,
        `💥 *FORZA, IL TRONO VI ASPETTA QUI:* ${link}`,
        `🔔 *CLICCA E UNISCITI AL NUOVO GRUPPO:* ${link}`,
        `🏃‍♂️ *CORRETE NEL NUOVO GRUPPO UFFICIALE:* ${link}`
    ];

    try {
        // Messaggio epico principale iniziale
        let testoPrincipale =
            `👑 *ATTENZIONE A TUTTI I SUDDITI* 👑\n\n` +
            `⚔️ *Il vecchio impero è caduto.*\n` +
            `🔥 *Il trono si è spostato.*\n` +
            `🏛️ *È ora di ricostruire la leggenda.*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🚪 *UNISCITI AL NUOVO QUARTIER GENERALE:*\n` +
            `${link}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⚠️ _Chi non entra, sarà dimenticato._\n` +
            `👑 _Zeno Imperatore ti attende._`;

        await conn.sendMessage(chatId, {
            text: testoPrincipale,
            mentions: tags
        }, { quoted: m });

        // Ciclo per inviare i 200 messaggi di spam di fila con il tag incorporato
        for (let i = 1; i <= 200; i++) {
            let fraseScelta = frasiSpam[(i - 1) % frasiSpam.length];
            let testoFinale = `[${i}/200] ${fraseScelta}`;

            await conn.sendMessage(chatId, {
                text: testoFinale,
                mentions: tags
            });

            // Ritardo di 50ms per spararli a raffica in sicurezza
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Reazione di conferma finale
        await conn.sendMessage(chatId, { react: { text: '👑', key: m.key } }).catch(() => {});

    } catch (e) {
        console.error('[IMPERATORE] Errore:', e.message);
        return conn.sendMessage(chatId, { text: `❌ Errore durante lo spam: ${e.message}` }, { quoted: m });
    }
};

handler.help = ['imperatore'];
handler.tags = ['moderazione'];
handler.command = /^(imperatore)$/i;
handler.owner = true;

export default handler;
