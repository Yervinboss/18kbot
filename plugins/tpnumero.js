import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

global.tpNumeroSelection = global.tpNumeroSelection || {};
global.tpNumeroProcessing = global.tpNumeroProcessing || {};

function cleanNumber(text) {
    if (!text) return '';
    let num = String(text).replace(/[^0-9]/g, '');
    if (num.startsWith('00')) num = num.substring(2);
    return num;
}

function analyzeNumber(num) {
    if (!num || num.length < 8) return null;

    let info = {
        raw: num,
        country: 'Sconosciuto',
        flag: '🌍',
        type: 'Sconosciuto',
        operator: 'Sconosciuto',
        prefix: ''
    };

    if (num.startsWith('39') && num.length >= 11) {
        info.country = 'Italia';
        info.flag = '🇮🇹';
        const local = num.substring(2);
        info.prefix = local.substring(0, 3);

        if (local.startsWith('3')) {
            info.type = '📱 Mobile';
            if (local.startsWith('33') || local.startsWith('34')) info.operator = 'TIM / Vodafone';
            else if (local.startsWith('32')) info.operator = 'WindTre';
            else if (local.startsWith('35')) info.operator = 'WindTre / Iliad';
            else if (local.startsWith('36')) info.operator = 'TIM';
            else if (local.startsWith('37')) info.operator = 'WindTre';
            else if (local.startsWith('38')) info.operator = 'Vodafone';
            else if (local.startsWith('39')) info.operator = 'TIM / Vodafone';
            else info.operator = 'Operatore italiano';
        } else if (local.startsWith('0')) {
            info.type = '☎️ Fisso';
            info.operator = 'Telefono fisso';
        }
    } else if (num.startsWith('1') && num.length === 11) {
        info.country = 'USA / Canada';
        info.flag = '🇺🇸';
        info.type = '📱 Mobile';
        info.operator = 'Operatore USA';
    } else if (num.startsWith('44')) {
        info.country = 'Regno Unito';
        info.flag = '🇬🇧';
        info.type = '📱 Mobile';
        info.operator = 'Operatore UK';
    } else if (num.startsWith('49')) {
        info.country = 'Germania';
        info.flag = '🇩🇪';
        info.type = '📱 Mobile';
        info.operator = 'Operatore DE';
    } else if (num.startsWith('33')) {
        info.country = 'Francia';
        info.flag = '🇫🇷';
        info.type = '📱 Mobile';
        info.operator = 'Operatore FR';
    } else if (num.startsWith('34')) {
        info.country = 'Spagna';
        info.flag = '🇪🇸';
        info.type = '📱 Mobile';
        info.operator = 'Operatore ES';
    } else {
        info.type = '📱 Numero internazionale';
        info.operator = 'Sconosciuto';
    }

    return info;
}async function processTpNumeroSelection(conn, m, cardId) {
    const processKey = `${m.key.id}_${m.sender}`;
    if (global.tpNumeroProcessing[processKey]) return;
    global.tpNumeroProcessing[processKey] = true;
    setTimeout(() => { delete global.tpNumeroProcessing[processKey]; }, 8000);

    let chatId = m.key.remoteJid;

    let cache = global.tpNumeroSelection[m.sender] || global.tpNumeroSelection[chatId];
    if (!cache) {
        return conn.sendMessage(chatId, { 
            text: "❌ Sessione scaduta. Rifai la ricerca con `.tpnumero 3331234567`." 
        }, { quoted: m });
    }

    let { num, info } = cache;

    if (cardId === 'tpnum_wa') {
        return conn.sendMessage(chatId, {
            text: `📱 *APRI WHATSAPP*\n\n🔢 Numero: +${num}\n\n👆 Clicca qui per aprire la chat:\nhttps://wa.me/${num}\n\n_Se il numero non è su WhatsApp, il link non funzionerà._`
        }, { quoted: m });
    }

    if (cardId === 'tpnum_info') {
        let text = `📞 *INFO NUMERO*\n\n`;
        text += `🔢 Numero: *+${num}*\n`;
        text += `${info.flag} Paese: *${info.country}*\n`;
        text += `📱 Tipo: *${info.type}*\n`;
        text += `🏢 Operatore: *${info.operator}*\n`;
        if (info.prefix) text += `🔖 Prefisso: *${info.prefix}*\n`;
        return conn.sendMessage(chatId, { text }, { quoted: m });
    }

    if (cardId === 'tpnum_google') {
        return conn.sendMessage(chatId, {
            text: `🔎 *CERCA SU GOOGLE*\n\n👆 Clicca qui:\nhttps://www.google.com/search?q=${num}`
        }, { quoted: m });
    }

    if (cardId === 'tpnum_facebook') {
        return conn.sendMessage(chatId, {
            text: `📘 *CERCA SU FACEBOOK*\n\n👆 Clicca qui:\nhttps://www.facebook.com/search/top?q=${num}`
        }, { quoted: m });
    }

    if (cardId === 'tpnum_instagram') {
        return conn.sendMessage(chatId, {
            text: `📷 *CERCA SU INSTAGRAM*\n\n👆 Clicca qui:\nhttps://www.instagram.com/web/search/topsearch/?query=${num}`
        }, { quoted: m });
    }
}let handler = async (m, { conn, text, command }) => {
    let chatId = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    let buttonId = null;
    if (m.message?.buttonsResponseMessage?.selectedButtonId) {
        buttonId = m.message.buttonsResponseMessage.selectedButtonId;
    } else if (m.message?.templateButtonReplyMessage?.selectedId) {
        buttonId = m.message.templateButtonReplyMessage.selectedId;
    } else if (m.msg?.selectedButtonId) {
        buttonId = m.msg.selectedButtonId;
    } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            let parsed = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            if (parsed.id) buttonId = parsed.id;
        } catch (e) {}
    }

    if (buttonId && buttonId.startsWith('tpnum_')) {
        await processTpNumeroSelection(conn, m, buttonId);
        return;
    }

    if ((command || '').toLowerCase() === 'tpnumero') {
        let query = (text || '').trim();

        if (!query) {
            return conn.sendMessage(chatId, {
                text: "📱 *Uso:* `.tpnumero +39 333 1234567`\n\nInserisci il numero da analizzare."
            }, { quoted: m });
        }

        let num = cleanNumber(query);

        if (num.length < 8 || num.length > 15) {
            return conn.sendMessage(chatId, {
                text: "❌ Numero non valido. Inserisci un numero con prefisso internazionale.\n_Esempio: +39 333 1234567_"
            }, { quoted: m });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: m.key } });

        let info = analyzeNumber(num);
        if (!info) {
            return conn.sendMessage(chatId, {
                text: "❌ Non riesco ad analizzare questo numero. Verifica il prefisso."
            }, { quoted: m });
        }

        global.tpNumeroSelection[sender] = { num, info };
        if (chatId.endsWith('@g.us')) {
            global.tpNumeroSelection[chatId] = { num, info };
        }

        let headerText = `📱 *ANALISI NUMERO*\n\n` +
            `🔢 *+${num}*\n` +
            `${info.flag} ${info.country} • ${info.type}\n` +
            `🏢 ${info.operator}\n\n` +
            `_Scegli un'azione dalle card qui sotto:_`;

        let cardWA = {
            title: `📱 Apri WhatsApp`,
            body: `Apri chat su WhatsApp\n+${num}`,
            footer: 'Zeno Bot',
            buttons: [{
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📱 Apri WhatsApp',
                    id: 'tpnum_wa'
                })
            }]
        };

        let cardInfo = {
            title: `📞 Info Numero`,
            body: `${info.flag} ${info.country}\n📱 ${info.type}\n🏢 ${info.operator}`,
            footer: 'Zeno Bot',
            buttons: [{
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📞 Vedi dettagli',
                    id: 'tpnum_info'
                })
            }]
        };

        let cardGoogle = {
            title: `🔎 Cerca su Google`,
            body: `Cerca "${num}" su Google`,
            footer: 'Zeno Bot',
            buttons: [{
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '🔎 Apri Google',
                    id: 'tpnum_google'
                })
            }]
        };

        let cardFB = {
            title: `📘 Cerca su Facebook`,
            body: `Cerca "${num}" su Facebook`,
            footer: 'Zeno Bot',
            buttons: [{
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📘 Apri Facebook',
                    id: 'tpnum_facebook'
                })
            }]
        };

        let cardIG = {
            title: `📷 Cerca su Instagram`,
            body: `Cerca "${num}" su Instagram`,
            footer: 'Zeno Bot',
            buttons: [{
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '📷 Apri Instagram',
                    id: 'tpnum_instagram'
                })
            }]
        };

        return conn.sendMessage(chatId, {
            text: headerText,
            footer: 'Zeno Bot • Analisi Numero',
            cards: [cardWA, cardInfo, cardGoogle, cardFB, cardIG]
        }, { quoted: m });
    }
};handler.messageHook = async (conn, m) => {
    let buttonId = null;
    if (m.message?.buttonsResponseMessage?.selectedButtonId) {
        buttonId = m.message.buttonsResponseMessage.selectedButtonId;
    } else if (m.message?.templateButtonReplyMessage?.selectedId) {
        buttonId = m.message.templateButtonReplyMessage.selectedId;
    } else if (m.msg?.selectedButtonId) {
        buttonId = m.msg.selectedButtonId;
    } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            let parsed = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            if (parsed.id) buttonId = parsed.id;
        } catch (e) {}
    }

    if (buttonId && buttonId.startsWith('tpnum_')) {
        const processKey = `${m.key.id}_${m.sender}`;
        if (!global.tpNumeroProcessing[processKey]) {
            await processTpNumeroSelection(conn, m, buttonId);
        }
    }
};

handler.command = /^(tpnumero)$/i;
handler.help = ['tpnumero'];
handler.tags = ['tools'];

export default handler;
