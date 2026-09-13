// ============================================================
// 🗑️ DEL - Elimina il messaggio quotato e il comando all'istante
// ============================================================

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

let handler = async (m, { conn }) => {
    let chatId = m.key.remoteJid;

    // 🔍 Estrazione pulita del messaggio quotato
    let quoted = m.quoted || m.msg?.contextInfo?.quotedMessage || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let contextInfo = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;

    if (!quoted && !contextInfo?.stanzaId) {
        return conn.sendMessage(chatId, {
            text: `🗑️ *Elimina Messaggio*\n\n📌 *Come si usa:*\nRispondi a un messaggio qualsiasi con \`.del\` per eliminarlo all'istante insieme al tuo comando.`
        }, { quoted: m });
    }

    // 1. Costruzione della chiave del messaggio da eliminare
    let targetKey = {
        remoteJid: chatId,
        fromMe: m.quoted ? m.quoted.fromMe : (contextInfo?.participant === conn.user.jid || contextInfo?.participant === conn.user.id.split(':') + '@s.whatsapp.net'),
        id: m.quoted?.id || contextInfo?.stanzaId,
        participant: m.quoted?.sender || contextInfo?.participant || contextInfo?.remoteJid
    };

    // 2. Riferimento del tuo comando attuale (.del)
    let commandKey = m.key;

    try {
        // Elimina PRIMA il messaggio della vittima (priorità assoluta)
        await conn.sendMessage(chatId, { delete: targetKey });
        
        // Pausa strategica di 150 millisecondi per dare tempo a WhatsApp di respirare
        await delay(150);
        
        // Elimina SUBITO DOPO il tuo comando .del
        await conn.sendMessage(chatId, { delete: commandKey });
    } catch (e) {
        console.error('[DEL] Errore sequenziale:', e.message);
        
        // Ultimo tentativo disperato senza attese se qualcosa va storto
        try {
            await conn.sendMessage(chatId, { delete: targetKey });
            await conn.sendMessage(chatId, { delete: commandKey });
        } catch (err) {
            // Se fallisce ancora, non mandiamo messaggi in chat per non intasarla, registriamo solo l'errore
            console.error('[DEL] Impossibile eliminare i messaggi.');
        }
    }
};

handler.help = ['del', 'delete'];
handler.tags = ['tools'];
handler.command = /^(del|delete)$/i;

export default handler;
