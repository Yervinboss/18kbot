import os from 'os'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function formatUptime(seconds) {
    let d = Math.floor(seconds / 86400)
    let h = Math.floor((seconds % 86400) / 3600)
    let m = Math.floor((seconds % 3600) / 60)
    let s = Math.floor(seconds % 60)
    let parts = []
    if (d > 0) parts.push(`${d}g`)
    if (h > 0) parts.push(`${h}h`)
    if (m > 0) parts.push(`${m}m`)
    parts.push(`${s}s`)
    return parts.join(' ')
}

function formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

let handler = async (m, { conn }) => {
    let chatId = m.key.remoteJid
    let start = Date.now()

    let pluginFolder = path.join(__dirname)
    let pluginCount = 0
    try {
        pluginCount = fs.readdirSync(pluginFolder).filter(f => f.endsWith('.js')).length
    } catch (e) {
        pluginCount = '?'
    }

    let usedMem = process.memoryUsage().rss
    let totalMem = os.totalmem()
    let uptime = process.uptime()

    let sentMsg = await conn.sendMessage(chatId, { text: '🏓 Calcolo ping...' }, { quoted: m })
    let latency = Date.now() - start

    let txt = `╭━━━〔 *ZENO BOT STATUS* 〕━━━⬣\n`
    txt += `┃ 🏓 *Ping:* ${latency} ms\n`
    txt += `┃ ⏱️ *Uptime:* ${formatUptime(uptime)}\n`
    txt += `┃ 🔌 *Plugin caricati:* ${pluginCount}\n`
    txt += `┃ 💾 *RAM usata:* ${formatBytes(usedMem)}\n`
    txt += `┃ 🖥️ *RAM totale sistema:* ${formatBytes(totalMem)}\n`
    txt += `┃ ⚙️ *Node.js:* ${process.version}\n`
    txt += `┃ 📱 *Piattaforma:* ${os.platform()} (${os.arch()})\n`
    txt += `╰━━━━━━━━━━━━━━━━━━━━━━⬣`

    return conn.sendMessage(chatId, { text: txt, edit: sentMsg.key }, { quoted: m })
        .catch(() => conn.sendMessage(chatId, { text: txt }, { quoted: m }))
}

handler.command = /^(ping|stats|status)$/i
handler.help = ['ping']
handler.tags = ['info']

export default handler
