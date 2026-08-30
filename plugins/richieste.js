import { proto } from '@realvare/baileys';
import { isOwner } from './owner.js';

function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) {
        return false;
    }
}

// Funzione helper per estrarre il prefisso internazionale in modo intelligente
function getPrefix(jid) {
    let num = pureId(jid);
    if (num.startsWith('39')) return { code: '+39', name: '🇮🇹 Italia' };
    if (num.startsWith('1')) return { code: '+1', name: '🇺🇸 USA / VoIP' };
    if (num.startsWith('44')) return { code: '+44', name: '🇬🇧 UK' };
    if (num.startsWith('212')) return { code: '+212', name: '🇲🇦 Marocco' };
    if (num.startsWith('40')) return { code: '+40', name: '🇷🇴 Romania' };
    
    // Fallback generico: prende le prime 2 o 3 cifre come codice indicativo
    let guess = num.substring(0, 3);
    if (num.startsWith('49')) guess = '49';
    if (num.startsWith('33')) guess = '33';
    return { code: `+${guess}`, name: '🌐 Estero/Altro' };
}

let handler = async (m, { conn, text, command }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;
    let isGroup = jid.endsWith('@g.us');

    if (!isGroup) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo all\'interno di un gruppo!' }, { quoted: m });
    }

    let isCmdOwner = isOwner(sender);
    let isCmdAdmin = await isAdmin(conn, jid, sender);

    if (!isCmdOwner && !isCmdAdmin) {
        return await conn.sendMessage(jid, { text: '❌ Solo i creatori del bot o gli amministratori possono gestire le richieste.' }, { quoted: m });
    }

    let args = text ? text.trim().toLowerCase() : '';

    // --- LOGICA DI ELABORAZIONE DEI BOTTONI NATIVI ---
    if (args === 'it' || args === 'voip' || args === 'all' || args === 'reject') {
        await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

        let requests = await conn.groupRequestParticipantsList(jid).catch(() => []);
        
        if (!requests || requests.length === 0) {
            await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
            return await conn.sendMessage(jid, { text: '📝 *Gestione Richieste*\n\nNessun utente è attualmente in coda di attesa in questo gruppo!' }, { quoted: m });
        }

        let processedCount = 0;
        let actionType = args === 'reject' ? 'reject' : 'approve';

        for (let req of requests) {
            let userJid = req.jid;
            let isItalian = userJid.startsWith('39');

            let matchFilter = false;
            if (args === 'it' && isItalian) matchFilter = true;
            if (args === 'voip' && !isItalian) matchFilter = true;
            if (args === 'all' || args === 'reject') matchFilter = true;

            if (matchFilter) {
                await conn.groupRequestParticipantsUpdate(jid, [userJid], actionType).catch(() => null);
                processedCount++;
            }
        }

        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });
        let statusMsg = actionType === 'approve' ? 'approvati ed entrati' : 'rifiutati e rimossi';
        return await conn.sendMessage(jid, { 
            text: `🎯 *OPERAZIONE COMPLETATA!*\n\nFiltro applicato con successo.\nUtenti ${statusMsg}: *${processedCount}*` 
        }, { quoted: m });
    }

    // --- PANNELLO PRINCIPALE CON SCANSIONE DEI PREFISSI IN TEMPO REALE ---
    let requestsList = await conn.groupRequestParticipantsList(jid).catch(() => []);
    let totalInQueue = requestsList ? requestsList.length : 0;

    // Calcolo automatico dei prefissi presenti
    let prefixStats = {};
    if (requestsList && requestsList.length > 0) {
        for (let req of requestsList) {
            let info = getPrefix(req.jid);
            let key = `${info.name} (${info.code})`;
            prefixStats[key] = (prefixStats[key] || 0) + 1;
        }
    }

    // Costruzione del testo del resoconto statistico
    let prefixText = '';
    let statsKeys = Object.keys(prefixStats);
    if (statsKeys.length > 0) {
        prefixText = `📊 *PREFISSI IN CODA DI ATTESA:*\n`;
        for (let k of statsKeys) {
            prefixText += ` • ${k}: *${prefixStats[k]}* utenti\n`;
        }
    } else {
        prefixText = `📊 *PREFISSI IN CODA:* _Nessuno in attesa._\n`;
    }

    let bodyText = `📝 *PANNELLO RICHIESTE DI ACCESSO*\n\n`;
    bodyText += `👥 Totale in coda: *${totalInQueue}* utenti\n\n`;
    bodyText += `${prefixText}\n`;
    bodyText += `Scegli un'opzione qui sotto tramite i pulsanti per elaborare la coda in automatico ed evitare raid molesti.`;

    // Aggiunto anche il quarto bottone per Rifiutare tutti al volo!
    let buttonsConfig = [
        { 
            name: "quick_reply", 
            buttonParamsJson: JSON.stringify({ display_text: "🇮🇹 Accetta +39", id: `.req it` }) 
        },
        { 
            name: "quick_reply", 
            buttonParamsJson: JSON.stringify({ display_text: "🌐 Accetta VoIP/Esteri", id: `.req voip` }) 
        },
        { 
            name: "quick_reply", 
            buttonParamsJson: JSON.stringify({ display_text: "✅ Accetta Tutti", id: `.req all` }) 
        },
        { 
            name: "quick_reply", 
            buttonParamsJson: JSON.stringify({ display_text: "❌ Rifiuta Tutti", id: `.req reject` }) 
        }
    ];

    let messageContent = proto.Message.fromObject({
        viewOnceMessage: {
            message: {
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({ text: bodyText }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `Zero Bot - Security System 🛡️` }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                        buttons: buttonsConfig
                    })
                })
            }
        }
    });

    return await conn.relayMessage(jid, messageContent, {});
};

handler.help = ['req'];
handler.tags = ['group'];
handler.command = /^(req|richieste|richiesta)$/i;

export default handler;
