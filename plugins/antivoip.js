// ============================================================
// 🌍 LISTA PREFISSI PAESI
// ============================================================
const countryPrefixes = [
    { code: '+39', country: 'Italia', flag: '🇮🇹' },
    { code: '+1', country: 'USA / Canada', flag: '🇺🇸' },
    { code: '+44', country: 'Regno Unito', flag: '🇬🇧' },
    { code: '+33', country: 'Francia', flag: '🇫🇷' },
    { code: '+49', country: 'Germania', flag: '🇩🇪' },
    { code: '+34', country: 'Spagna', flag: '🇪🇸' },
    { code: '+7', country: 'Russia', flag: '🇷🇺' },
    { code: '+380', country: 'Ucraina', flag: '🇺🇦' },
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
    { code: '+63', country: 'Filippine', flag: '🇵🇭' },
    { code: '+55', country: 'Brasile', flag: '🇧🇷' },
    { code: '+86', country: 'Cina', flag: '🇨🇳' },
    { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
    { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
    { code: '+20', country: 'Egitto', flag: '🇪🇬' },
    { code: '+27', country: 'Sud Africa', flag: '🇿🇦' },
    { code: '+212', country: 'Marocco', flag: '🇲🇦' },
    { code: '+213', country: 'Algeria', flag: '🇩🇿' },
    { code: '+216', country: 'Tunisia', flag: '🇹🇳' },
    { code: '+40', country: 'Romania', flag: '🇷🇴' },
    { code: '+48', country: 'Polonia', flag: '🇵🇱' },
    { code: '+351', country: 'Portogallo', flag: '🇵🇹' },
    { code: '+30', country: 'Grecia', flag: '🇬🇷' },
    { code: '+31', country: 'Paesi Bassi', flag: '🇳🇱' },
    { code: '+32', country: 'Belgio', flag: '🇧🇪' },
    { code: '+41', country: 'Svizzera', flag: '🇨🇭' },
    { code: '+43', country: 'Austria', flag: '🇦🇹' },
    { code: '+45', country: 'Danimarca', flag: '🇩🇰' },
    { code: '+46', country: 'Svezia', flag: '🇸🇪' },
    { code: '+47', country: 'Norvegia', flag: '🇳🇴' },
    { code: '+358', country: 'Finlandia', flag: '🇫🇮' },
    { code: '+353', country: 'Irlanda', flag: '🇮🇪' }
];

// Cache sospetti per gruppo: { chatId: [array numeri] }
global.antivoipCache = global.antivoipCache || {};

// ============================================================
// 🧠 UTILITY
// ============================================================
function jidToNumber(jid) {
    if (!jid) return null;
    let num = jid.split('@')[0].split(':')[0].split('_')[0];
    let clean = num.replace(/[^0-9]/g, '');
    return '+' + clean;
}

function getCountryInfo(number) {
    if (!number) return { code: '?', country: 'Sconosciuto', flag: '🌍' };
    let clean = String(number).replace(/[^0-9]/g, '');
    let sorted = [...countryPrefixes].sort((a, b) => b.code.length - a.code.length);
    for (let c of sorted) {
        let prefixCode = c.code.replace('+', '');
        if (clean.startsWith(prefixCode)) return c;
    }
    return { code: '?', country: 'Sconosciuto', flag: '🌍' };
}

function isItalian(number) {
    if (!number) return false;
    let clean = String(number).replace(/[^0-9]/g, '');
    return clean.startsWith('39');
}

// ============================================================
// 🎛️ HANDLER PRINCIPALE
// ============================================================
let handler = async (m, { conn, text, command }) => {
    let chatId = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    if (!chatId.endsWith('@g.us')) {
        return conn.sendMessage(chatId, { text: '❌ Questo comando funziona solo nei gruppi.' }, { quoted: m });
    }

    // Verifica admin
    let isSenderAdmin = false;
    try {
        const meta = await conn.groupMetadata(chatId);
        const senderPure = (sender || '').replace(/[^0-9]/g, '');
        isSenderAdmin = !!meta.participants.find(p => 
            (p.id || '').replace(/[^0-9]/g, '') === senderPure && p.admin
        );
    } catch (e) {}

    if (!isSenderAdmin) {
        return conn.sendMessage(chatId, { text: '❌ Solo gli admin del gruppo possono usare questo comando.' }, { quoted: m });
    }

    // Bottoni
    let buttonId = null;
    if (m.message?.buttonsResponseMessage?.selectedButtonId) {
        buttonId = m.message.buttonsResponseMessage.selectedButtonId;
    } else if (m.msg?.selectedButtonId) {
        buttonId = m.msg.selectedButtonId;
    } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            let parsed = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            if (parsed.id) buttonId = parsed.id;
        } catch (e) {}
    }

    // ============================================================
    // 🚪 BUTTA FUORI TUTTI
    // ============================================================
    if (buttonId === 'antivoip_kickall') {
        let sospetti = global.antivoipCache[chatId];

        if (!sospetti || sospetti.length === 0) {
            return conn.sendMessage(chatId, { text: '⚠️ Nessun sospetto in cache. Rilancia `.antivoip`.' }, { quoted: m });
        }

        await conn.sendMessage(chatId, { text: `⏳ Butto fuori ${sospetti.length} membri...` }, { quoted: m });

        let jids = sospetti.map(s => s.jid);
        let kickati = 0;
        let errori = 0;

        try {
            await conn.groupParticipantsUpdate(chatId, jids, 'remove');
            kickati = jids.length;
        } catch (e) {
            console.error('[ANTIVOIP] Errore kick all:', e.message);
            errori = jids.length;
        }

        // Pulisci cache
        delete global.antivoipCache[chatId];

        let resultText = `✅ *OPERAZIONE COMPLETATA*\n\n`;
        resultText += `🚪 Buttati fuori: *${kickati}*\n`;
        if (errori > 0) resultText += `❌ Errori: *${errori}*\n`;

        return conn.sendMessage(chatId, { text: resultText }, { quoted: m });
    }

    // ============================================================
    // ✅ LASCIA STARE
    // ============================================================
    if (buttonId === 'antivoip_okall') {
        delete global.antivoipCache[chatId];
        return conn.sendMessage(chatId, { text: '✅ *Nessuna azione intrapresa.*\n\n_I sospetti resteranno nel gruppo._' }, { quoted: m });
    }

    // ============================================================
    // 🔍 SCANSIONE
    // ============================================================
    if ((command || '').toLowerCase() === 'antivoip') {
        await conn.sendMessage(chatId, { text: '🔍 Scansione membri in corso...' }, { quoted: m });

        let meta;
        try {
            meta = await conn.groupMetadata(chatId);
        } catch (e) {
            return conn.sendMessage(chatId, { text: '❌ Errore lettura gruppo.' }, { quoted: m });
        }

        let botId = (conn.user?.id || '').replace(/[^0-9]/g, '');

        let stranieri = [];
        let italiani = 0;

        for (let p of meta.participants) {
            let jid = p.id || '';
            let num = jidToNumber(jid);
            if (!num) continue;

            if (num.replace('+', '') === botId) continue;

            if (p.admin) {
                italiani++;
                continue;
            }

            if (isItalian(num)) {
                italiani++;
            } else {
                let countryInfo = getCountryInfo(num);
                stranieri.push({
                    jid: jid,
                    number: num,
                    country: countryInfo
                });
            }
        }

        // Nessuno straniero
        if (stranieri.length === 0) {
            return conn.sendMessage(chatId, {
                text: `✅ *Scansione completata*\n\n👥 Membri: ${meta.participants.length}\n🇮🇹 Italiani: ${italiani}\n🌍 Stranieri: 0\n\n_Il gruppo è pulito!_ 🎉`
            }, { quoted: m });
        }

        // Salva in cache
        global.antivoipCache[chatId] = stranieri;

        // Costruisci lista
        let lista = '';
        stranieri.slice(0, 15).forEach((s, i) => {
            lista += `${i + 1}. ${s.country.flag} \`${s.number}\` (${s.country.country})\n`;
        });
        if (stranieri.length > 15) {
            lista += `\n_...e altri ${stranieri.length - 15}_`;
        }

        let txt = `🚨 *RILEVAMENTO COMPLETATO* 🚨\n\n`;
        txt += `👥 Membri scansionati: *${meta.participants.length}*\n`;
        txt += `🇮🇹 Italiani (+39): *${italiani}*\n`;
        txt += `🌍 Sospetti (non +39): *${stranieri.length}*\n\n`;
        txt += `📋 *Lista sospetti:*\n${lista}\n`;
        txt += `⚡ _Cosa vuoi fare?_`;

        return conn.sendMessage(chatId, {
            text: txt,
            footer: 'Zeno Bot • Antivoip',
            buttons: [
                { buttonId: 'antivoip_kickall', buttonText: { displayText: '🚪 Butta fuori tutti' }, type: 1 },
                { buttonId: 'antivoip_okall', buttonText: { displayText: '✅ Lascia stare' }, type: 1 }
            ],
            headerType: 1
        }, { quoted: m });
    }
};

handler.help = ['antivoip'];
handler.tags = ['moderazione'];
handler.command = /^(antivoip)$/i;

export default handler;
