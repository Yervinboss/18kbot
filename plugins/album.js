// plugins/album.js - VERSIONE YOUTUBE (FUNZIONANTE)
import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const albumCache = {}
const playlistDbPath = path.join(__dirname, '../playlist_db.json')

const readDb = (p) => {
    if (!fs.existsSync(p)) return {}
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { return {} }
}
const writeDb = (data, p) => {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

// ============================================================
// RICERCA SU YOUTUBE
// ============================================================
const searchAlbumTracks = async (albumName, artistName = '') => {
    const queries = [
        `${artistName} ${albumName} full album`.trim(),
        `${albumName} ${albumName} tracklist`.trim(),
        `${albumName} ${albumName} official audio`.trim(),
        `${artistName} ${albumName} songs`.trim()
    ]
    
    let allResults = []
    const seen = new Set()
    
    for (let query of queries) {
        if (!query) continue
        try {
            const search = await yts(query)
            const videos = search.videos || []
            
            for (let v of videos) {
                if (!v || !v.title || !v.url) continue
                if (seen.has(v.url)) continue
                
                const title = v.title.toLowerCase()
                const duration = v.timestamp || ''
                
                // Filtra reaction e video spazzatura
                const isReaction = title.includes('reaction') || 
                                  title.includes('reagisco') || 
                                  title.includes('recensione') ||
                                  title.includes('review') ||
                                  title.includes('intervista') ||
                                  title.includes('interview') ||
                                  title.includes('documentario') ||
                                  title.includes('documentary') ||
                                  title.includes('analisi')
                
                if (isReaction) continue
                
                // Durata tra 1 e 12 minuti (canzoni vere)
                if (duration && duration.includes(':')) {
                    const parts = duration.split(':')
                    const minutes = parseInt(parts[0]) || 0
                    if (minutes > 12 || minutes < 1) continue
                }
                
                seen.add(v.url)
                allResults.push(v)
            }
            
            if (allResults.length >= 25) break
        } catch (e) {}
    }
    
    return allResults
}

// ============================================================
// INVIA PAGINA ALBUM
// ============================================================
const sendAlbumPage = async (conn, jid, sender, m, page = 0) => {
    const cacheKey = `album_${jid}_${sender}`
    const albumData = albumCache[cacheKey]

    if (!albumData || !albumData.tracks) {
        return await conn.sendMessage(jid, { text: '❌ Album scaduto. Cerca di nuovo con .album' }, { quoted: m })
    }

    const tracks = albumData.tracks
    const pageSize = 10
    const start = page * pageSize
    const end = Math.min(start + pageSize, tracks.length)
    const pageTracks = tracks.slice(start, end)
    const totalPages = Math.ceil(tracks.length / pageSize)

    let albumInfo = `💿 *ALBUM: ${albumData.title}*\n` +
                    (albumData.artist ? `👤 *Artista:* ${albumData.artist}\n` : '') +
                    `\n📋 *Tracce (${start + 1}-${end} di ${tracks.length}):*`

    let rows = pageTracks.map((track, idx) => {
        const absoluteIdx = start + idx
        return {
            title: `${absoluteIdx + 1}. ${track.title}`,
            rowId: `.album_select_${absoluteIdx}`,
            description: `⏱ ${track.timestamp || '--:--'}`
        }
    })

    if (page + 1 < totalPages) {
        rows.push({
            title: `➡️ MOSTRA ALTRE (${tracks.length - end} rimanenti)`,
            rowId: `.album_page_${page + 1}`,
            description: 'Vai alla pagina successiva'
        })
    } else if (page > 0) {
        rows.push({
            title: `⬅️ TORNA ALLA PRIMA PAGINA`,
            rowId: `.album_page_0`,
            description: 'Torna all\'inizio'
        })
    }

    rows.push({
        title: '➕ AGGIUNGI TUTTO ALLA PLAYLIST',
        rowId: '.album_add_all',
        description: `Salva tutte le ${tracks.length} tracce`
    })

    let sections = [{
        title: `🎵 Tracce (Pagina ${page + 1}/${totalPages})`,
        rows: rows
    }]

    await conn.sendMessage(jid, {
        text: albumInfo,
        footer: 'Zeno Bot • Album Player',
        title: '📂 Scegli una traccia',
        buttonText: '🎵 Vedi Tracce',
        sections
    }, { quoted: m })
}

// ============================================================
// HANDLER PRINCIPALE
// ============================================================
let handler = async (m, { conn, text, command }) => {
    const jid = m.key.remoteJid
    const sender = m.key.fromMe ? jid : (m.sender || m.key.participant || m.participant || jid)

    const selectedCmd = command ? `.${command}` : ''
    const fullCmd = (text) ? `${selectedCmd} ${text}` : selectedCmd
    const cleanCmd = fullCmd.trim().toLowerCase()

    // 1. SELEZIONE TRACCIA
    if (cleanCmd.startsWith('.album_select_') || command?.startsWith('album_select_')) {
        const indexStr = cleanCmd.replace('.album_select_', '').replace('album_select_', '').trim()
        const trackIndex = parseInt(indexStr)
        const cacheKey = `album_${jid}_${sender}`
        const albumData = albumCache[cacheKey]

        if (!albumData || !albumData.tracks || !albumData.tracks[trackIndex]) {
            return await conn.sendMessage(jid, { text: '❌ Album scaduto.' }, { quoted: m })
        }

        const track = albumData.tracks[trackIndex]
        await conn.sendMessage(jid, { react: { text: '🎧', key: m.key } })

        const timestamp = Date.now()
        const inputMp3 = path.join(__dirname, `_temp_album_${timestamp}.mp3`)
        const outputOgg = path.join(__dirname, `vocale_album_${timestamp}.ogg`)

        const ytCmd = `yt-dlp -x --audio-format mp3 --audio-quality 128k --no-part --extractor-args youtube:player-client=android,web -o "${inputMp3}" "${track.url}"`

        exec(ytCmd, async (error) => {
            if (error) {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3)
                return await conn.sendMessage(jid, { text: '❌ Errore download.' }, { quoted: m })
            }

            const ffmpegCmd = `ffmpeg -y -i "${inputMp3}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 -threads 0 -f ogg "${outputOgg}"`

            exec(ffmpegCmd, async (err2) => {
                if (fs.existsSync(inputMp3)) fs.unlinkSync(inputMp3)

                if (err2 || !fs.existsSync(outputOgg)) {
                    if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg)
                    return await conn.sendMessage(jid, { text: '❌ Errore conversione.' }, { quoted: m })
                }

                try {
                    await conn.sendMessage(jid, {
                        audio: fs.readFileSync(outputOgg),
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, { quoted: m })
                } catch (e) {
                    console.error(e)
                } finally {
                    setTimeout(() => { if (fs.existsSync(outputOgg)) fs.unlinkSync(outputOgg) }, 5000)
                }
            })
        })
        return
    }

    // 2. CAMBIO PAGINA
    if (cleanCmd.startsWith('.album_page_') || command?.startsWith('album_page_')) {
        const pageStr = cleanCmd.replace('.album_page_', '').replace('album_page_', '').trim()
        const pageNum = parseInt(pageStr) || 0
        return await sendAlbumPage(conn, jid, sender, m, pageNum)
    }

    // 3. AGGIUNGI TUTTO ALLA PLAYLIST
    if (cleanCmd === '.album_add_all' || command === 'album_add_all') {
        const cacheKey = `album_${jid}_${sender}`
        const albumData = albumCache[cacheKey]

        if (!albumData || !albumData.tracks) {
            return await conn.sendMessage(jid, { text: '❌ Album scaduto.' }, { quoted: m })
        }

        let plDb = readDb(playlistDbPath)
        if (!plDb[sender]) plDb[sender] = []

        let addedCount = 0
        let alreadyExists = 0

        albumData.tracks.forEach(track => {
            const exists = plDb[sender].some(t => t.url === track.url)
            if (!exists) {
                plDb[sender].push({
                    title: track.title,
                    url: track.url,
                    duration: track.timestamp || '--:--'
                })
                addedCount++
            } else {
                alreadyExists++
            }
        })

        writeDb(plDb, playlistDbPath)

        await conn.sendMessage(jid, {
            text: `✅ *Aggiunti ${addedCount} brani* alla playlist!\n` +
                  (alreadyExists > 0 ? `⚠️ ${alreadyExists} già presenti (saltati)\n` : '') +
                  `\n📌 *Album:* ${albumData.title}\n` +
                  `👤 *Artista:* ${albumData.artist}\n\n` +
                  `💡 Usa .pl per ascoltarli!`
        }, { quoted: m })

        delete albumCache[cacheKey]
        return
    }

    // 4. RICERCA ALBUM
    if (!text) {
        return await conn.sendMessage(jid, {
            text: '🎵 *Cerca un album*\n\nEsempio: .album Kid Yugi - L\'alba\n.album Tutti i nomi del diavolo'
        }, { quoted: m })
    }

    await conn.sendMessage(jid, { react: { text: '🔍', key: m.key } })

    try {
        let artistName = ''
        let albumName = text
        
        if (text.includes(' - ')) {
            const parts = text.split(' - ')
            artistName = parts[0].trim()
            albumName = parts[1].trim()
        }

        const results = await searchAlbumTracks(albumName, artistName)

        if (!results.length) {
            return await conn.sendMessage(jid, {
                text: `❌ Nessuna traccia trovata per: "${text}"\n\n💡 Prova: .album Artista - Album`
            }, { quoted: m })
        }

        const cacheKey = `album_${jid}_${sender}`
        albumCache[cacheKey] = {
            title: albumName,
            artist: artistName || 'Sconosciuto',
            tracks: results,
            timestamp: Date.now()
        }

        setTimeout(() => { delete albumCache[cacheKey] }, 300000)

        await sendAlbumPage(conn, jid, sender, m, 0)

    } catch (error) {
        console.error('Errore album:', error)
        await conn.sendMessage(jid, {
            text: '❌ Errore nella ricerca. Riprova!'
        }, { quoted: m })
    }
}

