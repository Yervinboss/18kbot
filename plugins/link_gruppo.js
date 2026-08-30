import QRCode from 'qrcode';
import { isOwner } from './owner.js';

function pureId(jid) {
    if (!jid) return '';
    return jid.replace(/[^0-9]/g, '');
}

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) {
        return false;
    }
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    let sender = m.key.participant || m.key.remoteJid;
    let isGroup = jid.endsWith('@g.us');

    if (!isGroup) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo all\'interno di un gruppo!' }, { quoted: m });
    }

    let isCmdOwner = isOwner(sender);
    let isCmdAdmin = await isAdmin(conn, jid, sender);

    if (!isCmdOwner && !isCmdAdmin) {
        return await conn.sendMessage(jid, { text: '❌ Solo i creatori del bot o gli amministratori del gruppo possono usare questo comando.' }, { quoted: m });
    }

    // ESTRAZIONE ANTECEDENTE SICURA: Spostata in cima per evitare conflitti logici
    let cmd = String(command || '').toLowerCase().trim();

    await conn.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
        let code = await conn.groupInviteCode(jid);
        if (!code) throw new Error('Codice di invito nullo da WhatsApp');

        let cleanCode = String(code).replace(/[^a-zA-Z0-9]/g, '').trim();
        let groupLink = `https://chat.whatsapp.com/${cleanCode}`;

        await conn.sendMessage(jid, { react: { text: '✅', key: m.key } });

        if (cmd === 'link' || cmd === 'invito') {
            let txt = `🔗 *LINK DI INVITO UFFICIALE*\n\nEcco il link per entrare in questo gruppo:\n${groupLink}`;
            return await conn.sendMessage(jid, { text: txt }, { quoted: m });
        }

        if (cmd === 'qr' || cmd === 'qrlink') {
            // Genera una matrice QR totalmente nuova e pulita ad alto contrasto
            let qrBuffer = await QRCode.toBuffer(groupLink, { 
                type: 'png', 
                margin: 4, 
                scale: 10,
                errorCorrectionLevel: 'H',
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            
            return await conn.sendMessage(jid, {
                image: qrBuffer,
                caption: `📸 *QR CODE DEL GRUPPO NATIVO*\n\nScansiona questa immagine con la fotocamera dello schermo per entrare!\n\n🔗 Link di testo cliccabile:\n${groupLink}`
            }, { quoted: m });
        }

    } catch (e) {
        console.error('Errore generazione link/QR:', e);
        await conn.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return await conn.sendMessage(jid, { text: '❌ Errore: Assicurati che Zeno Bot sia *Amministratore* del gruppo!' }, { quoted: m });
    }
};

handler.help = ['link', 'qr'];
handler.tags = ['group'];
handler.command = /^(link|invito|qr|qrlink)$/i;

export default handler;
