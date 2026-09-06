import yts from 'yt-search'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

global.tpSelection = global.tpSelection || {}

const getThumbnail = (video) => video?.thumbnail || video?.image || video?.images?.[0] || 'icone/333.jpg'

// Funzione di supporto per gestire la logica di download e invio del brano
async function processTpSelection(conn, m, queryText) {
  let indexNum = Number(queryText)
  if (isNaN(indexNum)) {
    indexNum = Number(queryText.replace('tp_select', '').trim())
  }

  const results = global.tpSelection[m.sender]

  if (!results?.length) {
    return conn.sendMessage(m.key.remoteJid, { 
      text: "❌ Nessuna selezione attiva. Cerca prima con `.tp nome`." 
    }, { quoted: m })
  }
  
  if (!Number.isInteger(indexNum) || indexNum < 1 || indexNum > results.length) {
    return conn.sendMessage(m.key.remoteJid, { 
      text: "❌ Seleziona un numero valido tra i risultati mostrati." 
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
  let cleanText = (text || '').trim()
  cleanText = cleanText.replace(/@[^\s]+/g, '').trim()
  
  let action = (command || '').trim().toLowerCase()
  let query = cleanText

  let buttonId = 
      m.message?.buttonsResponseMessage?.selectedButtonId ||
      m.message?.templateButtonReplyMessage?.selectedId ||
      m.msg?.selectedButtonId ||
      m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson

  if (buttonId) {
      try {
          let parsed = JSON.parse(buttonId)
          if (parsed.id) action = parsed.id.trim().toLowerCase()
      } catch (e) {
          action = buttonId.trim().toLowerCase()
      }
  }

  if (action.startsWith('tp_select') || query.startsWith('tp_select') || action.startsWith('.tp_select')) {
      let fullStr = action
      if (fullStr.startsWith('.tp_select')) fullStr = fullStr.substring(1)
      if (!fullStr.startsWith('tp_select') && query.startsWith('tp_select')) fullStr = query
      if (!fullStr.startsWith('tp_select') && query.startsWith('.tp_select')) fullStr = query.substring(1)
      let parts = fullStr.split(/\s+/)
      action = 'tp_select'
      if (parts[1]) query = parts[1]
  }

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

    global.tpSelection[m.sender] = results

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

  if (action === 'tp_select') {
    return await processTpSelection(conn, m, query)
  }
}

// 🔥 AGGIUNTO IL messageHook: Intercetta i click sui bottoni prima che il main.js li blocchi
handler.messageHook = async (conn, m) => {
    let buttonId = 
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.templateButtonReplyMessage?.selectedId ||
        m.msg?.selectedButtonId ||
        m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson

    if (buttonId) {
        let action = buttonId
        try {
            let parsed = JSON.parse(buttonId)
            if (parsed.id) action = parsed.id
        } catch (e) {}

        if (action.includes('tp_select')) {
            let parts = action.trim().split(/\s+/)
            let queryNum = parts[1] || action.replace('tp_select', '').trim()
            await processTpSelection(conn, m, queryNum)
        }
    }
}

handler.command = /^(tp|tp_select)$/i
handler.help = ['tp']
handler.tags = ['music']

export default handler
