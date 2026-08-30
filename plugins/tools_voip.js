import { fileURLToPath } from 'url';
import path from 'path';

let axios, cheerio;
let ready = false;

try {
  axios = (await import('axios')).default;
  cheerio = await import('cheerio');
  ready = true;
} catch (e) {
  console.error("Librerie axios/cheerio non trovate.");
}

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const sites = [
  'https://receive-sms-online.info',
  'https://receive-smss.com',
  'https://receivesms.co',
  'https://freephonenum.com',
  'https://receive-sms.cc',
  'https://sms-online.co',
  'https://receiveasms.com'
];

const countries = [
  { name: 'USA 🇺🇸', prefix: '+1', id: 'voip_country_0' },
  { name: 'UK 🇬🇧', prefix: '+44', id: 'voip_country_1' },
  { name: 'Francia 🇫🇷', prefix: '+33', id: 'voip_country_2' },
  { name: 'Germania 🇩🇪', prefix: '+49', id: 'voip_country_3' },
  { name: 'Spagna 🇪🇸', prefix: '+34', id: 'voip_country_4' },
  { name: 'Italia 🇮🇹', prefix: '+39', id: 'voip_country_5' },
  { name: 'Svezia 🇸🇪', prefix: '+46', id: 'voip_country_6' },
  { name: 'Canada 🇨🇦', prefix: '+1', id: 'voip_country_7' },
  { name: 'Paesi Bassi 🇳🇱', prefix: '+31', id: 'voip_country_8' },
  { name: 'Polonia 🇵🇱', prefix: '+48', id: 'voip_country_9' },
  { name: 'Russia 🇷🇺', prefix: '+7', id: 'voip_country_10' }
];

async function getNumbers() {
  let results = [];
  for (let site of sites) {
    try {
      const { data } = await axios.get(site, { headers, timeout: 7000 });
      const $ = cheerio.load(data);
      $('a, td, div').each((i, el) => {
        let t = $(el).text().trim();
        let match = t.match(/\+\d{6,15}/g);
        if (match) results.push(...match);
      });
    } catch (e) {}
  }
  return [...new Set(results)].filter(n => n.length >= 8);
}

async function getSMS(num) {
  let clean = num.replace('+', '');
  for (let site of sites) {
    try {
      const { data } = await axios.get(`${site}/${clean}`, { headers, timeout: 7000 });
      const $ = cheerio.load(data);
      let msgs = [];
      $('table tr, .list, .sms, div, td').each((i, el) => {
        let text = $(el).text().trim();
        if (text.length > 15 && text.length < 250 && !text.includes('Cookies') && !text.includes('Privacy')) {
          msgs.push(text);
        }
      });
      if (msgs.length > 0) return msgs.slice(0, 7);
    } catch {}
  }
  return [];
}

if (!global.voipSessions) global.voipSessions = {};

