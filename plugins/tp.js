import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

global.tpSelection = global.tpSelection || {}
global.tpProcessing = global.tpProcessing || {} // 🔥 Per evitare doppi processamenti

// 🔥 FIX: yt-search era rotto (bug di parsing lato libreria). Cerchiamo con
// yt-dlp, già installato e usato per il download, molto più stabile.
async function searchYoutube(query, limit = 5) {
  const safeQuery = query.replace(/"/g, '')
  const cmd = `yt-dlp "ytsearch${limit}:${safeQuery}" --flat-playlist --dump-json --extractor-args youtube:player-client=android,web`

  const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 })

  const lines = stdout.split('\n').filter(line => line.trim().length > 0)
  const results = []

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      if (!data?.id || !data?.title) continue

      let thumb = ''
      if (Array.isArray(data.thumbnails) && data.thumbnails.length) {
        thumb = data.thumbnails[data.thumbnails.length - 1].url
      } else if (data.thumbnail) {
        thumb = data.thumbnail
      }

      results.push({
        title: String(data.title),
        url: `https://www.youtube.com/watch?v=${data.id}`,
        author: { name: data.channel || data.uploader || 'Sconosciuto' },
        timestamp: data.duration_string || '—',
        views: typeof data.view_count === 'number' ? data.view_count.toLocaleString() : '—',
        thumbnail: thumb
      })
    } catch (e) {
      // Riga non valida, la saltiamo senza far crashare tutto
    }
  }

  return results
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

    let results
    try {
      results = await searchYoutube(query, 5)
    } catch (e) {
      console.error('Errore ricerca yt-dlp:', e)
      return conn.sendMessage(m.key.remoteJid, {
        text: '❌ Errore nella ricerca, riprova tra poco.'
      }, { quoted: m })
    }

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

    // 🔥 FIX 6: stesso formato bottoni di song.js (buttonId/buttonText/type:1),
    // quello con "cards"/nativeFlow non veniva renderizzato da WhatsApp.
    let listText = `🔎 𝐓𝐫𝐨𝐯𝐚𝐭𝐢 𝐢 𝐭𝐨𝐩 5 𝐛𝐫𝐚𝐧𝐢 𝐩𝐞𝐫 "*${query}*":\n\n`
    results.forEach((video, index) => {
      listText += `*${index + 1}.* ${video.title.substring(0, 60)}${video.title.length > 60 ? '…' : ''}\n`
      listText += `   📺 ${video.author?.name || 'Sconosciuto'} • ⏱️ ${video.timestamp || '—'}\n\n`
    })
    listText += 'Scegli la traccia che preferisci dalla lista.'

    const selectionButtons = results.map((video, index) => ({
      buttonId: `tp_select ${index + 1}`,
      buttonText: { displayText: `🎧 Seleziona ${index + 1}` },
      type: 1
    }))

    // Prova a scaricare la thumbnail del primo risultato per l'header,
    // come già fa song.js. Se fallisce, invia comunque solo testo + bottoni.
    let firstThumb = results[0]?.thumbnail
    let thumbPath = firstThumb ? path.join(os.tmpdir(), `tp_thumb_${Date.now()}.jpg`) : null

    if (thumbPath) {
      try {
        let response = await fetch(firstThumb)
        let buffer = Buffer.from(await response.arrayBuffer())
        fs.writeFileSync(thumbPath, buffer)

        let sentMsg = await conn.sendMessage(m.key.remoteJid, {
          image: fs.readFileSync(thumbPath),
          caption: listText,
          footer: 'Zeno Bot',
          buttons: selectionButtons,
          headerType: 4
        }, { quoted: m })

        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
        return sentMsg
      } catch (e) {
        console.error('Errore thumbnail tp:', e)
        if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
        // continua sotto e manda senza immagine
      }
    }

    return conn.sendMessage(m.key.remoteJid, {
      text: listText,
      footer: 'Zeno Bot',
      buttons: selectionButtons
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
