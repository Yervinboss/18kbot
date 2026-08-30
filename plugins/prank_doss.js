function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;
    let senderId = pureId(m.key.participant || m.key.remoteJid);

    // Estrattore bersaglio blindato anti-autotag
    let who = false;
    if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        who = m.message.extendedTextMessage.contextInfo.participant;
    } else if (m.quoted && m.quoted.sender) {
        who = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid.length > 0) {
        who = m.mentionedJid;
    }

    let targetId = who ? pureId(who) : senderId;

    await conn.sendMessage(jid, { react: { text: '💉', key: m.key } });

    // 🚀 L ATTACCO CON I PACCHETTI FINTI A CASCATA
    let msg = await conn.sendMessage(jid, { text: `🛰️ [ZENO GUARD]: Acquisizione IP in corso su @${targetId}...`, mentions: [targetId + '@s.whatsapp.net'] }, { quoted: m });
    await delay(1200);

    msg = await conn.sendMessage(jid, { text: `💉 [RADAR NETWORK]: Protocollo DOSS forzato in attivazione...` }, { quoted: msg });
    await delay(1200);

    msg = await conn.sendMessage(jid, { text: `📦 [PACKETS]: Inondazione UDP Flood avviata.\n🔥 Inviando: 4096 kb/s -> @${targetId}\n🎛️ Stato porte: OVERLOAD (Saturazione)`, mentions: [targetId + '@s.whatsapp.net'] }, { quoted: msg });
    await delay(1500);

    msg = await conn.sendMessage(jid, { text: `⚠️ [AVVISO DETECTED]: Sincronizzazione hardware fallita. Stai per andare giu random.` }, { quoted: msg });
    await delay(1500);

    msg = await conn.sendMessage(jid, { text: `🔴 *3...*` }, { quoted: msg });
    await delay(1000);

    msg = await conn.sendMessage(jid, { text: `⚠️ *2...*` }, { quoted: msg });
    await delay(1000);

    msg = await conn.sendMessage(jid, { text: `💀 *1...*` }, { quoted: msg });
    await delay(1000);

    // 💥 VERDETTO FINALE CON SCHEDA INTERATTIVA E BOTTONE LINK FALSO
    let bodyText = `💥 *CONNESSIONE REELETTA CON SUCCESSO!* 💥\n\n` +
                   `❌ Indirizzo hardware di @${targetId} rimosso dai nodi di instradamento della cella.\n` +
                   `Dispositivo scollegato permanentemente. 🔌\n\n` +
                   `😈 🔒 *RECOVERY TERMINAL:* Per verificare i log estratti, tracciare i tuoi dati o tentare il ripristino manuale dei pacchetti di rete, clicca sul link di sblocco qui sotto:`;

    let targetUrl = 'https://files.catbox.moe/fx9n8k.mp4';
    
    let buttonsConfig = [
        { 
            name: "cta_url", 
            buttonParamsJson: JSON.stringify({ 
                display_text: "🔗 Sblocca Linea & Vedi Dati 🔓 💀", 
                url: targetUrl, 
                merchant_url: targetUrl 
            }) 
        }
    ];

    let messageContent = {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: bodyText },
                    footer: { text: "Zeno Cyber-Security Infrastructure ⚙️" },
                    nativeFlowMessage: {
                        buttons: buttonsConfig
                    },
                    contextInfo: { mentionedJid: [targetId + '@s.whatsapp.net'] }
                }
            }
        }
    };

    return await conn.relayMessage(jid, messageContent, { quoted: msg });
};

handler.help = ['doss @tag'];
handler.tags = ['fun'];
handler.command = /^(doss|ddos|dossattacco)$/i;

export default handler;
