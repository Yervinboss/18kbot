module.exports = {
    name: 'aperto',
    aliases: ['apri', 'unlock'],
    category: 'admin',
    description: 'Riapre il gruppo (Solo Admin)',
    async execute(sock, m) {
        const chatId = m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) return;

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            // Mappa corretta degli admin normali e superadmin
            const groupAdmins = participants.filter(p => p.admin).map(p => p.id);

            // Estrae il JID pulito del mittente (corretto split sui due punti)
            const sender = m.key.participant || m.participant || m.key.remoteJid;
            const cleanSender = sender.includes(':') ? sender.split(':')[0] + '@s.whatsapp.net' : sender;
            const alternativeSender = sender;

            // Controllo flessibile sugli admin
            const isAdmin = groupAdmins.includes(cleanSender) || groupAdmins.includes(alternativeSender);
            
            if (!isAdmin) {
                await sock.sendMessage(chatId, { text: '❌ Solo gli amministratori possono usare questo comando!' }, { quoted: m });
                return;
            }

            // Cambia le impostazioni: tutti possono scrivere (parametro corretto al singolare)
            await sock.groupSettingUpdate(chatId, 'not_announcement');
            
            await sock.sendMessage(chatId, { 
                text: '🔓 *Gruppo Riaperto!*\nOra tutti i partecipanti possono tornare a scrivere liberamente.' 
            }, { quoted: m });

        } catch (error) {
            console.error('Errore comando aperto:', error);
            await sock.sendMessage(chatId, { text: '❌ Si è verificato un errore durante la riapertura del gruppo.' }, { quoted: m });
        }
    }
};

