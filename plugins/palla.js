let handler = async (m, { conn, text }) => {
    let jid = m.key.remoteJid;
    if (!text) return await conn.sendMessage(jid, { text: '🔮 *PALLA ZENO* 🔮\n\n❌ Fammi una domanda dopo il comando!\nEsempio: \`.palla oggi c\'è il sole?\`' }, { quoted: m });

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    // Risposte secche, pulite e classiche richieste
    const risposte = [
        'Sì.',
        'No.',
        'Molto probabilmente.',
        'Forse.',
        'Non credo.',
        'Assolutamente sì.',
        'Scordatelo.',
        'Riprova più tardi.'
    ];

    let finale = risposte[Math.floor(Math.random() * risposte.length)];
    
    await conn.sendMessage(jid, { react: { text: '🔮', key: m.key } });
    return await conn.sendMessage(jid, { text: `🔮 *PALLA ZENO* 🔮\n\n❓ *Domanda:* _${text}_\n\n👉 *Risposta:* *${finale}*` }, { quoted: m });
};

handler.help = ['palla <testo>'];
handler.tags = ['fun'];
handler.command = /^(palla)$/i;

export default handler;
