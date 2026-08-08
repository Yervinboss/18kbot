// Memoria temporanea per le partite attive in ogni chat
const partiteAttive = {};

// Database totale: unione di tutti i paesi del mondo + i classici
const tuttiPaesi = [
    // Classici e principali
    { codice: 'it', nome: 'italia' }, { codice: 'fr', nome: 'francia' }, { codice: 'es', nome: 'spagna' },
    { codice: 'de', nome: 'germania' }, { codice: 'jp', nome: 'giappone' }, { codice: 'br', nome: 'brasile' },
    { codice: 'us', nome: 'stati uniti' }, { codice: 'gb', nome: 'regno unito' }, { codice: 'ar', nome: 'argentina' },
    { codice: 'mx', nome: 'messico' }, { codice: 'ca', nome: 'canada' }, { codice: 'cn', nome: 'cina' },
    { codice: 'pt', nome: 'portogallo' },
    // Tutti gli altri del mondo
    { codice: 'af', nome: 'afghanistan' }, { codice: 'al', nome: 'albania' }, { codice: 'dz', nome: 'algeria' },
    { codice: 'ad', nome: 'andorra' }, { codice: 'ao', nome: 'angola' }, { codice: 'ag', nome: 'antigua e barbuda' },
    { codice: 'am', nome: 'armenia' }, { codice: 'au', nome: 'australia' },
    { codice: 'at', nome: 'austria' }, { codice: 'az', nome: 'azerbaigian' }, { codice: 'bs', nome: 'bahamas' },
    { codice: 'bh', nome: 'bahrein' }, { codice: 'bd', nome: 'bangladesh' }, { codice: 'bb', nome: 'barbados' },
    { codice: 'by', nome: 'bielorussia' }, { codice: 'be', nome: 'belgio' }, { codice: 'bz', nome: 'belize' },
    { codice: 'bj', nome: 'benin' }, { codice: 'bt', nome: 'bhutan' }, { codice: 'bo', nome: 'bolivia' },
    { codice: 'ba', nome: 'bosnia ed erzegovina' }, { codice: 'bw', nome: 'botswana' },
    { codice: 'bn', nome: 'brunei' }, { codice: 'bg', nome: 'bulgaria' }, { codice: 'bf', nome: 'burkina faso' },
    { codice: 'bi', nome: 'burundi' }, { codice: 'cv', nome: 'capo verde' }, { codice: 'kh', nome: 'cambogia' },
    { codice: 'cm', nome: 'camerun' }, { codice: 'cf', nome: 'repubblica centrafricana' },
    { codice: 'td', nome: 'ciad' }, { codice: 'cl', nome: 'cile' },
    { codice: 'co', nome: 'colombia' }, { codice: 'km', nome: 'comore' }, { codice: 'cg', nome: 'congo' },
    { codice: 'cd', nome: 'repubblica democratica del congo' }, { codice: 'cr', nome: 'costa rica' }, { codice: 'ci', nome: 'costa davorio' },
    { codice: 'hr', nome: 'croazia' }, { codice: 'cu', nome: 'cuba' }, { codice: 'cy', nome: 'cipro' },
    { codice: 'cz', nome: 'repubblica ceca' }, { codice: 'dk', nome: 'danimarca' }, { codice: 'dj', nome: 'gibuti' },
    { codice: 'dm', nome: 'dominica' }, { codice: 'do', nome: 'repubblica dominicana' }, { codice: 'ec', nome: 'ecuador' },
    { codice: 'eg', nome: 'egitto' }, { codice: 'sv', nome: 'el salvador' }, { codice: 'gq', nome: 'guinea equatoriale' },
    { codice: 'er', nome: 'eritrea' }, { codice: 'ee', nome: 'estonia' }, { codice: 'sz', nome: 'eswatini' },
    { codice: 'et', nome: 'etiopia' }, { codice: 'fj', nome: 'figi' }, { codice: 'fi', nome: 'finlandia' },
    { codice: 'ga', nome: 'gabon' }, { codice: 'gm', nome: 'gambia' },
    { codice: 'ge', nome: 'georgia' }, { codice: 'gh', nome: 'ghana' },
    { codice: 'gr', nome: 'grecia' }, { codice: 'gd', nome: 'grenada' }, { codice: 'gt', nome: 'guatemala' },
    { codice: 'gn', nome: 'guinea' }, { codice: 'gw', nome: 'guinea-bissau' }, { codice: 'gy', nome: 'guyana' },
    { codice: 'ht', nome: 'haiti' }, { codice: 'hn', nome: 'honduras' }, { codice: 'hu', nome: 'ungheria' },
    { codice: 'is', nome: 'islandia' }, { codice: 'in', nome: 'india' }, { codice: 'id', nome: 'indonesia' },
    { codice: 'ir', nome: 'iran' }, { codice: 'iq', nome: 'iraq' }, { codice: 'ie', nome: 'irlanda' },
    { codice: 'il', nome: 'israele' }, { codice: 'jm', nome: 'giamaica' },
    { codice: 'jo', nome: 'giordania' }, { codice: 'kz', nome: 'kazakistan' },
    { codice: 'ke', nome: 'kenya' }, { codice: 'ki', nome: 'kiribati' }, { codice: 'kp', nome: 'corea del nord' },
    { codice: 'kr', nome: 'corea del sud' }, { codice: 'kw', nome: 'kuwait' }, { codice: 'kg', nome: 'kirghizistan' },
    { codice: 'la', nome: 'laos' }, { codice: 'lv', nome: 'lettonia' }, { codice: 'lb', nome: 'libano' },
    { codice: 'ls', nome: 'lesotho' }, { codice: 'lr', nome: 'liberia' }, { codice: 'ly', nome: 'libia' },
    { codice: 'li', nome: 'liechtenstein' }, { codice: 'lt', nome: 'lituania' }, { codice: 'lu', nome: 'lussemburgo' },
    { codice: 'mg', nome: 'madagascar' }, { codice: 'mw', nome: 'malawi' }, { codice: 'my', nome: 'malaysia' },
    { codice: 'mv', nome: 'maldive' }, { codice: 'ml', nome: 'mali' }, { codice: 'mt', nome: 'malta' },
    { codice: 'mh', nome: 'isole marshall' }, { codice: 'mr', nome: 'mauritania' }, { codice: 'mu', nome: 'mauritius' },
    { codice: 'fm', nome: 'micronesia' }, { codice: 'md', nome: 'moldavia' },
    { codice: 'mc', nome: 'monaco' }, { codice: 'mn', nome: 'mongolia' }, { codice: 'me', nome: 'montenegro' },
    { codice: 'ma', nome: 'marocco' }, { codice: 'mz', nome: 'mozambico' }, { codice: 'mm', nome: 'myanmar' },
    { codice: 'na', nome: 'namibia' }, { codice: 'nr', nome: 'nauru' }, { codice: 'np', nome: 'nepal' },
    { codice: 'nl', nome: 'paesi bassi' }, { codice: 'nz', nome: 'nuova zelanda' }, { codice: 'ni', nome: 'nicaragua' },
    { codice: 'ne', nome: 'niger' }, { codice: 'ng', nome: 'nigeria' }, { codice: 'mk', nome: 'macedonia del nord' },
    { codice: 'no', nome: 'norvegia' }, { codice: 'om', nome: 'oman' }, { codice: 'pk', nome: 'pakistan' },
    { codice: 'pw', nome: 'palau' }, { codice: 'pa', nome: 'panama' }, { codice: 'pg', nome: 'papua nuova guinea' },
    { codice: 'py', nome: 'paraguay' }, { codice: 'pe', nome: 'perù' }, { codice: 'ph', nome: 'filippine' },
    { codice: 'pl', nome: 'polonia' }, { codice: 'qa', nome: 'qatar' },
    { codice: 'ro', nome: 'romania' }, { codice: 'ru', nome: 'russia' }, { codice: 'rw', nome: 'ruanda' },
    { codice: 'kn', nome: 'saint kitts e nevis' }, { codice: 'lc', nome: 'santa lucia' }, { codice: 'vc', nome: 'saint vincent e grenadine' },
    { codice: 'ws', nome: 'samoa' }, { codice: 'sm', nome: 'san marino' }, { codice: 'st', nome: 'sao tome e principe' },
    { codice: 'sa', nome: 'arabia saudita' }, { codice: 'sn', nome: 'senegal' }, { codice: 'rs', nome: 'serbia' },
    { codice: 'sc', nome: 'seychelles' }, { codice: 'sl', nome: 'sierra leone' }, { codice: 'sg', nome: 'singapore' },
    { codice: 'sk', nome: 'slovacchia' }, { codice: 'si', nome: 'slovenia' }, { codice: 'sb', nome: 'isole salomone' },
    { codice: 'so', nome: 'somalia' }, { codice: 'za', nome: 'sudafrica' }, { codice: 'ss', nome: 'sudan del sud' },
    { codice: 'lk', nome: 'sri lanka' }, { codice: 'sd', nome: 'sudan' },
    { codice: 'sr', nome: 'suriname' }, { codice: 'se', nome: 'svezia' }, { codice: 'ch', nome: 'svizzera' },
    { codice: 'sy', nome: 'siria' }, { codice: 'tw', nome: 'taiwan' }, { codice: 'tj', nome: 'tagikistan' },
    { codice: 'tz', nome: 'tanzania' }, { codice: 'th', nome: 'thailandia' }, { codice: 'tl', nome: 'timor est' },
    { codice: 'tg', nome: 'togo' }, { codice: 'to', nome: 'tonga' }, { codice: 'tt', nome: 'trinidad e tobago' },
    { codice: 'tn', nome: 'tunisia' }, { codice: 'tr', nome: 'turchia' }, { codice: 'tm', nome: 'turkmenistan' },
    { codice: 'tv', nome: 'tuvalu' }, { codice: 'ug', nome: 'uganda' }, { codice: 'ua', nome: 'ucraina' },
    { codice: 'ae', nome: 'emirati arabi uniti' }, { codice: 'uy', nome: 'uruguay' }, { codice: 'uz', nome: 'uzbekistan' }, 
    { codice: 'vu', nome: 'vanuatu' }, { codice: 'va', nome: 'città del vaticano' }, { codice: 've', nome: 'venezuela' }, 
    { codice: 'vn', nome: 'vietnam' }, { codice: 'ye', nome: 'yemen' }, { codice: 'zm', nome: 'zambia' }, { codice: 'zw', nome: 'zimbabwe' }
];

