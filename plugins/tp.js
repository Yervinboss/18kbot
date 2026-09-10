import yts from 'yt-search'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

global.tpSelection = global.tpSelection || {}
global.tpProcessing = global.tpProcessing || {} // 🔥 Per evitare doppi processamenti

const getThumbnail = (video) => {
  let img = video?.thumbnail || video?.image || video?.images?.[0] || '';
  
  if (!img || img.length < 5 || img.includes('icone/')) {
      return 'https://youtube.com';
  }
  
  if (img.endsWith('/default.jpg')) {
      img = img.replace('/default.jpg', '/mqdefault.jpg');
  }
  
  if (img.includes('default') && !img.includes('youtube.com')) {
      return img;
  }
  
  return `https://wsrv.nl/?url=${encodeURIComponent(img)}&w=500&h=500&fit=cover`;
}

async function processTpSelection(conn, m, queryText) {
  // 🔥 FIX 1: Evita doppi processamenti
  const processKey = `${m.key.id}_${m.sender}`
  if (global.tpProcessing[processKey]) {
    return // Già in elaborazione
  }
  global.tpProcessing[processKey] = true
  
  setTimeout(() => {
    delete global.tpProcessing[processKey]
  }, 5000)

  let indexNum = Number(queryText)
  if (isNaN(indexNum)) {
    indexNum = Number(queryText.replace('tp_select', '').trim())
  }

  // 🔥 FIX 2: Permetti a chiunque nel gruppo di selezionare
  let results = null
  
  // Prima controlla se c'è una selezione per questo utente
  if (global.tpSelection[m.sender]) {
    results = global.tpSelection[m.sender]
  } 
  // Se non c'è, controlla se c'è una selezione per il gruppo
  else if (m.key.remoteJid && m.key.remoteJid.endsWith('@g.us')) {
    const chatId = m.key.remoteJid
    if (global.tpSelection[chatId]) {
      results = global.tpSelection[chatId]
    }
  }

  if (!results?.length) {
    return conn.sendMessage(m.key.remoteJid, { 
      text: "❌ Nessuna selezione attiva. Cerca prima con `.tp nome`." 
    }, { quoted: m })
  }
  
  if (!Number.isInteger(indexNum) || indexNum < 1 || indexNum > results.length) {
    return conn.sendMessage(m.key.remoteJid, { 
      text: `❌ Seleziona un numero valido tra 1 e ${results.length}.` 
    }, { quoted: m })
  }

  const video = results[indexNum - 1]
  if (!video) {
    return conn.sendMessage(m.key.remoteJid, { 
      text: "❌ Risultato non valido." 
    }, { quoted: m })
  }

  let chatId = m.key.remoteJid

  try {
    await conn.sendMessage(chatId, { react: { text: '🎧', key: m.key } })
  } catch (e) {}

  let inputMp3 = path.join(os.tmpdir(), `_temp_tp_${Date.now()}.mp3`)
  let outputOgg = path.join(os.tmpdir(), `voice_tp_${Date.now()}.ogg`)

  let yt_command = `yt-dlp -x --audio-format mp3 --audio-quality 192k --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${video.url}"`
  
  exec(yt_command, async (error, stdout, stderr) => {
      if (error) {
          console.error('Errore yt-dlp:', stderr)
          return await conn.sendMessage(chatId, { 
            text: '❌ Errore durante il download del brano.' 
          }, { quoted: m })
      }

      let ffmpeg_command = `ffmpeg -i "${inputMp3}" -c:a libopus -b:a 128k -ar 48000 -ac 1 -f ogg "${outputOgg}"`
      
      exec(ffmpeg_command, async (err2, stdout2, stderr2) => {
          if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3)

          if (err2) {
              console.error('Errore conversione ffmpeg:', stderr2)
              return await conn.sendMessage(chatId, { 
                text: '❌ Errore nella conversione del vocale.' 
              }, { quoted: m })
          }

          if (fs.existsSync(outputOgg)) {
              try {
                  let audioBuffer = fs.readFileSync(outputOgg)
                  await conn.sendMessage(chatId, {
                      audio: audioBuffer,
                      mimetype: 'audio/ogg; codecs=opus',
                      ptt: true
                  }, { quoted: m })

                  await conn.sendMessage(chatId, { react: { text: '✅', key: m.key } })
                  
              } catch (err) {
                  console.error('Errore durante invio audio:', err)
              } finally {
                  setTimeout(() => {
                      if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg)
                  }, 5000)
              }
          } else {
              return await conn.sendMessage(chatId, { 
                text: '❌ File vocale non generato.' 
              }, { quoted: m })
          }
      })
  })
}

