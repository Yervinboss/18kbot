const fs = require('fs');
const path = require('path');
const menuConfigPath = path.join(__dirname, '../menu_config.json');

module.exports = {
    name: 'menu',
    description: 'Displays the premium aesthetic 18K system menu',
    async execute(sock, m, args) {
        const chatId = m.key.remoteJid;
        const totalCommands = sock.commands.size;

        let menuData = {
            caption: `⚡ ─── ❖ *18K // BOT SYSTEM* ❖ ─── ⚡\n\n` +
                     `👑 *CREATOR:* Zeno\n` +
                     `🤖 *SYSTEM:* 18K Premium\n` +
                     `⚙️ *MODULES:* ${totalCommands} Commands Loaded\n` +
                     `🌌 ────────────────────── 🌌\n\n` +

                     `🌸 ─── [ *MEDIA & DOWNLOADS* ] ─── 🌸\n` +
                     `▫️ \`.song\` ➜ Download track audio\n` +
                     `▫️ \`.lyrics\` ➜ Search song lyrics\n` +
                     `▫️ \`.s\` ➜ Convert media to sticker\n` +
                     `🌌 ────────────────────── 🌌\n\n` +

                     `🛡️ ─── [ *SECURITY & GROUPS* ] ─── 🛡️\n` +
                     `▫️ \`.mute\` ➜ Silence a toxic user instantly\n` +
                     `▫️ \`.unmute\` ➜ Lift the mute restriction\n` +
                     `▫️ \`.tag\` ➜ Tag all members in the group\n` +
                     `▫️ \`.soloadmin\` ➜ Restrict bot access to admins\n` +
                     `▫️ \`.antilink\` ➜ Control and block group links\n` +
                     `▫️ \`.antispam\` ➜ Limit fast messaging abuse\n` +
                     `▫️ \`.promuovi\` ➜ Grant admin rights to someone\n` +
                     `▫️ \`.demuovi\` ➜ Remove admin rights from a user\n` +
                     `▫️ \`.kick\` ➜ Remove an abusive user immediately\n` +
                     `▫️ \`.chiuso\` ➜ Lock the group chat for admins\n` +
                     `▫️ \`.aperto\` ➜ Unlock group chat for everyone\n` +
                     `▫️ \`.warn\` ➜ Give an official strike to a user\n` +
                     `▫️ \`.unwarn\` ➜ Clear warning strikes from a user\n` +
                     `🌌 ────────────────────── 🌌\n\n` +

                     `💵 ─── [ *ECONOMY & GAMES* ] ─── 💵\n` +
                     `▫️ \`.slot\` ➜ Try your luck on the slot machine\n` +
                     `▫️ \`.work\` ➜ Work to earn coins and level up\n` +
                     `▫️ \`.daily\` ➜ Claim your 24h free reward cash\n` +
                     `▫️ \`.trade\` ➜ Transfer money replying to a friend\n` +
                     `🌌 ────────────────────── 🌌\n\n` +

                     `🎮 ─── [ *ADULT & FUN (18+)* ] ─── 🎮\n` +
                     `▫️ \`.sex\` ➜ Interactive fun action command\n` +
                     `▫️ \`.sega\` ➜ Interactive fun action command\n` +
                     `▫️ \`.ditalino\` ➜ Interactive fun action command\n` +
                     `▫️ \`.palla\` ➜ Ask the magic 8-ball a question\n` +
                     `▫️ \`.kiss\` ➜ Send a romantic kiss to a member\n` +
                     `▫️ \`.pp\` ➜ Display a random anime profile photo\n` +
                     `🌌 ────────────────────── 🌌\n\n` +

                     `📝 ─── [ *UTILITY & INFO* ] ─── 📝\n` +
                     `▫️ \`.id\` ➜ Check current chat or user unique ID\n` +
                     `▫️ \`.ib\` ➜ Fetch bot technical specs and info\n` +
                     `▫️ \`.ping\` ➜ Test bot server latency speed\n` +
                     `🌌 ────────────────────── 🌌\n\n` +

                     `👑 ─── [ *OWNER MODULE* ] ─── 👑\n` +
                     `▫️ \`.menu\` ➜ Open this system command list\n` +
                     `▫️ \`.setmenu\` ➜ Change bot menu display options\n` +
                     `▫️ \`.block\` ➜ Blacklist a user from bot access\n` +
                     `▫️ \`.unblock\` ➜ Remove a user from the blacklist\n` +
                     `▫️ \`.leave\` ➜ Force the bot to leave the group\n` +
                     `▫️ \`.shutdown\` ➜ Terminate and stop bot process\n` +
                     `🌌 ────────────────────── 🌌\n\n` +
                     `✨ *18K by Zeno* ✨`,
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
                    await sock.sendMessage(chatId, {
                        video: { url: menuData.image },
                        caption: menuData.caption,
                        gifPlayback: true
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: menuData.image },
                        caption: menuData.caption
                    }, { quoted: m });
                }
            } catch (err) {
                console.error("Errore nell'invio del media del menu:", err);
                await sock.sendMessage(chatId, { text: menuData.caption }, { quoted: m });
            }
        } else {
            await sock.sendMessage(chatId, { text: menuData.caption }, { quoted: m });
        }
    }
};

