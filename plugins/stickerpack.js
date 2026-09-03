import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import yts from 'yt-search'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return conn.sendMessage(m.key.remoteJid, { 
      text: `❌ Inserisci il nome o il soggetto!\nEsempio: \`${usedPrefix}${command} gatto\` oppure \`${usedPrefix}${command} Tony Boy\`` 
    }, { quoted: m })
  }

  await conn.sendMessage(m.key.remoteJid, { react: { text: '🎨', key: m.key } })

  try {
    // Cerchiamo i video correlati per estrarre le copertine (thumbnail) che sono sempre perfette
    let search = await yts(text)
    let results = search.videos.slice(0, 5) // Prendiamo i primi 5 risultati

    if (!results || results.length === 0) {
      return conn.sendMessage(m.key.remoteJid, { text: `❌ Nessuna immagine trovata per "${text}".` }, { quoted: m })
    }

    await conn.sendMessage(m.key.remoteJid, { text: `📦 Trovati ${results.length} sticker per *${text}*. Li sto creando...` }, { quoted: m })

    for (let i = 0; i < results.length; i++) {
      let video = results[i]
      let imgUrl = video.thumbnail // Usiamo la thumbnail del video di YouTube
      if (!imgUrl) continue

      let ts = Date.now() + i
      let imgPath = path.join(os.tmpdir, `stk_${ts}.jpg`)
      let webpPath = path.join(os.tmpdir, `stk_${ts}.webp`)

      try {
        let imgRes = await fetch(imgUrl)
        if (!imgRes.ok) continue
        let buffer = Buffer.from(await imgRes.arrayBuffer())
        fs.writeFileSync(imgPath, buffer)

        // Convertiamo l'immagine in sticker webp trasparente con ffmpeg
        await new Promise((resolve, reject) => {
          exec(`ffmpeg -y -i "${imgPath}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=transparent@0" -an -lossless 1 "${webpPath}"`, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })

        // Invia lo sticker
        if (fs.existsSync(webpPath)) {
          await conn.sendMessage(m.key.remoteJid, { sticker: fs.readFileSync(webpPath) }, { quoted: m })
        }

        // Pulisce i file temporanei
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath)
        if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath)

      } catch (err) {
        console.log("Errore conversione singolo sticker:", err)
      }
    }

    await conn.sendMessage(m.key.remoteJid, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error(e)
    await conn.sendMessage(m.key.remoteJid, { text: `❌ Errore durante la creazione del pacchetto sticker.` }, { quoted: m })
  }
}

handler.command = /^(pack|stk|stickerpack)$/i
handler.help = ['pack <testo>']
handler.tags = ['fun']

export default handler
