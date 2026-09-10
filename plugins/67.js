let handler = async (m, { conn }) => {
    await conn.sendMessage(m.chat, { text: 'Numero fortunato: 67 🎲' });
};

handler.command = /^67$/i;
handler.tags = ['divertenti'];
handler.desc = 'Ti manda un messaggio a caso col numero 67';

export default handler;
