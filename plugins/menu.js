const fs = require('fs');
const path = require('path');

const menuConfigPath = path.join(__dirname, '../menu_config.json');

module.exports = {
    name: 'menu',
    description: 'Mostra il menù ufficiale di 18K',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;

        let menuData = {
            caption: `⚡ *— 18K // BOT SYSTEM —* ⚡ \n\n` +
                     `*Creator:* Zeno\n` +
                     `*Bot:* 18K\n\n` +
                     
                     `🌸 *[ MEDIA & DOWNLOADS ]* \n` +
                     `• \.song <titolo>\n` +
                     `• \.lyrics <titolo>\n` +
                     `• \.s \n\n` +
                     
                     `🌸 *[ UTILITY & INFO ]* \n` +
                     `• \.id\n` +
                     `• \.ib\n` +
                     `• \.ping\n\n` +
                     
                     `🌸 *[ GROUPS ]* \n` +
                     `• \.promuovi @utente\n` +
                     `• \.demuovi @utente\n` +
                     `• \.kick @utente\n` +
                     `• \.tag <messaggio>\n` +
                     `• \.chiuso\n` +
                     `• \.aperto\n` +
                     `• \.warn\n` +
                     `• \.unwarn\n\n` +
                     
                     `🌸 *[ INTERACTIVE & FUN ]* \n` +
                     `• \.palla\n` +
                     `• \.kiss @utente\n` +
                     `• \.pp\n\n` +
                     
                     `🌸 *[ OWNER & CONFIGURATION ]* \n` +
                     `• \.menu\n` +
                     `• \.setmenu\n` +
                     `• \.block\n` +
                     `• \.unblock\n` +
                     `• \.leave\n` +
                     `• \.shutdown\n\n` +
                     `*18K by Zeno*`,
            image: null,
            isVideo: false
        };

        if (fs.existsSync(menuConfigPath)) {
            try {
                const saved = JSON.parse(fs.readFileSync(menuConfigPath, 'utf8'));
                if (saved.caption) menuData.caption = saved.caption;
                if (saved.image) menuData.image = saved.image;
                if (saved.isVideo !== undefined) menuData.isVideo = saved.isVideo;
            } catch (e) {
                console.error("Errore lettura menu_config:", e.message);
            }
        }

        if (menuData.image && fs.existsSync(menuData.image)) {
            try {
                if (menuData.isVideo) {
                    await sock.sendMessage(sender, {
                        video: { url: menuData.image },
                        caption: menuData.caption,
                        gifPlayback: true
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(sender, {
                        image: { url: menuData.image },
                        caption: menuData.caption
                    }, { quoted: m });
                }
            } catch (err) {
                console.error("Errore nell'invio del media del menu:", err);
                await sock.sendMessage(sender, { text: menuData.caption }, { quoted: m });
            }
        } else {
            await sock.sendMessage(sender, { text: menuData.caption }, { quoted: m });
        }
    }
};
