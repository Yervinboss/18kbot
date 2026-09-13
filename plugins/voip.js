let axios, cheerio;
let ready = false;

try {
  axios = (await import('axios')).default;
  cheerio = await import('cheerio');
  ready = true;
} catch (e) {
  console.log('[VOIP] Librerie mancanti:', e.message);
}

const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// Siti scraping (quelli che a volte funzionano)
const scrapeSites = [
  'https://receive-sms-online.info',
  'https://receive-smss.com',
  'https://www.receivesms.co',
  'https://freephonenum.com',
  'https://receive-sms.cc',
  'https://sms-online.co',
  'https://receiveasms.com',
  'https://quackr.io/temporary-numbers',
  'https://sms24.me/en/numbers',
  'https://receive-sms-free.cc',
  'https://temporary-phone-number.com',
  'https://receivesmsonline.net'
];

// Siti da aprire manualmente (per quando lo scraping fallisce)
const manualSites = [
  { name: 'Quackr.io', url: 'https://quackr.io/temporary-numbers', desc: 'Numeri gratis USA, UK, IT e altri' },
  { name: 'SMS24.me', url: 'https://sms24.me/en/numbers', desc: 'Numeri temporanei gratis' },
  { name: 'Receive-SMS-Free', url: 'https://receive-sms-free.cc', desc: 'Numeri USA e UK' },
  { name: 'Temp-Phone-Number', url: 'https://temporary-phone-number.com', desc: 'Numeri da tutto il mondo' },
  { name: 'SMS-Online', url: 'https://sms-online.co', desc: 'Numeri USA, UK, CA' },
  { name: 'ReceiveSMSOnline', url: 'https://receivesmsonline.net', desc: 'Numeri USA, UK, FR, DE' },
  { name: 'AnonymSMS', url: 'https://anonymsms.com/temporary-number', desc: 'Numeri anonimi gratis' },
  { name: 'SMS-Receive', url: 'https://sms-receive.net', desc: 'Numeri temporanei' },
  { name: 'Temp-SMS', url: 'https://temp-sms.org', desc: 'SMS temporanei gratis' },
  { name: 'ReceiveSMS.co', url: 'https://receivesms.co', desc: 'USA, UK, Canada' }
];

const countries = [
  { name: 'USA', flag: '🇺🇸', prefix: '+1' },
  { name: 'UK', flag: '🇬🇧', prefix: '+44' },
  { name: 'Francia', flag: '🇫🇷', prefix: '+33' },
  { name: 'Germania', flag: '🇩🇪', prefix: '+49' },
  { name: 'Spagna', flag: '🇪🇸', prefix: '+34' },
  { name: 'Italia', flag: '🇮🇹', prefix: '+39' },
  { name: 'Svezia', flag: '🇸🇪', prefix: '+46' },
  { name: 'Canada', flag: '🇨🇦', prefix: '+1' },
  { name: 'Paesi Bassi', flag: '🇳🇱', prefix: '+31' },
  { name: 'Polonia', flag: '🇵🇱', prefix: '+48' },
  { name: 'Russia', flag: '🇷🇺', prefix: '+7' },
  { name: 'Ucraina', flag: '🇺🇦', prefix: '+380' },
  { name: 'India', flag: '🇮🇳', prefix: '+91' },
  { name: 'Indonesia', flag: '🇮🇩', prefix: '+62' },
  { name: 'Filippine', flag: '🇵🇭', prefix: '+63' }
];

