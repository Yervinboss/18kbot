import fetch from 'node-fetch';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    let chatId = m.chat || m.from || (m.key && m.key.remoteJid);
    if (!chatId) return;

    if (!text) {
        return conn.sendMessage(chatId, { 
            text: `*Uso corretto:* \n${usedPrefix + command} <URL>\n\n*Esempio:* \n${usedPrefix + command} https://github.com` 
        }, { quoted: m });
    }

    let url = text.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*(\?.*)?$/i;
    if (!urlPattern.test(url)) {
        return conn.sendMessage(chatId, { text: '❌ URL non valido. Assicurati di inserire un indirizzo web corretto.' }, { quoted: m });
    }

    try {
        await conn.sendMessage(chatId, { text: '📸 Catturo lo screenshot della pagina...' }, { quoted: m });

        let buffer;
        let success = false;

        // TENTATIVO 1: Microlink API con timeout a 7 secondi
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            let apiMicrolink = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
            let res = await fetch(apiMicrolink, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            let contentType = res.headers.get('content-type') || '';
            if (res.ok && !contentType.includes('application/json')) {
                let arrayBuffer = await res.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
                if (buffer.length > 9000) success = true; 
            }
        } catch (err) {
            console.log('API Principale (Microlink) fallita o andata in timeout, tento il backup...');
        }

        // TENTATIVO 2: Backup su thum.io con timeout a 7 secondi
        if (!success) {
            try {
                const backupController = new AbortController();
                const backupTimeoutId = setTimeout(() => backupController.abort(), 7000);

                let apiBackup = `https://image.thum.io/get/width/1200/crop/800/${url}`;
                let resBackup = await fetch(apiBackup, { signal: backupController.signal });
                clearTimeout(backupTimeoutId);
                
                if (resBackup.ok) {
                    let arrayBuffer = await resBackup.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                    success = true;
                }
            } catch (backupErr) {
                console.log('API di Backup fallita o andata in timeout:', backupErr.message);
            }
        }

        if (!success || !buffer) {
            throw new Error('Tutti i server di screenshot sono temporaneamente saturi o l\'URL non è raggiungibile.');
        }

        await conn.sendMessage(chatId, { 
            image: buffer, 
            caption: `🌐 Screenshot di: ${url}` 
        }, { quoted: m });

    } catch (e) {
        console.error('⚠️ [Errore Comando SS intercettato]:', e.message);
        try {
            await conn.sendMessage(chatId, { text: `❌ Errore: ${e.message}` }, { quoted: m });
        } catch (msgErr) {
            console.error('Impossibile notificare l\'utente:', msgErr.message);
        }
    }
};

handler.help = ['ss <url>'];
handler.tags = ['tools'];
handler.command = /^(ss|screenshot)$/i;

export default handler;
