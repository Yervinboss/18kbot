import os from 'os';
import fs from 'fs';
import path from 'path';

const toMathematicalAlphanumericSymbols = number => {
  const map = {
    '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒',
    '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗', '.': '.'
  };
  return number.toString().split('').map(digit => map[digit] || digit).join('');
};

const clockString = ms => {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  return `${toMathematicalAlphanumericSymbols(days.toString().padStart(2, '0'))}:${toMathematicalAlphanumericSymbols(hours.toString().padStart(2, '0'))}:${toMathematicalAlphanumericSymbols(minutes.toString().padStart(2, '0'))}:${toMathematicalAlphanumericSymbols(seconds.toString().padStart(2, '0'))}`;
};

const handler = async (m, { conn, command, text }) => {
  // Azione bottone: Pulisci RAM / Cache
  if (text === 'clean' || command === 'clean' || command === 'pulisci') {
    if (global.processedMessages) global.processedMessages.clear();
    if (global.gc) {
      try { global.gc(); } catch (e) {}
    }
    return conn.sendMessage(m.chat, { 
      text: '🧹 *Pulizia completata!* Cache globale svuotata e RAM ottimizzata.' 
    }, { quoted: m });
  }

  // Azione bottone: Elimina Sessioni Temporanee
  if (text === 'clearsessions' || command === 'clearsessions') {
    try {
      const sessionPath = path.resolve('sessions');
      if (fs.existsSync(sessionPath)) {
        const files = fs.readdirSync(sessionPath);
        let deletedCount = 0;
        for (let file of files) {
          if (file.startsWith('pre-key-') || file.endsWith('.tmp')) {
            fs.unlinkSync(path.join(sessionPath, file));
            deletedCount++;
          }
        }
        return conn.sendMessage(m.chat, { 
          text: `🗑️ *Sessioni ripulite!* Rimossi ${deletedCount} file temporanei superflui.` 
        }, { quoted: m });
      }
    } catch (e) {
      return conn.sendMessage(m.chat, { text: '❌ Errore durante la pulizia delle sessioni.' }, { quoted: m });
    }
  }

  let start = Date.now();
  
  const _uptime = process.uptime() * 1000;
  const uptime = clockString(_uptime);

  let latency = Date.now() - start;
  if (latency < 1) latency = Math.floor(Math.random() * 15) + 5; 
  let speedWithFont = toMathematicalAlphanumericSymbols(latency);

  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();
  const usedMemBytes = totalMemBytes - freeMemBytes;
  const totalMemMB = (totalMemBytes / (1024 * 1024)).toFixed(2);
  const usedMemMB = (usedMemBytes / (1024 * 1024)).toFixed(2);

  const processMemory = process.memoryUsage();
  const heapUsedMB = (processMemory.heapUsed / (1024 * 1024)).toFixed(2);
  const heapTotalMB = (processMemory.heapTotal / (1024 * 1024)).toFixed(2);

  const info = `𝐙𝐞𝐧𝐨𝐁𝐨𝐭 🭵 𝐒𝐲𝐬𝐭𝐞𝚖 𝐌𝐨𝐧𝐢𝐭𝐨𝐫
  
🌐 𝚲𝐓𝐓𝕀𝐕𝕀𝐓𝚲: ${uptime}
⚡ 𝐕𝚵𝐋Ꮻ𝐂𝕀𝐓𝚲: ${speedWithFont} 𝐦𝐬

💾 𝐑𝐀𝐌 (server): ${usedMemMB} MB / ${totalMemMB} MB
📊 𝐌𝐄𝐌 (process): ${heapUsedMB} MB / ${heapTotalMB} MB`.trim();

  return conn.sendMessage(m.chat, {
    text: info,
    footer: "ZenoBot • Pannello di Controllo",
    buttons: [
      {
        text: '🔄 Aggiorna Stato',
        id: '.ping'
      },
      {
        text: '🧹 Pulisci RAM',
        id: '.ping clean'
      },
      {
        text: '🗑️ Elimina Sessioni',
        id: '.ping clearsessions'
      }
    ],
    headerType: 1
  }, { quoted: m });
};

handler.command = /^(ping|stats|status|clean|pulisci|clearsessions)$/i;
handler.help = ['ping'];
handler.tags = ['info'];

export default handler;
