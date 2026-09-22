const ALL_COMMANDS = {
    'CREATORE': ['clear', 'shutdown', 'addmoney', 'creatorilist', 'addcreatore', 'delcreatore', 'osint', 'setbotpp', 'setmenu', 'delmenu'],
    'MODERAZIONE': ['p', 'd', 'tag', 'kick', 'warn', 'unwarn', 'aperto', 'chiuso', 'mute', 'unmute', 'antilink', 'antispam', 'antivoip', 'req', 'link', 'setgrouppp', 'soloadmin', 'sterminio'],
    'MEDIA': ['song', 'pl', 'tp', 'toaudio', 'tts', 'shazam', 's', 'gif', 'ss'],
    'STRUMENTI': ['voip', 'tpnumero'],
    'DIVERTENTI': ['palla', 'cazzo', 'frocio', 'negro', 'ban', 'sex', 'dox'],
    'GIOCHI': ['work', 'bal', 'ruba', 'slot', 'bj', 'sposa', 'divorzio'],
    'ALTRO': ['ping', 'id']
};

let handler = async (m, { conn, usedPrefix }) => {
    let prefix = usedPrefix || '.';
    let text = `『 ⚡ *Z E N O   B O T   M E N U   C O M P L E T O* ⚡ 』\n\n`;
    for (let cat in ALL_COMMANDS) {
        text += `📂 *-- ${cat} --*\n`;
        ALL_COMMANDS[cat].forEach(cmd => {
            text += `🔹 ${prefix}${cmd}\n`;
        });
        text += `\n`;
    }
    await conn.sendMessage(m.chat, { text }, { quoted: m });
};

handler.help = ['menu_completo'];
handler.tags = ['menu'];
handler.command = /^(menu_completo)$/i;

export default handler;