handler.command = /^(album|album_select_\d+|album_page_\d+|album_add_all)$/i

handler.all = async function (m, { conn }) {
    if (m.isBaileys || !m.message) return

    let rowId = ''
    if (m.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
        rowId = m.message.listResponseMessage.singleSelectReply.selectedRowId
    } else if (m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonReplyValue) {
        try {
            const jsonReply = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.buttonReplyValue)
            rowId = jsonReply.id || jsonReply.rowId || ''
        } catch (e) {}
    }

    if (rowId && (rowId.startsWith('.album_select_') || rowId.startsWith('.album_page_') || rowId === '.album_add_all')) {
        const cleanCmd = rowId.replace('.', '')
        m.sender = m.key.fromMe ? m.key.remoteJid : (m.key.participant || m.participant || m.key.remoteJid)

        if (cleanCmd.startsWith('album_select_')) {
            const parts = cleanCmd.split('_')
            return await this.plugins['album.js'].handler(m, { conn, text: `select_${parts[2]}`, command: 'album' })
        } else if (cleanCmd.startsWith('album_page_')) {
            const parts = cleanCmd.split('_')
            return await this.plugins['album.js'].handler(m, { conn, text: `page_${parts[2]}`, command: 'album' })
        } else if (cleanCmd === 'album_add_all') {
            return await this.plugins['album.js'].handler(m, { conn, text: '', command: 'album_add_all' })
        }
    }
}

handler.help = ['album']
handler.tags = ['musica']

export default handler
