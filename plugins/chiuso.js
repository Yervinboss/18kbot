module.exports = {
    name: 'chiuso',
    aliases: ['chiudi', 'lock'],
    category: 'admin',
    description: 'Chiude il gruppo (Solo Admin)',
    async execute(sock, m) {
        const chatId = m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) return;

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            const groupAdmins = participants.filter(p => p.admin).map(p => p.id);

            const sender = m.key.participant || m.participant || m.key.remoteJid;
            const cleanSender = sender.includes(':') ? sender.split(':')[0] + '@s.whatsapp.net' : sender;
            const alternativeSender = sender;

            const isAdmin = groupAdmins.includes(cleanSender) || groupAdmins.includes(alternativeSender);
            
            if (!isAdmin) {
                await sock.sendMessage(chatId, { text: '❌ Solo gli amministratori possono usare questo comando!' }, { quoted: m });
                return;
            }

            // Metodo aggiornato per chiudere il gruppo
            await sock.groupSettingUpdate(chatId, 'announcement');
            
            await sock.sendMessage(chatId, { 
                text: '🔒 *Gruppo Chiuso!*\nDa questo momento solo gli amministratori possono inviare messaggi.' 
            }, { quoted: m });

        } catch (error) {
            console.error('Errore comando chiuso:', error);
            await sock.sendMessage(chatId, { text: `❌ Errore: ${error.message || 'Impossibile chiudere il gruppo'}` }, { quoted: m });
        }
    }
};

