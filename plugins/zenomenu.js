import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuMediaPath = path.join(__dirname, '../database/menu_media.json');

function readMenuMedia() {
    if (!fs.existsSync(menuMediaPath)) return {};
    try { return JSON.parse(fs.readFileSync(menuMediaPath, 'utf8')); } catch (e) { return {}; }
}

let handler = async (m, { conn, text, command }) => {
    let name = m.pushName || 'Utente';
    let chat = m.key.remoteJid;
    let prefix = '.';

    await conn.sendMessage(chat, { react: { text: '🎛️', key: m.key } });

    let cmdDescriptions = {
        clear: 'Svuota la cache e i file temporanei del server', 
        shutdown: 'Spegne il bot e lo mette in nanna', 
        addmoney: 'Regala soldi RPG a un utente specifico', 
        creatorilist: 'Mostra la lista completa dei proprietari bot',
        addcreatore: 'Aggiunge un nuovo owner autorizzato',
        delcreatore: 'Rimuove un owner autorizzato',
        osint: 'Database integrato di spionaggio web',
        setbotpp: 'Cambia la foto profilo del bot con un immagine',
        setmenu: 'Imposta una GIF/immagine personalizzata per il menu',
        delmenu: 'Rimuove la GIF personalizzata del menu',
        p: 'Promuove l\'utente taggato ad Amministratore',
        d: 'Retrocede l\'Amministratore taggato a utente semplice',
        tag: 'Tagga tutti i membri del gruppo con messaggio (e media/view once)', 
        kick: 'Caccia un utente dal gruppo con effetto immediato', 
        warn: 'Assegna un richiamo ufficiale (3 richiami = Kick)', 
        unwarn: 'Rimuove un richiamo ufficiale dall\'utente',
        aperto: 'Apre il gruppo a tutti i partecipanti', 
        chiuso: 'Chiude il gruppo (Solo gli Admin scrivono)', 
        mute: 'Silenzia un utente specifico nel gruppo', 
        unmute: 'Riapre il microfono all\'utente silenziato',
        antilink: 'Attiva/Disattiva il blocco automatico dei link',
        antispam: 'Attiva/Disattiva il blocco anti-messaggi a raffica',
        antivoip: 'Rileva i numeri non italiani (+39) e permette di buttarli fuori',
        req: 'Gestione e filtro anti-raid per le richieste di ingresso',
        link: 'Invia il link d\'invito ufficiale del gruppo',
        setgrouppp: 'Modifica la foto profilo del gruppo corrente',
        soloadmin: 'Attiva/disattiva la modalità "solo admin" nel gruppo',
        song: 'Scarica tracce musicali e file da YouTube', 
        pl: 'Gestisce e riproduce la playlist musicale',
        tp: 'Cerca un brano su YouTube e lo invia come vocale',
        toaudio: 'Converti video in nota vocale Opus nativa',
        tts: 'Converte il testo in un vocale audio pulito',
        shazam: 'Riconosce il titolo e l\'artista di un brano musicale',
        s: 'Crea uno sticker personalizzato al volo da media', 
        gif: 'Cerca e invia GIF animate in loop',
        ss: 'Cattura e invia lo screenshot istantaneo di un URL web',
        voip: 'Numeri temporanei online per ricevere SMS (no WhatsApp)',
        tpnumero: 'Analizza un numero: info, paese, link ai social',
        palla: 'Interroga l\'oracolo magico con una domanda',
        cazzo: 'Misura il pisello con verdetto random', 
        frocio: 'Calcola la percentuale reale di livello frocio',
        negro: 'Calcola la percentuale reale di livello negro',
        ban: 'Finto ban scenografico di rete su WhatsApp', 
        sex: 'Finto assalto meme in chat', 
        dox: 'Finto dox di rete con dati inventati al momento',
        sterminio: 'Kick-all scenografico con frasi epiche e link portale',
        work: 'Lavora per guadagnare soldi RPG nel database', 
        bal: 'Controlla il portafoglio e i tuoi risparmi attuali', 
        ruba: 'Tenta un furto di soldi RPG a un amico', 
        slot: 'Scommetti i tuoi risparmi alla slot del casinò', 
        bj: 'Gioca a Blackjack scommettendo contro il banco',
        sposa: 'Sposa ufficialmente un utente del gruppo',
        divorzio: 'Annulla il matrimonio e divorzia dal partner',
        ping: 'Testa la velocità di risposta reale del bot', 
        id: 'Mostra l\'ID numerico della chat o del gruppo'
    };

    let categories = {
        creatore: ['clear', 'shutdown', 'addmoney', 'creatorilist', 'addcreatore', 'delcreatore', 'osint', 'setbotpp', 'setmenu', 'delmenu'],
        moderazione: ['p', 'd', 'tag', 'kick', 'warn', 'unwarn', 'aperto', 'chiuso', 'mute', 'unmute', 'antilink', 'antispam', 'antivoip', 'req', 'link', 'setgrouppp', 'soloadmin', 'sterminio'],
        media: ['song', 'pl', 'tp', 'toaudio', 'tts', 'shazam', 's', 'gif', 'ss'],
        strumenti: ['voip', 'tpnumero'],
        divertenti: ['palla', 'cazzo', 'frocio', 'negro', 'ban', 'sex', 'dox'],
        giochi: ['work', 'bal', 'ruba', 'slot', 'bj', 'sposa', 'divorzio'],
        altro: ['ping', 'id']
    };

    let msgText = text || m.text || '';
    let mMsg = m.message || m.msg || {};
    
    if (mMsg.listResponseMessage?.singleSelectReply?.selectedRowId) {
        msgText = mMsg.listResponseMessage.singleSelectReply.selectedRowId;
    } else if (mMsg.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonReplyValue) {
        try {
            let jsonReply = JSON.parse(mMsg.interactiveResponseMessage.nativeFlowResponseMessage.buttonReplyValue);
            msgText = jsonReply.id || jsonReply.rowId || msgText;
        } catch (e) {}
    }

    let cleanText = msgText.toLowerCase().trim();
    let cmdPuro = command ? command.toLowerCase().trim() : '';
    if (cleanText.startsWith(prefix)) {
        cmdPuro = cleanText.replace(prefix, '').split(' ')[0];
    }

    let matchedCategory = null;
    if (cleanText.includes('cat_creatore') || cmdPuro === 'cat_creatore' || cleanText === 'creatore') matchedCategory = 'creatore';
    else if (cleanText.includes('cat_moderazione') || cmdPuro === 'cat_moderazione' || cleanText === 'moderazione') matchedCategory = 'moderazione';
    else if (cleanText.includes('cat_media') || cmdPuro === 'cat_media' || cleanText === 'media') matchedCategory = 'media';
    else if (cleanText.includes('cat_strumenti') || cmdPuro === 'cat_strumenti' || cleanText === 'strumenti') matchedCategory = 'strumenti';
    else if (cleanText.includes('cat_divertenti') || cmdPuro === 'cat_divertenti' || cleanText === 'divertenti') matchedCategory = 'divertenti';
    else if (cleanText.includes('cat_giochi') || cmdPuro === 'cat_giochi' || cleanText === 'giochi') matchedCategory = 'giochi';
    else if (cleanText.includes('cat_altro') || cmdPuro === 'cat_altro' || cleanText === 'altro') matchedCategory = 'altro';

    let isHomeRequest = (cmdPuro === 'menu' || cmdPuro === 'help') && (!matchedCategory || cleanText === '.menu' || cleanText === 'menu');

    // Carica eventuale media personalizzato (.setmenu)
    let menuMedia = readMenuMedia();
    let hasCustomMedia = menuMedia.filePath && fs.existsSync(menuMedia.filePath);
    let mediaBuffer = null;
    let mediaType = null;

    if (hasCustomMedia) {
        try {
            mediaBuffer = fs.readFileSync(menuMedia.filePath);
            mediaType = menuMedia.type;
        } catch (e) {
            console.error('[MENU] Errore lettura media custom:', e);
        }
    }

    // ============ GESTIONE MENU COMPLETO ============
    if (cleanText === 'menu_completo' || cmdPuro === 'menu_completo') {
        let fullText = `『 ⚡ *Z E N O   B O T   M E N U   C O M P L E T O* ⚡ 』\n\n`;
        
        for (let cat in categories) {
            fullText += `📂 *-- ${cat.toUpperCase()} --*\n`;
            for (let cmd of categories[cat]) {
                fullText += `🔹 ${prefix}${cmd} : ${cmdDescriptions[cmd] || 'Nessuna descrizione'}\n`;
            }
            fullText += `\n`;
        }

        if (mediaBuffer && mediaType) {
            try {
                let mediaMessage = mediaType === 'video'
                    ? { video: mediaBuffer, gifPlayback: true, caption: fullText }
                    : { image: mediaBuffer, caption: fullText };
                return await conn.sendMessage(chat, mediaMessage, { quoted: m });
            } catch (e) {
                console.error('[MENU] Errore invio media completo, fallback testo:', e.message);
            }
        }
        return await conn.sendMessage(chat, { text: fullText }, { quoted: m });
    }

    // ============ SOTTOMENU CATEGORIA ============
    if (matchedCategory && !isHomeRequest) {
        let listCmds = categories[matchedCategory].map(cmd => {
            return `🔹 ${prefix}${cmd}\n  └ ${cmdDescriptions[cmd] || 'Nessuna descrizione disponibile'}\n`;
        }).join('\n');

        let categoryText = `⚡ *MENU ${matchedCategory.toUpperCase()}* ⚡\n\n${listCmds}\n🎛️ _Tocca il pulsante qui sotto per tornare alla tendina principale:_`;
        
        let buttons = [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🏠 Torna alla Home', id: '.menu' }) }
        ];

        let interactiveMessage = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text: categoryText },
                        footer: { text: `Zeno Bot • Categoria ${matchedCategory}` },
                        nativeFlowMessage: { buttons: buttons }
                    }
                }
            }
        };

        return await conn.relayMessage(chat, interactiveMessage, { quoted: m }).catch(async () => {
            return await conn.sendMessage(chat, { text: categoryText }, { quoted: m });
        });
    } else {
        // ============ MENU HOME ============
        let sections = [
            {
                title: "📂 Categorie del Bot",
                rows: [
                    { title: "👑 Creatore", rowId: ".menu cat_creatore", description: "Comandi di gestione avanzata e proprietà" },
                    { title: "🛡️ Moderazione", rowId: ".menu cat_moderazione", description: "Gestione gruppi, kick, mute e sicurezza" },
                    { title: "🎵 Media", rowId: ".menu cat_media", description: "Download, audio, sticker e strumenti web" },
                    { title: "🛠️ Strumenti", rowId: ".menu cat_strumenti", description: "Numeri temporanei, analisi numeri e utility" },
                    { title: "🎯 Divertenti", rowId: ".menu cat_divertenti", description: "Comandi fun, meme e cazzeggio" },
                    { title: "🎮 Giochi", rowId: ".menu cat_giochi", description: "Economia RPG, scommesse e casinò" },
                    { title: "⚙️ Altro", rowId: ".menu cat_altro", description: "Ping, ID e informazioni generali" },
                    { title: "📜 Menu Completo", rowId: "menu_completo", description: "Visualizza tutti i comandi in un unico elenco" }
                ]
            }
        ];

        let homeText = `『 ⚡ *Z E N O   B O T   M U L T I - D E V I C E* ⚡ 』\n\n👋 Ciao *${name}*!\nPannello di controllo attivo.\n\n🟢 *Stato:* Online & Stabile\n📌 *Prefisso:* [ *${prefix}* ]\n\n🎛️ _Tocca il pulsante qui sotto per aprire il menu a tendina o scegliere il menu completo:_`;

        let listMessage = {
            text: homeText,
            footer: "Zeno Bot • Pannello Principale",
            title: "📜 Seleziona Modalità",
            buttonText: "📜 Apri Menu",
            sections
        };

        if (mediaBuffer && mediaType) {
            if (mediaType === 'image') listMessage.image = mediaBuffer;
            if (mediaType === 'video') {
                listMessage.video = mediaBuffer;
                listMessage.gifPlayback = true;
            }
        }

        return await conn.sendMessage(chat, listMessage, { quoted: m });
    }
};

handler.help = ['menu'];
handler.tags = ['main'];
handler.command = /^(menu|help|cat_creatore|cat_moderazione|cat_media|cat_strumenti|cat_divertenti|cat_giochi|cat_altro|menu_completo)$/i;

handler.all = async function (m, { conn }) {
    if (m.isBaileys || !m.message) return;

    let rowId = '';
    if (m.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
        rowId = m.message.listResponseMessage.singleSelectReply.selectedRowId;
    } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonReplyValue) {
        try {
            let jsonReply = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.buttonReplyValue);
            rowId = jsonReply.id || jsonReply.rowId || '';
        } catch (e) {}
    }

    if (rowId && (rowId.startsWith('.menu') || rowId === 'menu_completo')) {
        let cleanCmd = rowId.replace('.', '');
        let parts = cleanCmd.split(' ');
        let arg = parts.slice(1).join(' ');
        let cmdName = parts[0];
        
        m.sender = m.key.fromMe ? m.key.remoteJid : (m.key.participant || m.participant || m.key.remoteJid);
        
        return await handler(m, { conn, text: arg, command: cmdName });
    }
};

export default handler;
