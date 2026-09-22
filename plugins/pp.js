function pureId(jid) {
    if (!jid) return '';
    let str = typeof jid === 'object'
        ? (jid.id || jid.remoteJid || String(jid))
        : String(jid);
    // Rimuove eventuale ":device" ma NON il dominio (@lid, @s.whatsapp.net, @g.us)
    return str.split(':')[0];
}

function getNumber(jid) {
    // Solo la parte numerica, per la caption
    if (!jid) return '';
    return String(jid).split('@')[0].split(':')[0];
}

let handler = async (m, { conn }) => {
    console.log('\n========== DEBUG PP START ==========');
    const jid = m.key.remoteJid;

    let who =
        m.mentionedJid?.[0] ||
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        m.quoted?.sender ||
        m.message?.extendedTextMessage?.contextInfo?.participant ||
        m.key.participant ||
        m.key.remoteJid;

    console.log('🎯 who raw:', who);

    // ✅ USO IL JID COSÌ COM'È (mantiene @lid o @s.whatsapp.net)
    const targetJid = pureId(who);
    const targetId = getNumber(targetJid);

    console.log('🎯 targetJid:', targetJid);
    console.log('🎯 targetId (per caption):', targetId);

    if (!targetJid || !targetId) {
        return conn.sendMessage(jid, { text: '❌ Utente non valido.' }, { quoted: m });
    }

    await conn.sendMessage(jid, { react: { text: '📸', key: m.key } });

    let ppUrl = null;
    try {
        console.log('🔎 Tentativo 1: profilePictureUrl(..., "image")');
        ppUrl = await conn.profilePictureUrl(targetJid, 'image');
        console.log('✅ Tentativo 1 OK:', ppUrl);
    } catch (e1) {
        console.log('❌ Tentativo 1 FALLITO:', e1?.message || e1);
        try {
            console.log('🔎 Tentativo 2: profilePictureUrl(..., "preview")');
            ppUrl = await conn.profilePictureUrl(targetJid, 'preview');
            console.log('✅ Tentativo 2 OK:', ppUrl);
        } catch (e2) {
            console.log('❌ Tentativo 2 FALLITO:', e2?.message || e2);
            ppUrl = null;
        }
    }

    if (!ppUrl) {
        console.log('❌ Nessuna foto trovata');
        console.log('========== DEBUG PP END (fail) ==========\n');
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return conn.sendMessage(
            jid,
            { text: '❌ Impossibile recuperare la foto profilo (potrebbe essere nascosta).' },
            { quoted: m }
        );
    }

    try {
        console.log('📤 Invio immagine...');
        await conn.sendMessage(
            jid,
            {
                image: { url: ppUrl },
                caption: `🖼️ *Foto profilo di @${targetId}*`,
                mentions: [targetJid]
            },
            { quoted: m }
        );
        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });
        console.log('✅ Immagine inviata');
        console.log('========== DEBUG PP END (ok) ==========\n');
    } catch (e) {
        console.error('❌ Errore invio immagine:', e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        conn.sendMessage(jid, { text: '❌ Errore invio foto.' }, { quoted: m });
    }
};

handler.help = ['pp [@tag / rispondi]'];
handler.tags = ['tools'];
handler.command = /^pp$/i;

export default handler;
