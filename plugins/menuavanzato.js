let handler = async (m, { conn }) => {
    let jid = m.key.remoteJid;

    let sections = [
        {
            title: "🎵 Musica & Download",
            rows: [
                { title: "▶️ Riproduci Playlist", rowId: ".pl", description: "Ascolta i brani salvati nella tua playlist personale" },
                { title: "🎧 Shazam Music", rowId: ".shazam", description: "Riconosci un brano musicale rispondendo a un audio o video" }
            ]
        },
        {
            title: "🛠️ Utility & Strumenti",
            rows: [
                { title: "🏓 Stato del Bot", rowId: ".ping", description: "Verifica se il bot è online e controlla la reattività" },
                { title: "📋 Lista Plugin", rowId: ".plugins", description: "Visualizza tutti i moduli e comandi caricati nel sistema" }
            ]
        },
        {
            title: "⚙️ Gestione Gruppo",
            rows: [
                { title: "🔒 Solo Admin", rowId: ".soloadmin", description: "Attiva o disattiva la modalità solo amministratori" }
            ]
        }
    ];

    let listMessage = {
        text: "✨ *Zeno Bot - Centro di Controllo*\n\nUsa il menu a tendina qui sotto per esplorare rapidamente le funzioni principali del bot:",
        footer: "Zeno Bot • Interfaccia Avanzata",
        title: "📂 Menu Principale",
        buttonText: "📜 Apri Menu",
        sections
    };

    await conn.sendMessage(jid, listMessage, { quoted: m });
};

handler.command = /^(menuavanzato|panel|dashboard)$/i;
handler.help = ['menuavanzato'];
handler.tags = ['main'];

export default handler;