module.exports = {
    name: 'bandiera',
    description: 'Gioco completo per indovinare qualsiasi bandiera',
    
    // Comando iniziale (.bandiera)
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;

        if (partiteAttive[sender] && partiteAttive[sender].inCorso) {
            await sock.sendMessage(sender, { text: 'C\'è già una bandiera attiva in questa chat! Scrivi il nome della nazione per indovinare.' }, { quoted: m });
            return;
        }

        const paeseScelto = tuttiPaesi[Math.floor(Math.random() * tuttiPaesi.length)];
        const urlBandiera = `https://flagcdn.com/w640/${paeseScelto.codice}.png`;

        partiteAttive[sender] = {
            nazione: paeseScelto.nome,
            inCorso: true
        };

        await sock.sendMessage(sender, {
            image: { url: urlBandiera },
            caption: '🚩 *GIOCO DELLA BANDIERA*\n\nDi quale nazione è questa bandiera?\nScrivi il nome qui sotto!'
        }, { quoted: m });
    },

    // Funzione cruciale per catturare la risposta in chat
    async handleMessage(sock, m) {
        const sender = m.key.remoteJid;
        
        if (!partiteAttive[sender] || !partiteAttive[sender].inCorso) return;

        const textMsg = m.message?.conversation || 
                        m.message?.extendedTextMessage?.text || 
                        m.message?.imageMessage?.caption || '';

        if (!textMsg) return;

        const rispostaUtente = textMsg.trim().toLowerCase();
        const nazioneSegreta = partiteAttive[sender].nazione;

        if (rispostaUtente === nazioneSegreta) {
            partiteAttive[sender].inCorso = false;
            const pushName = m.pushName || 'Un utente';
            const nomeFormattato = nazioneSegreta.charAt(0).toUpperCase() + nazioneSegreta.slice(1);

            await sock.sendMessage(sender, { 
                text: `🎉 Grande *${pushName}*! Hai indovinato tu! Era proprio l'**${nomeFormattato}** 🎯` 
            }, { quoted: m });
        }
    }
};

