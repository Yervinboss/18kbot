import fs from 'fs';
import path from 'path';
import { isOwner } from './owner.js';

const dbPath = path.resolve('database/antinuke.json');

function getDB() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify([]));
    }
    try {
        let data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function pureId(jid) { return jid ? jid.replace(/[^0-9]/g, '') : ''; }

async function isAdmin(conn, jid, sender) {
    try {
        let groupMetadata = await conn.groupMetadata(jid);
        let participants = groupMetadata.participants;
        let senderPure = pureId(sender);
        return !!participants.find(p => pureId(p.id) === senderPure && p.admin);
    } catch (e) { return false; }
}

let handler = async (m, { conn, command }) => {
    let jid = m.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return await conn.sendMessage(jid, { text: '❌ Questo comando può essere usato solo nei gruppi!' }, { quoted: m });
    }

    let sender = m.key.participant || m.key.remoteJid;

    // 🔒 CONTROLLO DI SICUREZZA: Solo l'Owner o gli admin possono configurare lo scudo di Zeno
    if (!isOwner(sender) && !(await isAdmin(conn, jid, sender))) {
        return await conn.sendMessage(jid, { text: '❌ Azione negata! Questo pannello è riservato agli amministratori.' }, { quoted: m });
    }

    let cmd = (command || '').toLowerCase().trim();
    let list = getDB();

    // 🚀 AZIONE BOTTONE 1: ACCENSIONE ANTINUKE
    if (cmd === 'zenon') {
        if (!list.includes(jid)) {
            list.push(jid);
            saveDB(list);
        }
        await conn.sendMessage(jid, { react: { text: '🛡️', key: m.key } });
        return await conn.sendMessage(jid, { text: '🛡️ *SISTEMA ANTI-NUKE ATTIVATO!* 🛡️\n\nLo scudo del Creatore Zeno è ora *ONLINE*.\nQualsiasi tentativo di cacciare membri o admin in massa farà scattare l\'espulsione forzata immediata dell\'attaccante dal gruppo! 💥' }, { quoted: m });
    }

    // 🚀 AZIONE BOTTONE 2: SPEGNIMENTO ANTINUKE
    if (cmd === 'zenooff') {
        list = list.filter(g => g !== jid);
        saveDB(list);
        await conn.sendMessage(jid, { react: { text: '🔓', key: m.key } });
        return await conn.sendMessage(jid, { text: '🔓 *SISTEMA ANTI-NUKE DISATTIVATO.*\nLo scudo di difesa è spento. Le contromisure automatiche sono in pausa.' }, { quoted: m });
    }

    // 🎛️ GENERAZIONE SCHEDA INTERATTIVA DIGITANDO .zeno O .0
    if (cmd === 'zeno' || cmd === '0') {
        let status = list.includes(jid) ? 'ONLINE 🛡️ (Chat Protetta)' : 'DISATTIVATO 🔓 (Nessuno Scudo)';
        
        let bodyText = `『 👑 *Z E N O   S U P R E M E   C O N T R O L* 👑 』\n\n` +
                       `🛡️ *Sistema Anti-Nuke & Raid Core*\n` +
                       `📊 *Stato Attuale:* *${status}*\n\n` +
                       `_Usa i bottoni qui sotto per accendere o spegnere lo scudo protettivo del bot:_`;

        let buttonsConfig = [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🛡️ Attiva Scudo", id: `.zenon` }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔓 Disattiva", id: `.zenooff` }) }
        ];

        let messageContent = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text: bodyText },
                        footer: { text: "Zeno Guard Infrastructure ⚙️" },
                        nativeFlowMessage: {
                            buttons: buttonsConfig
                        }
                    }
                }
            }
        };

        await conn.sendMessage(jid, { react: { text: '👑', key: m.key } });
        return await conn.relayMessage(jid, messageContent, { quoted: m });
    }
};

// ⚡ PROTOCOLLO DI DIFESA ATTIVA IMMORTALE IN BACKGROUND (Killa i raid nemici)
export async function before(m, { conn }) {
    if (!m.messageStubType) return;
    let jid = m.key.remoteJid;
    if (!jid || !jid.endsWith('@g.us')) return;

    let list = getDB();
    if (!list.includes(jid)) return;

    let stubType = m.messageStubType;
    let attore = m.participant || m.key.participant;
    
    if (isOwner(attore) || pureId(attore) === pureId(conn.user.id)) return;

    if (stubType === 28 || stubType === 32 || stubType === 30) {
        let attoreJid = pureId(attore) + '@s.whatsapp.net';
        try {
            await conn.groupParticipantsUpdate(jid, [attoreJid], 'remove');
            await conn.sendMessage(jid, { 
                text: `🚨 *CONTROFFENSIVA ANTI-NUKE SCATTATA!* 🚨\n\n⚠️ *Rilevato attacco da parte di:* @${pureId(attore)}\n🛡️ *Azione Bot:* Rimozione immediata.\n\n❌ L'attaccante è stato cacciato all'istante da Zeno Bot per blindare il gruppo! 🔨💨`,
                mentions: [attoreJid]
            });
        } catch (e) {
            console.error('Errore difesa:', e.message);
        }
    }
}

handler.help = ['zeno', '0'];
handler.tags = ['creatore'];
handler.command = /^(zeno|0|zenon|zenooff)$/i;

export default handler;