let sessions = {};async function getNumbers() {
  let results = [];
  let siteResults = {};

  for (let site of scrapeSites) {
    try {
      const { data } = await axios.get(site, {
        headers,
        timeout: 8000,
        validateStatus: (s) => s < 500
      });

      const $ = cheerio.load(data);
      let found = 0;

      $('a, td, div, span').each((i, el) => {
        let t = $(el).text().trim();
        let match = t.match(/\+\d{8,15}/g);
        if (match) {
          results.push(...match);
          found += match.length;
        }
      });

      if (found > 0) {
        siteResults[site] = found;
        console.log(`[VOIP] ✅ ${site} → ${found} numeri`);
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.log(`[VOIP] ❌ ${site}: ${e.message}`);
    }
  }

  results = [...new Set(results)].filter(n => n.length >= 8 && n.length <= 16);
  console.log(`[VOIP] Totale unici: ${results.length}`);
  return { numbers: results, sites: siteResults };
}

async function getSMS(num) {
  let clean = num.replace('+', '').replace(/\s/g, '');
  let allMsgs = [];

  for (let site of scrapeSites) {
    try {
      const { data } = await axios.get(`${site}/${clean}`, {
        headers,
        timeout: 8000,
        validateStatus: (s) => s < 500
      });

      const $ = cheerio.load(data);
      let msgs = [];

      $('table tr, .list, .sms, .message, .msg').each((i, el) => {
        let text = $(el).text().trim();
        if (text.length > 15 && text.length < 300) {
          if (!text.includes('©') && !text.includes('Cookie') && !text.includes('Privacy')) {
            msgs.push(text);
          }
        }
      });

      if (msgs.length > 0) allMsgs.push(...msgs);

      await new Promise(r => setTimeout(r, 400));
    } catch (e) {}
  }

  allMsgs = [...new Set(allMsgs)];
  return allMsgs.slice(0, 10);
}let handler = async (m, { conn, text, command }) => {
  let chatId = m.key.remoteJid;
  let sender = m.key.participant || m.key.remoteJid;

  if (!ready) {
    return conn.sendMessage(chatId, { text: '❌ Librerie mancanti (axios / cheerio).' }, { quoted: m });
  }

  let cmdLower = (command || '').toLowerCase().trim();
  console.log('[VOIP] command:', cmdLower, '| text:', text);

  // ============================================================
  // 🎯 COUNTRY: .voipN → cerca numeri per paese
  // ============================================================
  let countryMatch = cmdLower.match(/^voip(\d+)$/);
  if (countryMatch) {
    let index = parseInt(countryMatch[1]);
    let country = countries[index];

    if (!country) {
      return conn.sendMessage(chatId, { text: '❌ Paese non valido.' }, { quoted: m });
    }

    await conn.sendMessage(chatId, { text: `⏳ Ricerca numeri ${country.flag} ${country.name}...` }, { quoted: m });

    let { numbers, sites: foundSites } = await getNumbers();
    let nums = numbers.filter(n => n.startsWith(country.prefix));

    // 🔥 Se non trova numeri → mostra siti manuali
    if (nums.length === 0) {
      let sections = [{
        title: "🌐 Siti consigliati (apri nel browser)",
        rows: manualSites.slice(0, 8).map((s, i) => ({
          title: `🌐 ${s.name}`,
          rowId: `.voipsite${i}`,
          description: s.desc
        }))
      }];

      return conn.sendMessage(chatId, {
        text: `❌ *Nessun numero ${country.flag} ${country.name} trovato*\n\n_I siti scraping sono momentaneamente bloccati._\n\n👉 Usa uno dei siti manuali qui sotto per trovare un numero:\n\n_Poi torna con \`.voipcopy [numero]\` per copiarlo._`,
        footer: 'Zeno Bot • VOIP',
        title: '🌐 Siti Alternativi',
        buttonText: '📜 Apri Siti',
        sections
      }, { quoted: m });
    }

    sessions[sender] = {
      country,
      nums,
      current: 0,
      expiresAt: Date.now() + (15 * 60 * 1000)
    };

    let num = nums[0];

    let sections = [{
      title: "⚙️ Azioni disponibili",
      rows: [
        { title: "🔄 Cambia Numero", rowId: ".voipnext", description: `Altri ${nums.length - 1} numeri disponibili` },
        { title: "📩 Controlla SMS", rowId: ".voipsms", description: "Leggi gli SMS ricevuti" },
        { title: "📋 Copia Numero", rowId: ".voipcopy", description: "Mostra il numero in formato copiabile" },
        { title: "🌍 Cambia Paese", rowId: ".voip", description: "Torna alla lista paesi" },
        { title: "🌐 Siti Manuali", rowId: ".voipsiti", description: "Siti da aprire nel browser" }
      ]
    }];

    return conn.sendMessage(chatId, {
      text: `📱 *NUMERO ATTIVO*\n\n🌍 *${country.flag} ${country.name}*\n📞 \`${num}\`\n\n📌 Numero *1 di ${nums.length}*\n\n_Usa questo numero per registrarti. Aspetta l'SMS e premi "📩 Controlla SMS"._`,
      footer: 'Zeno Bot • VOIP',
      title: '📜 Azioni Numero',
      buttonText: '📜 Apri Menu',
      sections
    }, { quoted: m });
  }

  // ============================================================
  // 🔄 NEXT: cambia numero
  // ============================================================
  if (cmdLower === 'voipnext') {
    let session = sessions[sender];
    if (!session || Date.now() > session.expiresAt) {
      delete sessions[sender];
      return conn.sendMessage(chatId, { text: '❌ Sessione scaduta. Usa `.voip` per ricominciare.' }, { quoted: m });
    }

    session.current++;
    if (session.current >= session.nums.length) session.current = 0;

    let num = session.nums[session.current];

    let sections = [{
      title: "⚙️ Azioni disponibili",
      rows: [
        { title: "🔄 Cambia Numero", rowId: ".voipnext", description: `Altri ${session.nums.length - 1} numeri` },
        { title: "📩 Controlla SMS", rowId: ".voipsms", description: "Leggi gli SMS ricevuti" },
        { title: "📋 Copia Numero", rowId: ".voipcopy", description: "Mostra il numero copiabile" },
        { title: "🌍 Cambia Paese", rowId: ".voip", description: "Torna alla lista paesi" }
      ]
    }];

    return conn.sendMessage(chatId, {
      text: `📱 *NUOVO NUMERO*\n\n🌍 *${session.country.flag} ${session.country.name}*\n📞 \`${num}\`\n\n📌 Numero *${session.current + 1} di ${session.nums.length}*`,
      footer: 'Zeno Bot • VOIP',
      title: '📜 Azioni Numero',
      buttonText: '📜 Apri Menu',
      sections
    }, { quoted: m });
  }

  // ============================================================
  // 📩 SMS: controlla messaggi
  // ============================================================
  if (cmdLower === 'voipsms') {
    let session = sessions[sender];
    if (!session || Date.now() > session.expiresAt) {
      delete sessions[sender];
      return conn.sendMessage(chatId, { text: '❌ Sessione scaduta. Usa `.voip` per ricominciare.' }, { quoted: m });
    }

    let num = session.nums[session.current];

    await conn.sendMessage(chatId, { text: `⏳ Controllo SMS per *${num}*...` }, { quoted: m });

    let msgs = await getSMS(num);

    if (msgs.length === 0) {
      let sections = [{
        title: "⚙️ Azioni",
        rows: [
          { title: "🔄 Riprova tra poco", rowId: ".voipsms", description: "Ricontrolla SMS" },
          { title: "🔄 Cambia Numero", rowId: ".voipnext", description: "Prova un altro numero" },
          { title: "🌐 Siti Manuali", rowId: ".voipsiti", description: "Apri siti nel browser" }
        ]
      }];

      return conn.sendMessage(chatId, {
        text: `❌ *Nessun SMS per* \`${num}\`\n\n_Aspetta 1-2 minuti e riprova._\n_Se non arriva mai, prova un altro numero._`,
        footer: 'Zeno Bot • VOIP',
        title: '📜 Azioni',
        buttonText: '📜 Apri Menu',
        sections
      }, { quoted: m });
    }

    let txt = `📩 *SMS RICEVUTI*\n📞 ${num}\n\n`;
    msgs.forEach((x, i) => {
      txt += `*${i + 1}.* ${x}\n────────────\n`;
    });

    return conn.sendMessage(chatId, { text: txt.trim() }, { quoted: m });
  }

  // ============================================================
  // 📋 COPY: copia numero
  // ============================================================
  if (cmdLower === 'voipcopy') {
    let session = sessions[sender];
    if (!session) {
      // Modalità manuale: .voipcopy +393331234567
      let num = (text || '').trim();
      if (num) {
        let clean = num.replace(/[^0-9+]/g, '');
        return conn.sendMessage(chatId, { text: `📋 *Numero copiabile:*\n\n\`${clean}\`\n\n_Copia e incolla dove ti serve._` }, { quoted: m });
      }
      return conn.sendMessage(chatId, { text: '❌ Nessuna sessione attiva.\n\n*Uso:* `.voipcopy +393331234567` per copiare un numero manuale.' }, { quoted: m });
    }

    let num = session.nums[session.current];
    return conn.sendMessage(chatId, { text: `📋 *Numero copiabile:*\n\n\`${num}\`\n\n_Copia e incolla dove ti serve._` }, { quoted: m });
  }

  // ============================================================
  // 🌐 SITI: mostra lista siti manuali
  // ============================================================
  if (cmdLower === 'voipsiti') {
    let rows = manualSites.map((s, i) => ({
      title: `🌐 ${s.name}`,
      rowId: `.voipsite${i}`,
      description: s.desc
    }));

    let sections = [
      { title: "🌐 Siti consigliati (1-5)", rows: rows.slice(0, 5) },
      { title: "🌐 Altri siti (6-10)", rows: rows.slice(5) }
    ];

    return conn.sendMessage(chatId, {
      text: `🌐 *SITI SMS TEMPORANEI*\n\n📱 Scegli un sito → il bot ti darà il link\n\n💡 _Apri il link nel browser, scegli il paese, copia un numero e usalo dove ti serve._\n\n📋 _Poi torna con \`.voipcopy [numero]\` per copiarlo facilmente._`,
      footer: 'Zeno Bot • VOIP',
      title: '📜 Scegli Sito',
      buttonText: '📜 Apri Siti',
      sections
    }, { quoted: m });
  }

  // ============================================================
  // 🌐 SITE: mostra link singolo sito
  // ============================================================
  let siteMatch = cmdLower.match(/^voipsite(\d+)$/);
  if (siteMatch) {
    let index = parseInt(siteMatch[1]);
    let site = manualSites[index];

    if (!site) {
      return conn.sendMessage(chatId, { text: '❌ Sito non valido.' }, { quoted: m });
    }

    return conn.sendMessage(chatId, {
      text: `🌐 *${site.name}*\n\n📝 ${site.desc}\n\n👆 *Apri questo link:*\n${site.url}\n\n💡 _Copia un numero da questo sito e usalo._\n_Poi torna con_ \`.voipcopy [numero]\` _per copiarlo._`
    }, { quoted: m });
  }

  // ============================================================
  // 🏠 HOME: menu principale .voip
  // ============================================================
  if (cmdLower === 'voip') {
    let rows = countries.map((c, i) => ({
      title: `${c.flag} ${c.name}`,
      rowId: `.voip${i}`,
      description: `Prefisso: ${c.prefix}`
    }));

    let sections = [
      { title: "🌍 Paesi (1-10)", rows: rows.slice(0, 10) },
      { title: "🌍 Altri Paesi (11-15)", rows: rows.slice(10) },
      { title: "🌐 Siti Manuali", rows: [
        { title: "🌐 Apri lista siti", rowId: ".voipsiti", description: "Siti da aprire nel browser" }
      ]}
    ];

    return conn.sendMessage(chatId, {
      text: `📱 *NUMERI TEMPORANEI ONLINE*\n\n🌍 Scegli un paese per ricevere SMS online.\n\n📌 _Perfetti per OTP, verifica account, registrazioni temporanee._\n\n⚠️ _I numeri cambiano spesso. Se uno non funziona, prova "🔄 Cambia Numero"._\n\n💡 _Se il bot non trova numeri, usa i "🌐 Siti Manuali"._`,
      footer: 'Zeno Bot • VOIP',
      title: '📜 Seleziona Paese',
      buttonText: '📜 Apri Menu',
      sections
    }, { quoted: m });
  }
};handler.help = ['voip'];
handler.tags = ['tools'];
handler.command = /^(voip|voip\d+|voipnext|voipsms|voipcopy|voipsiti|voipsite\d+)$/i;
handler.owner = true;

export default handler;
