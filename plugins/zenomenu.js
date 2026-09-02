import fs from 'fs';
import path from 'path';

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
        req: 'Gestione e filtro anti-raid per le richieste di ingresso',
        link: 'Invia il link d\'invito ufficiale del gruppo',
        setgrouppp: 'Modifica la foto profilo del gruppo corrente',
        song: 'Scarica tracce musicali e file da YouTube', 
        pl: 'Gestisce e riproduce la playlist musicale',
        toaudio: 'Converti video in nota vocale Opus nativa',
        tts: 'Converte il testo in un vocale audio pulito',
        shazam: 'Riconosce il titolo e l\'artista di un brano musicale',
        s: 'Crea uno sticker personalizzato al volo da media', 
        gif: 'Cerca e invia GIF animate in loop',
        ss: 'Cattura e invia lo screenshot istantaneo di un URL web',
        palla: 'Interroga l\'oracolo magico con una domanda',
        cazzo: 'Misura il pisello con verdetto random', 
        frocio: 'Calcola la percentuale reale di livello frocio',
        negro: 'Calcola la percentuale reale di livello negro',
        ban: 'Finto ban scenografico di rete su WhatsApp', 
        sex: 'Finto assalto meme in chat', 
        dox: 'Finto dox di rete con dati inventati al momento',
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
        creatore: ['clear', 'shutdown', 'addmoney', 'creatorilist', 'addcreatore', 'delcreatore', 'osint', 'setbotpp'],
        moderazione: ['p', 'd', 'tag', 'kick', 'warn', 'unwarn', 'aperto', 'chiuso', 'mute', 'unmute', 'antilink', 'antispam', 'req', 'link', 'setgrouppp'],
        media: ['song', 'pl', 'toaudio', 'tts', 'shazam', 's', 'gif', 'ss'],
        divertenti: ['palla', 'cazzo', 'frocio', 'negro', 'ban', 'sex', 'dox'],
        giochi: ['work', 'bal', 'ruba', 'slot', 'bj', 'sposa', 'divorzio'],
        altro: [ 'ping', 'id']
    };

    let msgText = text || m.text || '';
    let mMsg = m.message || m.msg || {};
    
    if (mMsg.buttonsResponseMessage) {
        msgText = mMsg.buttonsResponseMessage.selectedButtonId;
    } else if (mMsg.templateButtonReplyMessage) {
        msgText = mMsg.templateButtonReplyMessage.selectedId;
    } else if (mMsg.interactiveResponseMessage) {
        let nativeResponse = mMsg.interactiveResponseMessage.nativeFlowResponseMessage;
        if (nativeResponse && nativeResponse.paramsJson) {
            try {
                let parsed = JSON.parse(nativeResponse.paramsJson);
                msgText = parsed.id || msgText;
            } catch (e) {}
        }
    }
    
    if (!msgText && m.text) msgText = m.text;

    let cleanText = msgText.toLowerCase().trim();
    let cmdPuro = command ? command.toLowerCase().trim() : '';
    if (cleanText.startsWith(prefix)) {
        cmdPuro = cleanText.replace(prefix, '').split(' ')[0];
    }

    let matchedCategory = null;
    if (cleanText.includes('creatore') || cmdPuro === 'creatore') matchedCategory = 'creatore';
    else if (cleanText.includes('mod') || cleanText.includes('moderazione') || cmdPuro === 'moderazione') matchedCategory = 'moderazione';
    else if (cleanText.includes('media') || cmdPuro === 'media') matchedCategory = 'media';
    else if (cleanText.includes('divertenti') || cmdPuro === 'fun' || cmdPuro === 'divertenti') matchedCategory = 'divertenti';
    else if (cleanText.includes('giochi') || cmdPuro === 'rpg' || cmdPuro === 'giochi') matchedCategory = 'giochi';
    else if (cleanText.includes('altro') || cmdPuro === 'utility' || cmdPuro === 'altro') matchedCategory = 'altro';

    let isHomeRequest = (cmdPuro === 'menu' || cmdPuro === 'help') && (!matchedCategory || cleanText === '.menu' || cleanText === 'menu');

    let menuText = '';
    let buttonsConfig = [];

    if (matchedCategory && !isHomeRequest) {
        let listCmds = categories[matchedCategory].map(cmd => {
            return `🔹 ${prefix}${cmd}\n  └ ${cmdDescriptions[cmd] || 'Nessuna descrizione disponibile'}\n`;
        }).join('\n');

        menuText = `⚡ *MENU ${matchedCategory.toUpperCase()}* ⚡\n\n${listCmds}\n🎛️ _Usa il bottone qui sotto per tornare indietro:_`;
        buttonsConfig = [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🏠 Torna alla Home', id: '.menu' }) }
        ];
    } else {
        menuText = `『 ⚡ *Z E N O   B O T   M U L T I - D E V I C E* ⚡ 』\n\n👋 Ciao *${name}*!\nPannello grafico sbloccato al 100%.\n\n🟢 *Stato:* Online & Stabile\n📌 *Prefisso:* [ *${prefix}* ]\n\n🎛️ _Seleziona una categoria dal menù qui sotto:_`;
        
        buttonsConfig = [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "👑 Creatore", id: ".menu creatore" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🛡️ Moderazione", id: ".menu moderazione" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎯 Divertenti", id: ".menu divertenti" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎵 Media", id: ".menu media" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎮 Giochi", id: ".menu giochi" }) }
        ];
    }

    let messageContent = {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: menuText },
                    footer: { text: `⚙️ Powered by Zeno` },
                    nativeFlowMessage: { buttons: buttonsConfig }
                }
            }
        }
    };

    return await conn.relayMessage(chat, messageContent, { quoted: m }).catch(e => console.error(e));
};

handler.help = ['menu'];
handler.tags = ['main'];
handler.command = /^(menu|help|creatore|moderazione|media|divertenti|giochi)$/i;

export default handler;

