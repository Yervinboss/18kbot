import { isOwner } from './owner.js';

// ============================================================
// 🔗 LINK DEL NUOVO PORTALE (default)
// ============================================================
const DEFAULT_PORTAL = 'https://chat.whatsapp.com/LD4KX7ZnXnX7ftBAjRYtAr';

// ============================================================
// 🎨 CARATTERI SPECIALI UNICODE
// ============================================================
const specialChars = {
    a: '𝐚', b: '𝐛', c: '𝐜', d: '𝐝', e: '𝐞', f: '𝐟', g: '𝐠', h: '𝐡', i: '𝐢',
    j: '𝐣', k: '𝐤', l: '𝐥', m: '𝐦', n: '𝐧', o: '𝐨', p: '𝐩', q: '𝐪', r: '𝐫',
    s: '𝐬', t: '𝐭', u: '𝐮', v: '𝐯', w: '𝐰', x: '𝐱', y: '𝐲', z: '𝐳',
    A: '𝐀', B: '𝐁', C: '𝐂', D: '𝐃', E: '𝐄', F: '𝐅', G: '𝐆', H: '𝐇', I: '𝐈',
    J: '𝐉', K: '𝐊', L: '𝐋', M: '𝐌', N: '𝐍', O: '𝐎', P: '𝐏', Q: '𝐐', R: '𝐑',
    S: '𝐒', T: '𝐓', U: '𝐔', V: '𝐕', W: '𝐖', X: '𝐗', Y: '𝐘', Z: '𝐙',
    '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒',
    '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
};

const fancy = (text) => text.split('').map(c => specialChars[c] || c).join('');

// ============================================================
// 💀 FRASI DELLO STERMINIO
// ============================================================
const frasiSterminio = [
    "☠️ 𝐙𝐄𝐍𝐎 𝐄̀ 𝐀𝐑𝐑𝐈𝐕𝐀𝐓𝐎 𝐒𝐔𝐋𝐋𝐀 𝐓𝐄𝐑𝐑𝐀 ☠️",
    "🔥 𝐈𝐥 𝐬𝐮𝐨 𝐩𝐨𝐭𝐞𝐫𝐞 𝐞̀ 𝐢𝐧𝐟𝐢𝐧𝐢𝐭𝐨, 𝐥𝐚 𝐬𝐮𝐚 𝐯𝐨𝐥𝐨𝐧𝐭𝐚̀ 𝐢𝐧𝐟𝐥𝐞𝐬𝐬𝐢𝐛𝐢𝐥𝐞 🔥",
    "💀 𝐄 𝐡𝐚 𝐝𝐞𝐜𝐢𝐬𝐨 𝐝𝐢 𝐬𝐭𝐞𝐫𝐦𝐢𝐧𝐚𝐫𝐞 𝐪𝐮𝐞𝐬𝐭𝐨 𝐩𝐨𝐩𝐨𝐥𝐨 𝐝𝐢 𝐦𝐨𝐫𝐭𝐚𝐥𝐢 💀",
    "⚰️ 𝐋𝐞 𝐯𝐨𝐬𝐭𝐫𝐞 𝐚𝐧𝐢𝐦𝐞 𝐬𝐚𝐫𝐚𝐧𝐧𝐨 𝐝𝐢𝐬𝐩𝐞𝐫𝐬𝐞 𝐧𝐞𝐥 𝐯𝐮𝐨𝐭𝐨 ⚰️",
    "🌑 𝐈𝐥 𝐬𝐢𝐥𝐞𝐧𝐳𝐢𝐨 𝐜𝐚𝐝𝐫𝐚̀ 𝐬𝐮 𝐪𝐮𝐞𝐬𝐭𝐨 𝐠𝐫𝐮𝐩𝐩𝐨 🌑",
    "🩸 𝐍𝐞𝐬𝐬𝐮𝐧𝐨 𝐬𝐚𝐫𝐚̀ 𝐫𝐢𝐬𝐩𝐚𝐫𝐦𝐢𝐚𝐭𝐨 🩸",
    "⛧ 𝐋𝐚 𝐝𝐚𝐧𝐳𝐚 𝐝𝐞𝐥𝐥𝐚 𝐟𝐢𝐧𝐞 𝐞̀ 𝐚𝐩𝐩𝐞𝐧𝐚 𝐢𝐧𝐢𝐳𝐢𝐚𝐭𝐚 ⛧"
];