let handler = async (m, { conn, text, command }) => {
  if (!ready) return m.reply("❌ Errore critico: Moduli mancanti su Termux!");

  let jid = m.key.remoteJid;
  let user = m.key.participant || m.key.remoteJid;

  let input = (text || '').trim().toLowerCase();
  
  // Intercettatore avanzato per le risposte della tendina e dei pulsanti nativi
  if (m.msg && typeof m.msg === 'object') {
    input = (m.msg.singleSelectReply?.selectedRowId || m.msg.selectedButtonId || m.msg.text || text || '').trim().toLowerCase();
  }
  
  if (m.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
    input = m.message.listResponseMessage.singleSelectReply.selectedRowId.toLowerCase();
  }

  // 1. INTERFACCIA DI PARTENZA: MENÙ A TENDINA COMPATIBILE
  if (!input || input === '.voip' || command === 'voip') {
    let bodyText = `🌍 *ZENO VOIP SYSTEM INTERFACE* 🌍\n\n` +
                   `Genera numeri virtuali temporanei e monitora i codici SMS direttamente in chat.\n\n` +
                   `_Scegli un'area geografica usando il bottone qui sotto:_`;

    let rowsConfig = countries.map(c => ({
      title: c.name,
      description: `Estrai numeri con prefisso ${c.prefix}`,
      id: c.id
    }));

    let buttonsConfig = [
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🌍 Seleziona Paese",
          sections: [{
            title: "Regioni Disponibili",
            rows: rowsConfig
          }]
        })
      }
    ];

    let messageContent = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: bodyText },
            footer: { text: "Zeno Virtual Core ⚙️" },
            nativeFlowMessage: { buttons: buttonsConfig }
          }
        }
      }
    };

    await conn.sendMessage(jid, { react: { text: '📱', key: m.key } });
    return await conn.relayMessage(jid, messageContent, { quoted: m });
  }

  // 2. AZIONE BOTTONE: CAMBIO NUMERO (FORZATO TESTO COMPATIBILE IPHONE)
  if (input === 'voip_next' || input.includes('next')) {
    let session = global.voipSessions[user];
    if (!session) return m.reply("❌ Sessione scaduta! Riapri il pannello con `.voip`.");

    session.current++;
    if (session.current >= session.nums.length) session.current = 0;

    let num = session.nums[session.current];
    await conn.sendMessage(jid, { react: { text: '🔄', key: m.key } });

    let bodyText = `📱 *NUOVO NUMERO VIRTUALE ESTRATTO*\n\n` +
                   `🌍 *Paese:* ${session.country.name}\n` +
                   `📲 *Numero SIM:* \`${num}\`\n\n` +
                   `_Usa la SIM per le tue registrazioni, poi premi sotto per intercettare i codici:_`;

    let buttonsConfig = [
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔄 Altro Numero", id: `voip_next` }) },
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📩 Leggi SMS", id: `voip_sms` }) }
    ];

    let messageContent = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: bodyText },
            footer: { text: "Zeno Telephony Network ⚙️" },
            nativeFlowMessage: { buttons: buttonsConfig }
          }
        }
      }
    };
    return await conn.relayMessage(jid, messageContent, { quoted: m });
  }

  // 3. AZIONE BOTTONE: LETTURA SMS SNIFFER
  if (input === 'voip_sms' || input.includes('sms')) {
    let session = global.voipSessions[user];
    if (!session) return m.reply("❌ Sessione scaduta! Digita `.voip`.");

    let num = session.nums[session.current];
    await conn.sendMessage(jid, { react: { text: '📩', key: m.key } });

    let msgs = await getSMS(num);
    if (msgs.length === 0) {
      return m.reply(`⏳ *Nessun messaggio rilevato per ora.*\n\nAttendi circa 30 secondi che i database remoti aggiornino i pacchetti della SIM \`${num}\` e premi nuovamente il tasto "Leggi SMS".`);
    }

    let txt = `📩 *SMS IN ARRIVO SU:* \`${num}\`\n\n`;
    msgs.forEach((x, index) => {
      txt += `💬 [${index + 1}] -> ${x}\n\n`;
    });
    txt += `_Usa il tasto sotto per aggiornare lo sniffer:_`;

    let buttonsConfig = [
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔄 Ricontrolla SMS", id: `voip_sms` }) },
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📱 Cambia SIM", id: `voip_next` }) }
    ];

    let messageContent = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: txt.trim() },
            footer: { text: "Zeno Message Sniffer ⚙️" },
            nativeFlowMessage: { buttons: buttonsConfig }
          }
        }
      }
    };
    return await conn.relayMessage(jid, messageContent, { quoted: m });
  }

  // 4. INTERCETTAZIONE SELEZIONE DALLA TENDINA (ROW ID SBLOCCATO)
  if (input.startsWith('voip_country_')) {
    let targetIndex = parseInt(input.replace('voip_country_', ''));
    let country = countries[targetIndex];
    if (!country) return m.reply("❌ Selezione non valida.");

    await conn.sendMessage(jid, { react: { text: '📡', key: m.key } });

    let allNumbers = await getNumbers();
    let localNumbers = allNumbers.filter(n => n.startsWith(country.prefix));

    if (localNumbers.length === 0) {
      return m.reply(`❌ Nessuna SIM momentaneamente attiva nei server per la regione: *${country.name}*.\nSeleziona un altro paese dalla lista.`);
    }

    global.voipSessions[user] = {
      country,
      nums: localNumbers,
      current: 0
    };

    let firstNum = localNumbers[0];

    let bodyText = `📱 *S I M   V I R T U A L E   A T T I V A T A*\n\n` +
                   `🌍 *Area Geografica:* ${country.name}\n` +
                   `📲 *Numero Estratto:* \`${firstNum}\`\n\n` +
                   `_Inserisci questo numero sul portale di verifica (Google, Telegram, Social), poi premi il bottone sotto per catturare il codice OTP:_`;

    let buttonsConfig = [
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔄 Cambia Numero", id: `voip_next` }) },
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📩 Leggi SMS", id: `voip_sms` }) }
    ];

    // 🚀 STABILIZZATORE IPHONE ASSOLUTO: Aggiunto il contextInfo e il parsing nativo del relayMessage per aggirare il blocco "aggiorna whatsapp"
    let messageContent = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: bodyText },
            footer: { text: "Zeno Terminal Systems ⚙️" },
            nativeFlowMessage: { buttons: buttonsConfig }
          }
        }
      }
    };
    return await conn.relayMessage(jid, messageContent, { quoted: m });
  }
};

handler.help = ['voip'];
handler.tags = ['tools'];
handler.command = /^(voip|num|virtuale)$/i;

export default handler;
