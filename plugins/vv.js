// ============================================================
// 👁️ VV - Apri View-Once e trasformala in media normale
// ============================================================

let handler = async (m, { conn, text, command }) => {
    let chatId = m.key.remoteJid;

    // 🔍 Cerca la view-once in modo profondo e flessibile
    let viewOnceMessage = null;
    let targetMessage = null;

    // Funzione di supporto ricorsiva per trovare la view-once ovunque
    let findViewOnce = (obj) => {
        if (!obj) return null;
        
        // 1. Cerca nei vari wrapper di WhatsApp View-Once
        if (obj.viewOnceMessage?.message) return obj.viewOnceMessage.message;
        if (obj.viewOnceMessageV2?.message) return obj.viewOnceMessageV2.message;
        if (obj.viewOnceMessageV2Extension?.message) return obj.viewOnceMessageV2Extension.message;
        
        // 2. Se l'oggetto ha chiavi esterne/interne dinamiche collegate a viewOnce
        if (typeof obj === 'object') {
            for (let key of Object.keys(obj)) {
                if ((key.includes('viewOnce') || key.includes('ViewOnce')) && obj[key]?.message) {
                    return obj[key].message;
                }
            }
        }

        // 3. Se ha "message" wrapper dentro, ricorre
        if (obj.message) {
            let inner = findViewOnce(obj.message);
            if (inner) return inner;
        }
        
        // 4. Se è già un media estratto
        if (obj.imageMessage || obj.videoMessage || obj.audioMessage) return obj;
        
        return null;
    };

    // Estrazione pulita del messaggio quotato
    let quoted = m.quoted || m.msg?.contextInfo?.quotedMessage || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (quoted) {
        viewOnceMessage = findViewOnce(quoted);
        targetMessage = m.quoted || quoted;
    }

    // Se non trovato nel quoted, controlla il messaggio corrente
    if (!viewOnceMessage) {
        let currentMsg = m.message || m.msg;
        viewOnceMessage = findViewOnce(currentMsg);
        targetMessage = m;
    }

    // Se non c'è nulla, mostra il tutorial
    if (!viewOnceMessage) {
        return conn.sendMessage(chatId, {
            text: `👁️ *VV - Apri View-Once*\n\n📌 *Come si usa:*\nRispondi a una *visualizzazione singola* con \`.vv\`\n\n_Il bot la trasformerà in un media normale che puoi salvare e inoltrare._`
        }, { quoted: m });
    }

    // 🔍 Identifica il tipo di media
    let mediaType = null;
    let mediaMessage = null;

    if (viewOnceMessage.imageMessage) {
        mediaType = 'image';
        mediaMessage = viewOnceMessage.imageMessage;
    } else if (viewOnceMessage.videoMessage) {
        mediaType = 'video';
        mediaMessage = viewOnceMessage.videoMessage;
    } else if (viewOnceMessage.audioMessage) {
        mediaType = 'audio';
        mediaMessage = viewOnceMessage.audioMessage;
    }

    if (!mediaMessage) {
        return conn.sendMessage(chatId, {
            text: '❌ La view-once non contiene foto, video o audio.'
        }, { quoted: m });
    }

    // 🎬 Reazione di caricamento
    await conn.sendMessage(chatId, { react: { text: '⏳', key: m.key } }).catch(() => {});

    // 🔽 Scarica il media con gestione degli errori "bad decrypt"
    let buffer = null;
    try {
        // Proviamo a passare direttamente il messaggio multimediale "spacchettato" alla funzione nativa
        if (typeof conn.downloadMediaMessage === 'function') {
            // Forziamo la struttura attesa da realvare ricostruendo l'oggetto messaggio corretto
            let mockMsg = {
                message: {
                    [mediaType + 'Message']: mediaMessage
                }
            };
            buffer = await conn.downloadMediaMessage(mockMsg).catch(() => null);
        }

        // Metodo Alternativo se il precedente fallisce o restituisce errore di cifratura
        if (!buffer) {
            const rv = await import('@realvare/baileys').catch(() => null);
            let downloadFn = rv?.downloadContentFromMessage || rv?.default?.downloadContentFromMessage;

            if (downloadFn) {
                // Unione pulita e sicura delle proprietà cifrate per evitare bad decrypt
                let fullMediaObj = {
                    ...mediaMessage,
                    // Assicuriamoci che i buffer delle chiavi siano passati correttamente se presenti come array/oggetti
                    mediaKey: mediaMessage.mediaKey?.key || mediaMessage.mediaKey
                };

                let stream;
                try {
                    stream = await downloadFn(fullMediaObj, mediaType);
                } catch {
                    stream = await downloadFn(fullMediaObj, mediaType + 'Message');
                }

                if (stream) {
                    let chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    buffer = Buffer.concat(chunks);
                }
            }
        }
    } catch (e) {
        console.error('[VV] Errore critico download:', e.message);
    }

    if (!buffer || buffer.length === 0) {
        return conn.sendMessage(chatId, {
            text: '❌ Errore durante la decrittazione del file. La view-once potrebbe essere già scaduta o non accessibile.'
        }, { quoted: m });
    }

    // 📤 Rimanda come media NORMALE
    try {
        let caption = mediaMessage.caption || '';

        if (mediaType === 'image') {
            await conn.sendMessage(chatId, {
                image: buffer,
                caption: caption
            }, { quoted: m });
        } else if (mediaType === 'video') {
            await conn.sendMessage(chatId, {
                video: buffer,
                caption: caption,
                mimetype: mediaMessage.mimetype || 'video/mp4'
            }, { quoted: m });
        } else if (mediaType === 'audio') {
            await conn.sendMessage(chatId, {
                audio: buffer,
                mimetype: mediaMessage.mimetype || 'audio/mp4',
                ptt: mediaMessage.ptt || false
            }, { quoted: m });
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: m.key } }).catch(() => {});

    } catch (e) {
        console.error('[VV] Errore invio:', e.message);
        return conn.sendMessage(chatId, {
            text: `❌ Errore durante l'invio del file convertito.`
        }, { quoted: m });
    }
};

handler.help = ['vv'];
handler.tags = ['tools'];
handler.command = /^(vv)$/i;

export default handler;