let handler = async (m, { conn, text, command }) => {
  // 🔥 FIX 3: Gestione bottoni - se è un bottone, processa e ESCE
  let buttonId = null
  
  if (m.message?.buttonsResponseMessage?.selectedButtonId) {
      buttonId = m.message.buttonsResponseMessage.selectedButtonId
  } else if (m.message?.templateButtonReplyMessage?.selectedId) {
      buttonId = m.message.templateButtonReplyMessage.selectedId
  } else if (m.msg?.selectedButtonId) {
      buttonId = m.msg.selectedButtonId
  } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
          let parsed = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
          if (parsed.id) buttonId = parsed.id
      } catch (e) {}
  }

  // 🔥 Se è un bottone tp_select, processa e RETURNA (non continua)
  if (buttonId && buttonId.toLowerCase().startsWith('tp_select')) {
      let parts = buttonId.trim().split(/\s+/)
      let queryNum = parts.length > 1 ? parts[1] : buttonId.replace(/tp_select/i, '').trim()
      await processTpSelection(conn, m, queryNum)
      return // 🔥 IMPORTANTE: Esce per non processare due volte
  }

  let cleanText = (text || '').trim()
  cleanText = cleanText.replace(/@[^\s]+/g, '').trim()
  
  let action = (command || '').trim().toLowerCase()
  let query = cleanText

  // Se è un comando normale .tp
  if (action === 'tp') {
    if (!query) {
      return conn.sendMessage(m.key.remoteJid, { 
        text: "🎧 𝐒𝐜𝐫𝐢𝐯𝐢 𝐢𝐥 𝐧𝐨𝐦𝐞 𝐝𝐞𝐥 𝐜𝐚𝐧𝐭𝐚𝐧𝐭𝐞 𝐨 𝐝𝐞𝐥𝐥'𝐚𝐫𝐭𝐢𝐬𝐭𝐚! (Esempio: `.tp visino bianco`)" 
      }, { quoted: m })
    }

    await conn.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } })

    let search = await yts(query)
    let results = search.videos.slice(0, 5)

    if (!results.length) {
      return conn.sendMessage(m.key.remoteJid, { 
        text: `❌ Nessun risultato trovato per: "${query}"` 
      }, { quoted: m })
    }
    
    // 🔥 FIX 4: Salva la selezione sia per l'utente che per il gruppo
    const chatId = m.key.remoteJid
    global.tpSelection[m.sender] = results
    if (chatId.endsWith('@g.us')) {
      global.tpSelection[chatId] = results // Salva anche per il gruppo
    }

    const selectionCards = results.map((video, index) => ({
      image: { url: getThumbnail(video) },
      title: `🎵 ${video.title.substring(0, 60)}${video.title.length > 60 ? '…' : ''}`,
      body: `🎵 *${video.title}*\n\n📺 ${video.author?.name || 'Sconosciuto'}\n⏱️ ${video.timestamp || '—'}\n👁️ ${video.views?.toLocaleString() || '—'}`,
      footer: 'Zeno Bot',
      buttons: [{
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: `🎧 Seleziona ${index + 1}`,
          id: `tp_select ${index + 1}`
        })
      }]
    }))

    return conn.sendMessage(m.key.remoteJid, {
      text: `🔎 𝐓𝐫𝐨𝐯𝐚𝐭𝐢 𝐢 𝐭𝐨𝐩 𝟓 𝐛𝐫𝐚𝐧𝐢 𝐩𝐞𝐫 "*${query}*".\n\nScegli la traccia che preferisci dalla lista.`,
      footer: 'Zeno Bot',
      cards: selectionCards
    }, { quoted: m })
  }
}

// 🔥 FIX 5: messageHook processa i bottoni ma controlla se già in processing
handler.messageHook = async (conn, m) => {
    let buttonId = null
    
    if (m.message?.buttonsResponseMessage?.selectedButtonId) {
        buttonId = m.message.buttonsResponseMessage.selectedButtonId
    } else if (m.message?.templateButtonReplyMessage?.selectedId) {
        buttonId = m.message.templateButtonReplyMessage.selectedId
    } else if (m.msg?.selectedButtonId) {
        buttonId = m.msg.selectedButtonId
    } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
        try {
            let parsed = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
            if (parsed.id) buttonId = parsed.id
        } catch (e) {}
    }

    // 🔥 Processa SOLO se è tp_select e NON è già in processing
    if (buttonId && buttonId.toLowerCase().startsWith('tp_select')) {
        const processKey = `${m.key.id}_${m.sender}`
        if (!global.tpProcessing[processKey]) {
            let parts = buttonId.trim().split(/\s+/)
            let queryNum = parts.length > 1 ? parts[1] : buttonId.replace(/tp_select/i, '').trim()
            await processTpSelection(conn, m, queryNum)
        }
    }
}

handler.command = /^(tp|tp_select|tp_select.*)$/i
handler.help = ['tp']
handler.tags = ['music']

export default handler;
