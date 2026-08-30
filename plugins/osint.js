import { isOwner } from './owner.js';

let handler = async (m, { conn, text }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 SCUDO DI SICUREZZA ASSOLUTO: Ora il comando diventa SOLO PER IL CREATORE SUPREMO!
    if (!isOwner(sender)) {
        return await conn.sendMessage(jid, { text: '❌ Azione negata! Questo motore di ricerca spia OSINT è riservato esclusivamente al Creatore Supremo.' }, { quoted: m });
    }

    let targetText = text ? text.trim() : '';

    if (!targetText) {
        return await conn.sendMessage(jid, { text: '🕵️‍♂️ *ZE N O  O S I N T  S E A R C H*\n\n❌ Specifica un nickname da investigare!\nEsempio: \`.osint adrian_hacker\`' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '🕵️‍♂️', key: m.key } });

    let urlGoogle = `https://google.com{encodeURIComponent(targetText)}%22`;
    let urlSocial = `https://namechk.com`;
    let urlBreach = `https://haveibeenpwned.com`;

    let bodyText = `🕵️‍♂️ *ZE N O  O S I N T  A G E N C Y* 🕵️‍♂️\n\n` +
                   `🔍 *Target in analisi:* \`${targetText}\`\n` +
                   `📊 *Accesso:* Autorizzato (Creatore)\n\n` +
                   `_Usa i bottoni qui sotto per aprire i database di spionaggio:_`;

    let buttonsConfig = [
        { 
            name: "cta_url", 
            buttonParamsJson: JSON.stringify({ display_text: "🔎 Cerca Profili Social", url: urlSocial, merchant_url: urlSocial }) 
        },
        { 
            name: "cta_url", 
            buttonParamsJson: JSON.stringify({ display_text: "🌐 Google Deep Search", url: urlGoogle, merchant_url: urlGoogle }) 
        },
        { 
            name: "cta_url", 
            buttonParamsJson: JSON.stringify({ display_text: "📧 Verifica Mail & Leak", url: urlBreach, merchant_url: urlBreach }) 
        }
    ];

    let messageContent = {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: bodyText },
                    footer: { text: "Zeno Intelligence Systems ⚙️" },
                    nativeFlowMessage: {
                        buttons: buttonsConfig
                    }
                }
            }
        }
    };

    return await conn.relayMessage(jid, messageContent, { quoted: m });
};

handler.help = ['osint <nome>'];
handler.tags = ['creatore']; // Spostato sotto la categoria Creatore!
handler.command = /^(osint|investiga|traccia)$/i;

export default handler;