const fraseFinale = [
    "🕊️ 𝐌𝐀 𝐙𝐄𝐍𝐎, 𝐍𝐄𝐋𝐋𝐀 𝐒𝐔𝐀 𝐌𝐀𝐆𝐍𝐈𝐅𝐈𝐂𝐄𝐍𝐙𝐀, 🕊️",
    "✨ 𝐇𝐀 𝐃𝐄𝐂𝐈𝐒𝐎 𝐃𝐈 𝐃𝐀𝐑𝐄 𝐔𝐍𝐀 𝐒𝐄𝐂𝐎𝐍𝐃𝐀 𝐏𝐎𝐒𝐒𝐈𝐁𝐈𝐋𝐈𝐓𝐀̀ ✨",
    "🚪 𝐔𝐍 𝐍𝐔𝐎𝐕𝐎 𝐏𝐎𝐑𝐓𝐀𝐋𝐄 𝐒𝐈 𝐄̀ 𝐀𝐏𝐄𝐑𝐓𝐎 𝐏𝐄𝐑 𝐕𝐎𝐈 🚪",
    "🔗 𝐄𝐍𝐓𝐑𝐀𝐓𝐄 𝐎 𝐆𝐈𝐀𝐂𝐄𝐓𝐄 𝐍𝐄𝐋𝐋'𝐎𝐁𝐋𝐈𝐎 🔗"
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let handler = async (m, { conn, text, command }) => {
    let chatId = m.key?.remoteJid;

    if (!chatId || !chatId.endsWith('@g.us')) {
        return conn.sendMessage(chatId, { text: '❌ Questo comando funziona solo nei gruppi.' }, { quoted: m });
    }

    let sender = m.key.participant || m.key.remoteJid;

    // Permessi: owner del bot o admin del gruppo
    let isSenderAdmin = false;
    try {
        const meta = await conn.groupMetadata(chatId);
        const senderPure = (sender || '').replace(/[^0-9]/g, '');
        isSenderAdmin = !!meta.participants.find(p => 
            (p.id || '').replace(/[^0-9]/g, '') === senderPure && p.admin
        );
    } catch (e) {}

    if (!isOwner(sender) && !isSenderAdmin) {
        return conn.sendMessage(chatId, { text: '❌ Solo admin del gruppo o owner del bot possono usare questo comando.' }, { quoted: m });
    }

    // Link: usa quello passato o il default
    let groupLink = (text || '').trim();
    if (!groupLink || !groupLink.startsWith('http')) {
        groupLink = DEFAULT_PORTAL;
    }

    let meta;
    try {
        meta = await conn.groupMetadata(chatId);
    } catch (e) {
        return conn.sendMessage(chatId, { text: '❌ Errore lettura gruppo.' }, { quoted: m });
    }

    let botId = (conn.user?.id || '').replace(/[^0-9]/g, '');
    let ownerNumbers = (global.owner || []).map(n => String(n).replace(/[^0-9]/g, ''));

    let toKick = meta.participants.filter(p => {
        let id = (p.id || '').replace(/[^0-9]/g, '');
        if (id === botId) return false;
        if (ownerNumbers.includes(id)) return false;
        if (id === (sender || '').replace(/[^0-9]/g, '')) return false;
        if (p.admin === 'superadmin') return false;
        return true;
    }).map(p => p.id);

    if (toKick.length === 0) {
        return conn.sendMessage(chatId, { text: '⚠️ Nessun membro da sterminare (sono tutti admin o protetti).' }, { quoted: m });
    }

    // 🔥 STERMINIO
    await conn.sendMessage(chatId, { react: { text: '💀', key: m.key } }).catch(() => {});

    // FASE 1: Frasi cattive
    for (let i = 0; i < frasiSterminio.length; i++) {
        await conn.sendMessage(chatId, { text: frasiSterminio[i] }).catch(() => {});
        await sleep(400);
    }

    await sleep(400);

    // FASE 2: Frasi finali
    for (let i = 0; i < fraseFinale.length; i++) {
        await conn.sendMessage(chatId, { text: fraseFinale[i] }).catch(() => {});
        await sleep(400);
    }

    await sleep(300);

    // FASE 3: Link al portale
    await conn.sendMessage(chatId, { 
        text: `╔═══════ ✦ 🚪 ✦ ═══════╗\n\n   🔗 *𝐈𝐋 𝐍𝐔𝐎𝐕𝐎 𝐏𝐎𝐑𝐓𝐀𝐋𝐄* 🔗\n\n${groupLink}\n\n╚═══════ ✦ 🚪 ✦ ═══════╝\n\n_𝐙𝐞𝐧𝐨 𝐯𝐢 𝐚𝐬𝐩𝐞𝐭𝐭𝐚_ 💀`
    }).catch(() => {});

    // FASE 4: Esecuzione + KICK IMMEDIATO
    await conn.sendMessage(chatId, { text: fancy("💥 ESECUZIONE IN CORSO... 💥") }).catch(() => {});
    await sleep(500);

    try {
        await conn.groupParticipantsUpdate(chatId, toKick, 'remove');
    } catch (e) {
        console.error('[STERMINIO] Errore kick:', e);
        await conn.sendMessage(chatId, { text: '⚠️ Errore durante lo sterminio. Assicurati che il bot sia admin.' }).catch(() => {});
    }

    await conn.sendMessage(chatId, { react: { text: '☠️', key: m.key } }).catch(() => {});
};

handler.command = /^(sterminio)$/i;
handler.help = ['sterminio'];
handler.tags = ['owner'];
handler.owner = true;

export default handler;
