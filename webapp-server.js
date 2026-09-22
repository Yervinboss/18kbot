// webapp-server.js - Zeno Music v10
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import yts from 'yt-search';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const DB_PATH = path.join(__dirname, 'users.json');
function loadUsers() {
    if (!fs.existsSync(DB_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}
function saveUsers(u) {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(u, null, 2), 'utf8'); } catch (e) { console.error('Errore salvataggio:', e); }
}
let users = loadUsers();
console.log(`[WebApp] Caricati ${Object.keys(users).length} utenti dal database.`);

global.pendingTokens = global.pendingTokens || {};
global.resetCodes = global.resetCodes || {};

function trovaUtentePerNumero(phone) {
    const clean = phone.replace(/[^0-9]/g, '');
    for (const [u, d] of Object.entries(users)) {
        if (d.phone.replace(/[^0-9]/g, '') === clean) return u;
    }
    return null;
}
function formatDur(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
}

app.post('/verify-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token mancante' });
    const data = global.pendingTokens[token.trim().toUpperCase()];
    if (!data) return res.status(404).json({ error: 'Token non valido o scaduto' });
    if (Date.now() - data.createdAt > 10 * 60 * 1000) {
        delete global.pendingTokens[token.trim().toUpperCase()];
        return res.status(410).json({ error: 'Token scaduto, richiedi .mix di nuovo' });
    }
    res.json({ success: true, phone: data.phone });
});

app.post('/register', (req, res) => {
    const { username, password, token, profilePic } = req.body;
    if (!username || !password || !token) return res.status(400).json({ error: 'Dati mancanti' });
    if (users[username]) return res.status(409).json({ error: 'Utente gia esistente' });
    const tok = token.trim().toUpperCase();
    const data = global.pendingTokens[tok];
    if (!data) return res.status(404).json({ error: 'Token non valido o scaduto' });
    if (Date.now() - data.createdAt > 10 * 60 * 1000) {
        delete global.pendingTokens[tok];
        return res.status(410).json({ error: 'Token scaduto, richiedi .mix di nuovo' });
    }
    const phone = data.phone;
    const esistente = trovaUtentePerNumero(phone);
    if (esistente) return res.status(409).json({ error: 'Questo numero e gia registrato come "' + esistente + '"' });
    users[username] = { password, phone: '+' + phone, profilePic: profilePic || null, createdAt: Date.now(), history: [], playlist: [] };
    saveUsers(users);
    delete global.pendingTokens[tok];
    console.log('[WebApp] Nuovo utente: ' + username + ' (+' + phone + ')');
    res.json({ success: true, phone: '+' + phone });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        res.json({ success: true, username, phone: users[username].phone, profilePic: users[username].profilePic });
    } else {
        res.status(401).json({ error: 'Credenziali sbagliate' });
    }
});

app.post('/forgot-password', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Numero mancante' });
    const foundUser = trovaUtentePerNumero(phone);
    if (!foundUser) return res.status(404).json({ error: 'Numero non registrato' });
    if (!global.zenoConn) return res.status(503).json({ error: 'Bot non connesso, riprova tra poco' });
    const user = users[foundUser];
    const code = String(Math.floor(100000 + Math.random() * 900000));
    global.resetCodes[foundUser] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
    try {
        const jid = user.phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        const msg = 'ZENO MUSIC\n\nIl tuo codice di recupero password e:\n\n*' + code + '*\n\nScade tra 10 minuti.';
        await global.zenoConn.sendMessage(jid, { text: msg });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Errore invio codice' });
    }
});

app.post('/reset-password', (req, res) => {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) return res.status(400).json({ error: 'Dati mancanti' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Password troppo corta' });
    const foundUser = trovaUtentePerNumero(phone);
    if (!foundUser) return res.status(404).json({ error: 'Numero non registrato' });
    const data = global.resetCodes[foundUser];
    if (!data) return res.status(404).json({ error: 'Nessuna richiesta attiva' });
    if (Date.now() > data.expiresAt) {
        delete global.resetCodes[foundUser];
        return res.status(410).json({ error: 'Codice scaduto' });
    }
    if (data.code !== code.trim()) return res.status(401).json({ error: 'Codice errato' });
    users[foundUser].password = newPassword;
    saveUsers(users);
    delete global.resetCodes[foundUser];
    res.json({ success: true });
});

app.post('/now-playing', async (req, res) => {
    const { username, songTitle, songUrl, songArtist, mode, thumbnail } = req.body;
    if (!username || !songTitle) return res.status(400).json({ error: 'Dati mancanti' });
    const user = users[username];
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    if (!user.history) user.history = [];
    const videoId = songUrl ? (songUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1] : null;
    user.history.unshift({
        title: songTitle,
        artist: songArtist || '',
        url: songUrl || '',
        videoId: videoId || '',
        thumbnail: thumbnail || (videoId ? 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg' : ''),
        mode: mode || 'video',
        listenedAt: Date.now()
    });
    if (user.history.length > 50) user.history = user.history.slice(0, 50);
    saveUsers(users);

    if (!global.zenoConn) return res.status(503).json({ error: 'Bot non connesso' });
    try {
        const jid = user.phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        const modalita = mode === 'audio' ? 'Solo Audio' : 'Video';
        const message = 'ZENO MUSIC\n\n' + username + ' sta ascoltando:\n\n' + songTitle + (songArtist ? '\n' + songArtist : '') + '\n' + modalita + '\n' + songUrl;
        await global.zenoConn.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Errore invio messaggio' });
    }
});

app.get('/history', (req, res) => {
    const { username } = req.query;
    if (!username || !users[username]) return res.status(404).json({ error: 'Utente non trovato' });
    res.json({ success: true, history: users[username].history || [] });
});

app.post('/history/clear', (req, res) => {
    const { username } = req.body;
    if (!username || !users[username]) return res.status(404).json({ error: 'Utente non trovato' });
    users[username].history = [];
    saveUsers(users);
    res.json({ success: true });
});

app.get('/playlist', (req, res) => {
    const { username } = req.query;
    if (!username || !users[username]) return res.status(404).json({ error: 'Utente non trovato' });
    res.json({ success: true, playlist: users[username].playlist || [] });
});

app.post('/playlist/remove', (req, res) => {
    const { username, index } = req.body;
    if (!username || !users[username]) return res.status(404).json({ error: 'Utente non trovato' });
    if (!users[username].playlist) users[username].playlist = [];
    if (index < 0 || index >= users[username].playlist.length) return res.status(400).json({ error: 'Indice non valido' });
    users[username].playlist.splice(index, 1);
    saveUsers(users);
    res.json({ success: true });
});

app.post('/playlist/import', (req, res) => {
    const { username, url } = req.body;
    if (!username || !users[username]) return res.status(404).json({ error: 'Utente non trovato' });
    if (!url) return res.status(400).json({ error: 'URL mancante' });
    let tipo = 'youtube';
    if (url.includes('spotify.com')) tipo = 'spotify';
    else if (!url.includes('youtube.com') && !url.includes('youtu.be')) return res.status(400).json({ error: 'Link non supportato' });
    if (!users[username].playlist) users[username].playlist = [];
    res.json({ success: true });
    if (tipo === 'youtube') importFromYouTube(username, url);
    else importFromSpotify(username, url);
});

function importFromYouTube(username, url) {
    const cmd = 'yt-dlp --flat-playlist --dump-json --no-warnings "' + url + '"';
    exec(cmd, { maxBuffer: 1024 * 1024 * 20, timeout: 120000 }, (err, stdout) => {
        if (err) { console.error('[Import YT] Errore:', err.message); return; }
        const lines = stdout.trim().split('\n').filter(l => l.trim());
        let added = 0;
        for (const line of lines) {
            try {
                const info = JSON.parse(line);
                const videoId = info.id;
                if (!videoId || videoId.length !== 11) continue;
                if (users[username].playlist.some(t => t.videoId === videoId)) continue;
                users[username].playlist.push({
                    videoId, title: info.title || 'Brano sconosciuto',
                    artist: info.uploader || info.channel || '',
                    url: 'https://youtu.be/' + videoId,
                    thumbnail: 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg',
                    duration: info.duration ? formatDur(info.duration) : ''
                });
                added++;
            } catch (e) {}
        }
        saveUsers(users);
        console.log('[Import YT] Aggiunti ' + added + ' brani per ' + username);
    });
}

function importFromSpotify(username, url) {
    fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' } })
        .then(r => r.text())
        .then(async html => {
            const matches = html.match(/"name":"([^"]{2,80})"/g) || [];
            const titles = [...new Set(matches.map(m => m.replace(/"name":"/g, '').replace(/"$/g, '')))].slice(0, 50);
            let added = 0;
            for (const title of titles) {
                try {
                    const search = await yts(title);
                    if (search && search.videos && search.videos.length > 0) {
                        const v = search.videos[0];
                        if (users[username].playlist.some(t => t.videoId === v.videoId)) continue;
                        users[username].playlist.push({
                            videoId: v.videoId, title: v.title,
                            artist: (v.author && v.author.name) ? v.author.name : '',
                            url: v.url, thumbnail: v.thumbnail, duration: v.timestamp || ''
                        });
                        added++;
                    }
                } catch (e) {}
            }
            saveUsers(users);
            console.log('[Import Spotify] Aggiunti ' + added + ' brani per ' + username);
        })
        .catch(e => console.error('[Import Spotify] Errore:', e.message));
}

app.get('/search', async (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Query troppo corta' });
    try {
        const results = await yts(q);
        const videos = (results.videos || []).slice(0, 12).map(v => ({
            videoId: v.videoId, title: v.title, thumbnail: v.thumbnail,
            timestamp: v.timestamp, author: (v.author && v.author.name) ? v.author.name : ''
        }));
        res.json({ success: true, results: videos });
    } catch (e) {
        res.status(500).json({ error: 'Errore ricerca' });
    }
});

app.get('/status', (req, res) => {
    res.json({ status: 'ok', botConnesso: !!global.zenoConn, utenti: Object.keys(users).length });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zeno Music</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:#fff;min-height:100vh;padding:20px;padding-bottom:40px;padding-top:60px}
.container{max-width:480px;margin:0 auto}
h1{text-align:center;font-size:34px;margin-bottom:26px;background:linear-gradient(90deg,#1DB954,#1ed760,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800}
.card{background:rgba(255,255,255,0.06);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:22px;margin-bottom:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:fadeIn .4s}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
h2{font-size:19px;margin-bottom:14px;color:#1DB954}
input,button{width:100%;padding:14px 16px;margin:6px 0;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#fff;font-size:15px;font-family:inherit;transition:all .2s}
input:focus{outline:none;border-color:#1DB954;background:rgba(0,0,0,0.5)}
button{background:linear-gradient(135deg,#1DB954,#1ed760);color:#000;font-weight:700;border:none;cursor:pointer;margin-top:10px;font-size:15px}
button:active{transform:scale(.98)}
button:disabled{opacity:.4;cursor:not-allowed}
button.secondary{background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.15)}
.row{display:flex;gap:8px}
.row button{margin-top:0}
.hidden{display:none}
.msg{text-align:center;margin-top:10px;min-height:20px;font-size:13px}
.msg.err{color:#ff6b6b}
.msg.ok{color:#1ed760}
.link{color:#1DB954;text-decoration:none;cursor:pointer}
.avatar-upload{display:flex;flex-direction:column;align-items:center;margin-bottom:14px}
.avatar-preview{width:90px;height:90px;border-radius:50%;background:#222;border:3px solid #1DB954;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:32px;overflow:hidden}
.avatar-preview img{width:100%;height:100%;object-fit:cover}
.avatar-hint{font-size:12px;color:#888;margin-top:8px}
#ytPlayer{margin-top:14px;border-radius:12px;overflow:hidden}
#ytPlayer iframe{display:block;border-radius:12px}
.search-results{margin-top:12px;max-height:340px;overflow-y:auto}
.search-item{display:flex;gap:10px;padding:8px;border-radius:10px;cursor:pointer;margin-bottom:4px}
.search-item:hover,.search-item:active{background:rgba(29,185,84,0.15)}
.search-item img{width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0}
.search-item-info{flex:1;min-width:0}
.search-item-title{font-size:13px;font-weight:600;line-height:1.3}
.search-item-meta{font-size:11px;color:#888;margin-top:3px}
.now-playing-info{text-align:center;margin-top:14px;padding:14px;background:rgba(29,185,84,0.12);border-radius:12px;border:1px solid rgba(29,185,84,0.3)}
.now-playing-info .title{color:#1ed760;font-weight:600;font-size:15px}
.now-playing-info .artist{color:#aaa;font-size:13px;margin-top:4px}
.switch-line{text-align:center;margin-top:14px;font-size:14px;color:#888}
.audio-visual{display:flex;align-items:center;gap:14px;padding:16px;background:rgba(0,0,0,0.4);border-radius:12px;margin-top:14px}
.audio-visual img{width:80px;height:80px;border-radius:10px;object-fit:cover;flex-shrink:0}
.audio-visual .info{flex:1;min-width:0}
.audio-visual .title{font-size:14px;font-weight:600;line-height:1.3}
.audio-visual .artist{font-size:12px;color:#aaa;margin-top:4px}
.mini-player{margin-top:12px;border-radius:10px;overflow:hidden;background:#000;height:80px}
.mini-player iframe{display:block;width:100%;height:80px}
.token-box{background:rgba(29,185,84,0.15);border:1px dashed #1DB954;border-radius:10px;padding:10px;text-align:center;font-size:13px;color:#1ed760;margin-bottom:10px}
.user-badge{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:10px;background:rgba(29,185,84,0.08);border-radius:14px;border:1px solid rgba(29,185,84,0.2)}
.user-badge img{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #1DB954;flex-shrink:0;background:#222}
.user-badge h2{font-size:17px;margin-bottom:2px}
.user-status{font-size:11px;color:#888;margin-left:2px}
.info-note{text-align:center;font-size:13px;color:#aaa;margin-bottom:12px;line-height:1.5}
.code-input{text-align:center;letter-spacing:8px;font-size:22px;font-weight:700}
.hamburger{position:fixed;top:14px;left:14px;width:44px;height:44px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;z-index:1000;backdrop-filter:blur(10px);color:#fff}
.hamburger:active{transform:scale(.95)}
.sidebar{position:fixed;top:0;left:-320px;width:320px;max-width:85%;height:100vh;background:linear-gradient(180deg,#1a1a2e,#0f0c29);border-right:1px solid rgba(255,255,255,0.1);z-index:999;transition:left .3s ease;overflow-y:auto;box-shadow:4px 0 30px rgba(0,0,0,0.5)}
.sidebar.open{left:0}
.sidebar-header{padding:20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{margin:0;font-size:18px;background:linear-gradient(90deg,#1DB954,#1ed760);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.close-btn{background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer;padding:4px 10px;width:auto;margin:0;font-weight:400}
.sidebar-tabs{display:flex;padding:12px;gap:6px;border-bottom:1px solid rgba(255,255,255,0.1)}
.sidebar-tab{flex:1;padding:10px 6px;background:rgba(255,255,255,0.05);border:none;border-radius:10px;color:#fff;font-size:12px;cursor:pointer;font-weight:600;margin:0}
.sidebar-tab.active{background:linear-gradient(135deg,#1DB954,#1ed760);color:#000}
.sidebar-content{padding:16px}
.sb-item{display:flex;gap:10px;padding:8px;border-radius:10px;cursor:pointer;margin-bottom:6px;align-items:center;transition:background .15s}
.sb-item:hover,.sb-item:active{background:rgba(29,185,84,0.15)}
.sb-item img{width:60px;height:45px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#222}
.sb-item-info{flex:1;min-width:0}
.sb-item-title{font-size:13px;font-weight:600;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sb-item-meta{font-size:11px;color:#888;margin-top:3px}
.sb-remove{background:transparent;border:none;color:#ff6b6b;font-size:16px;cursor:pointer;padding:4px 8px;width:auto;margin:0;flex-shrink:0;font-weight:400}
.sb-empty{text-align:center;color:#666;font-size:13px;padding:24px 12px;line-height:1.5}
.sb-input{font-size:13px;padding:10px 12px}
.overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:998;display:none}
.overlay.show{display:block}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#1DB954;border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<div class="hamburger" onclick="toggleSidebar()">&#9776;</div>
<div class="overlay" id="overlay" onclick="toggleSidebar()"></div>

<div class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <h2>Zeno Music</h2>
    <button class="close-btn" onclick="toggleSidebar()">X</button>
  </div>
  <div class="sidebar-tabs">
    <button class="sidebar-tab active" onclick="switchTab('history')" id="tab-history">Cronologia</button>
    <button class="sidebar-tab" onclick="switchTab('playlist')" id="tab-playlist">Playlist</button>
  </div>
  <div class="sidebar-content" id="sidebarContent">
    <p class="sb-empty">Caricamento...</p>
  </div>
</div>

<div class="container">
<h1>Zeno Music</h1>

<div id="registerCard" class="card">
  <h2>Registrati</h2>
  <div class="avatar-upload">
    <div class="avatar-preview" id="avatarPreview" onclick="document.getElementById('avatarInput').click()">+</div>
    <input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="handleAvatar(event)">
    <div class="avatar-hint">Tocca per caricare la foto profilo</div>
  </div>
  <div class="token-box">Hai ricevuto un token dal bot con <b>.mix</b>? Incollalo qui sotto.</div>
  <input type="text" id="regToken" placeholder="Token (es. ZENO-A3F8K9)" style="text-transform:uppercase">
  <input type="text" id="regUser" placeholder="Nome utente">
  <input type="password" id="regPass" placeholder="Password">
  <button onclick="verifyAndRegister()" id="regBtn">Verifica Token e Registrati</button>
  <p id="regMsg" class="msg"></p>
  <div class="switch-line">Hai gia un account? <a class="link" onclick="showLogin()">Accedi</a></div>
</div>

<div id="loginCard" class="card hidden">
  <h2>Accedi</h2>
  <input type="text" id="logUser" placeholder="Nome utente">
  <input type="password" id="logPass" placeholder="Password">
  <button onclick="login()" id="logBtn">Accedi</button>
  <p id="logMsg" class="msg"></p>
  <div class="switch-line">Non hai un account? <a class="link" onclick="showRegister()">Registrati</a></div>
  <div class="switch-line"><a class="link" onclick="showForgot()">Password dimenticata?</a></div>
</div>

<div id="forgotCard" class="card hidden">
  <h2>Recupera Password</h2>
  <div id="forgotStep1">
    <p class="info-note">Inserisci il tuo <b>numero WhatsApp</b> (quello con cui ti sei registrato).<br>Ti manderemo un codice di 6 cifre in privato dal bot.</p>
    <input type="tel" id="forgotPhone" placeholder="Numero WhatsApp (es. +393331234567)">
    <button onclick="sendResetCode()" id="forgotBtn">Invia codice su WhatsApp</button>
  </div>
  <div id="forgotStep2" class="hidden">
    <p class="info-note" style="color:#1ed760">Codice inviato! Controlla WhatsApp.</p>
    <input type="text" id="resetCode" class="code-input" placeholder="______" maxlength="6" inputmode="numeric">
    <input type="password" id="resetPass" placeholder="Nuova password">
    <button onclick="resetPassword()" id="resetBtn">Reimposta Password</button>
  </div>
  <p id="forgotMsg" class="msg"></p>
  <div class="switch-line"><a class="link" onclick="showLogin()">&larr; Torna al login</a></div>
</div>

<div id="playerCard" class="hidden">
  <div class="card">
    <div class="user-badge">
      <img id="userAvatar" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23333' width='100' height='100'/></svg>" alt="Avatar">
      <div>
        <h2 style="margin-bottom:2px">Ciao, <span id="welcomeUser" style="color:#1ed760"></span>!</h2>
        <span class="user-status">Pronto ad ascoltare</span>
      </div>
    </div>
    <h2>Cerca una canzone</h2>
    <input type="text" id="searchInput" placeholder="Nome canzone o artista..." onkeydown="if(event.key==='Enter') searchSongs()">
    <button onclick="searchSongs()" id="searchBtn">Cerca</button>
    <div id="searchResults" class="search-results"></div>
  </div>
  <div class="card">
    <h2>Oppure incolla link</h2>
    <input type="text" id="songUrl" placeholder="Link YouTube" oninput="onUrlChange()">
    <button onclick="loadVideo()" id="loadBtn" class="secondary">Carica dal link</button>
    <div id="ytPlayer"></div>
    <div id="audioView" class="hidden"></div>
    <div id="modeButtons" class="hidden">
      <div class="row" style="margin-top:12px">
        <button onclick="notifyBot('video')" class="secondary">Video + Notifica</button>
        <button onclick="notifyBot('audio')">Audio + Notifica</button>
      </div>
      <button onclick="playOnly('audio')" class="secondary" style="margin-top:8px">Ascolta nel sito (senza notificare)</button>
    </div>
    <p id="playerMsg" class="msg"></p>
    <div id="nowPlaying" class="now-playing-info hidden"></div>
    <div class="switch-line" style="margin-top:16px"><a class="link" onclick="logout()">Esci</a></div>
  </div>
</div>
</div>
<script>
const state = { username: null, profilePic: null, currentVideo: null, currentTitle: '', currentArtist: '', sidebarTab: 'history' };

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
  if(document.getElementById('sidebar').classList.contains('open') && state.username){
    if(state.sidebarTab === 'history') loadHistory();
    else loadPlaylist();
  }
}

function switchTab(tab){
  state.sidebarTab = tab;
  document.getElementById('tab-history').classList.toggle('active', tab === 'history');
  document.getElementById('tab-playlist').classList.toggle('active', tab === 'playlist');
  if(tab === 'history') loadHistory();
  else loadPlaylist();
}

async function loadHistory(){
  const c = document.getElementById('sidebarContent');
  if(!state.username){ c.innerHTML = '<p class="sb-empty">Accedi per vedere la cronologia</p>'; return; }
  c.innerHTML = '<p class="sb-empty"><span class="spinner"></span> Caricamento...</p>';
  try{
    const r = await fetch('/history?username=' + encodeURIComponent(state.username));
    const data = await r.json();
    if(!data.history || data.history.length === 0){
      c.innerHTML = '<p class="sb-empty">Nessuna canzone ascoltata ancora.</p>';
      return;
    }
    c.innerHTML = '<button onclick="clearHistory()" class="secondary" style="font-size:12px;padding:8px;margin-bottom:10px">Svuota cronologia</button>';
    data.history.forEach((h) => {
      const el = document.createElement('div');
      el.className = 'sb-item';
      const thumb = h.thumbnail || 'https://img.youtube.com/vi/' + (h.videoId||'') + '/default.jpg';
      el.innerHTML = '<img src="'+thumb+'"><div class="sb-item-info"><div class="sb-item-title">'+h.title+'</div><div class="sb-item-meta">'+(h.artist||'')+(h.mode ? ' | '+(h.mode==='audio'?'Audio':'Video') : '')+'</div></div>';
      el.onclick = () => { if(h.videoId){ selectFromSidebar(h); toggleSidebar(); } };
      c.appendChild(el);
    });
  }catch(e){ c.innerHTML = '<p class="sb-empty">Errore di caricamento</p>'; }
}

async function clearHistory(){
  if(!confirm('Svuotare tutta la cronologia?')) return;
  await fetch('/history/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:state.username})});
  loadHistory();
}

async function loadPlaylist(){
  const c = document.getElementById('sidebarContent');
  if(!state.username){ c.innerHTML = '<p class="sb-empty">Accedi per vedere la playlist</p>'; return; }
  c.innerHTML = '<p class="sb-empty"><span class="spinner"></span> Caricamento...</p>';
  try{
    const r = await fetch('/playlist?username=' + encodeURIComponent(state.username));
    const data = await r.json();
    c.innerHTML = '<div style="margin-bottom:14px"><input type="text" id="importUrl" class="sb-input" placeholder="Incolla link playlist YouTube o Spotify"><button onclick="importPlaylist()" id="importBtn" style="font-size:13px;padding:10px">Importa Playlist</button><p id="importMsg" class="msg" style="font-size:12px"></p></div>';
    const pl = data.playlist || [];
    if(pl.length === 0){
      c.innerHTML += '<p class="sb-empty">Playlist vuota. Importa una playlist da YouTube o Spotify!</p>';
      return;
    }
    c.innerHTML += '<div style="font-size:12px;color:#888;margin-bottom:8px">'+pl.length+' brani</div>';
    pl.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'sb-item';
      el.innerHTML = '<img src="'+(t.thumbnail||'')+'"><div class="sb-item-info"><div class="sb-item-title">'+t.title+'</div><div class="sb-item-meta">'+(t.artist||'')+(t.duration?' | '+t.duration:'')+'</div></div><button class="sb-remove" onclick="event.stopPropagation();removeFromPlaylist('+i+')">X</button>';
      el.onclick = () => { if(t.videoId){ selectFromSidebar(t); toggleSidebar(); } };
      c.appendChild(el);
    });
  }catch(e){ c.innerHTML = '<p class="sb-empty">Errore di caricamento</p>'; }
}

async function importPlaylist(){
  const url = document.getElementById('importUrl').value.trim();
  const msg = document.getElementById('importMsg');
  const btn = document.getElementById('importBtn');
  if(!url){ msg.textContent = 'Incolla un link'; msg.className = 'msg err'; return; }
  btn.disabled = true;
  msg.innerHTML = '<span class="spinner"></span> Importazione in corso...';
  msg.className = 'msg';
  try{
    const r = await fetch('/playlist/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:state.username,url})});
    const data = await r.json();
    if(data.success){
      msg.textContent = 'Importazione avviata! Aspetta 30-60s e ricarica.';
      msg.className = 'msg ok';
      setTimeout(() => { if(state.sidebarTab === 'playlist') loadPlaylist(); }, 30000);
    } else {
      msg.textContent = 'Errore: ' + (data.error || '');
      msg.className = 'msg err';
    }
  }catch(e){ msg.textContent = 'Errore di rete'; msg.className = 'msg err'; }
  btn.disabled = false;
}

async function removeFromPlaylist(index){
  await fetch('/playlist/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:state.username,index})});
  loadPlaylist();
}

function selectFromSidebar(track){
  if(!document.getElementById('playerCard').classList.contains('hidden')){
    state.currentVideo = { videoId: track.videoId, url: track.url || ('https://youtu.be/' + track.videoId) };
    state.currentTitle = track.title;
    state.currentArtist = track.artist || '';
    showPlayerMode();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
}

function showLogin(){document.getElementById('registerCard').classList.add('hidden');document.getElementById('forgotCard').classList.add('hidden');document.getElementById('loginCard').classList.remove('hidden')}
function showRegister(){document.getElementById('loginCard').classList.add('hidden');document.getElementById('forgotCard').classList.add('hidden');document.getElementById('registerCard').classList.remove('hidden')}
function showForgot(){
  document.getElementById('registerCard').classList.add('hidden');
  document.getElementById('loginCard').classList.add('hidden');
  document.getElementById('forgotCard').classList.remove('hidden');
  document.getElementById('forgotStep1').classList.remove('hidden');
  document.getElementById('forgotStep2').classList.add('hidden');
  document.getElementById('forgotMsg').textContent = '';
  document.getElementById('forgotPhone').value = '';
  document.getElementById('resetCode').value = '';
  document.getElementById('resetPass').value = '';
}

function handleAvatar(event){
  const file = event.target.files[0]; if(!file) return;
  if(file.size > 5*1024*1024) return alert('Immagine troppo grande (max 5MB)');
  const reader = new FileReader();
  reader.onload = (e) => { state.profilePic = e.target.result; document.getElementById('avatarPreview').innerHTML = '<img src="'+e.target.result+'">'; };
  reader.readAsDataURL(file);
}

async function verifyAndRegister(){
  const token = document.getElementById('regToken').value.trim().toUpperCase();
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  const msg = document.getElementById('regMsg');
  const btn = document.getElementById('regBtn');
  if(!token || !username || !password){ msg.textContent='Compila tutti i campi'; msg.className='msg err'; return; }
  btn.disabled = true; msg.textContent='Verifica token...'; msg.className='msg';
  try{
    const r = await fetch('/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,token,profilePic:state.profilePic})});
    const data = await r.json();
    if(data.success){ msg.textContent='Registrato! Ora accedi.'; msg.className='msg ok'; setTimeout(showLogin,1200); }
    else{
      let err = data.error || 'Errore';
      msg.innerHTML = err;
      if(err.toLowerCase().includes('esistente') || err.toLowerCase().includes('registrato')){
        msg.innerHTML += '<br><a class="link" onclick="showLogin()">Vai al login</a>';
      }
      if(err.toLowerCase().includes('token')){
        msg.innerHTML += '<br><span style="font-size:11px;color:#888">Scrivi .mix al bot per un nuovo token</span>';
      }
      msg.className='msg err';
    }
  }catch(e){ msg.textContent='Errore di rete'; msg.className='msg err'; }
  btn.disabled = false;
}

async function login(){
  const username = document.getElementById('logUser').value.trim();
  const password = document.getElementById('logPass').value;
  const msg = document.getElementById('logMsg');
  const btn = document.getElementById('logBtn');
  btn.disabled = true; msg.textContent='Attendi...'; msg.className='msg';
  try{
    const r = await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const data = await r.json();
    if(data.success){
      state.username=username;
      state.profilePic=data.profilePic;
      localStorage.setItem('zeno_user', username);
      localStorage.setItem('zeno_pass', password);
      document.getElementById('loginCard').classList.add('hidden');
      document.getElementById('playerCard').classList.remove('hidden');
      document.getElementById('welcomeUser').textContent=username;
      if(data.profilePic){ document.getElementById('userAvatar').src = data.profilePic; }
    }
    else{ msg.textContent=(data.error||'Errore'); msg.className='msg err'; }
  }catch(e){ msg.textContent='Errore di rete'; msg.className='msg err'; }
  btn.disabled = false;
}

async function sendResetCode(){
  const phone = document.getElementById('forgotPhone').value.trim();
  const msg = document.getElementById('forgotMsg');
  const btn = document.getElementById('forgotBtn');
  if(!phone){ msg.textContent='Inserisci il numero WhatsApp'; msg.className='msg err'; return; }
  btn.disabled = true; msg.textContent='Invio codice su WhatsApp...'; msg.className='msg';
  try{
    const r = await fetch('/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
    const data = await r.json();
    if(data.success){
      msg.textContent='Codice inviato in privato dal bot!'; msg.className='msg ok';
      document.getElementById('forgotStep1').classList.add('hidden');
      document.getElementById('forgotStep2').classList.remove('hidden');
    } else {
      msg.textContent = (data.error || 'Errore'); msg.className='msg err';
    }
  }catch(e){ msg.textContent='Errore di rete'; msg.className='msg err'; }
  btn.disabled = false;
}

async function resetPassword(){
  const phone = document.getElementById('forgotPhone').value.trim();
  const code = document.getElementById('resetCode').value.trim();
  const newPassword = document.getElementById('resetPass').value;
  const msg = document.getElementById('forgotMsg');
  const btn = document.getElementById('resetBtn');
  if(!code || !newPassword){ msg.textContent='Compila tutti i campi'; msg.className='msg err'; return; }
  btn.disabled = true; msg.textContent='Reimpostazione...'; msg.className='msg';
  try{
    const r = await fetch('/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,code,newPassword})});
    const data = await r.json();
    if(data.success){
      msg.textContent = 'Password reimpostata! Ora puoi accedere.'; msg.className='msg ok';
      setTimeout(showLogin, 1500);
    } else {
      msg.textContent = (data.error || 'Errore'); msg.className='msg err';
    }
  }catch(e){ msg.textContent='Errore di rete'; msg.className='msg err'; }
  btn.disabled = false;
}

function logout(){
  localStorage.removeItem('zeno_user');
  localStorage.removeItem('zeno_pass');
  state.username=null; state.currentVideo=null; state.currentTitle=''; state.currentArtist='';
  document.getElementById('playerCard').classList.add('hidden');
  document.getElementById('loginCard').classList.remove('hidden');
  document.getElementById('ytPlayer').innerHTML='';
  document.getElementById('audioView').innerHTML='';
  document.getElementById('audioView').classList.add('hidden');
  document.getElementById('modeButtons').classList.add('hidden');
  document.getElementById('searchResults').innerHTML='';
  document.getElementById('searchInput').value='';
  document.getElementById('songUrl').value='';
  const sb = document.getElementById('sidebar');
  if(sb.classList.contains('open')) toggleSidebar();
}

function extractVideoId(url){
  if(!url) return null; url=url.trim();
  if(url.includes('youtu.be/')){const id=url.split('youtu.be/')[1].split(/[?&#]/)[0];if(id.length===11)return id}
  if(url.includes('youtube.com/watch')){try{const p=new URLSearchParams(url.split('?')[1]||'');const id=p.get('v');if(id&&id.length===11)return id}catch(e){}}
  if(url.includes('youtube.com/shorts/')){const id=url.split('youtube.com/shorts/')[1].split(/[?&#]/)[0];if(id.length===11)return id}
  if(/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

function onUrlChange(){document.getElementById('modeButtons').classList.add('hidden')}

async function searchSongs(){
  const q = document.getElementById('searchInput').value.trim();
  const results = document.getElementById('searchResults');
  const btn = document.getElementById('searchBtn');
  if(q.length<2){ results.innerHTML='<p class="msg err">Scrivi almeno 2 caratteri</p>'; return; }
  btn.disabled = true; results.innerHTML='<p class="msg">Ricerca in corso...</p>';
  try{
    const r = await fetch('/search?q='+encodeURIComponent(q));
    const data = await r.json();
    if(!data.success||!data.results||data.results.length===0){ results.innerHTML='<p class="msg err">Nessun risultato</p>'; btn.disabled=false; return; }
    results.innerHTML='';
    data.results.forEach(v=>{
      const el = document.createElement('div');
      el.className='search-item';
      el.innerHTML='<img src="'+v.thumbnail+'"><div class="search-item-info"><div class="search-item-title">'+v.title+'</div><div class="search-item-meta">'+(v.author||'')+(v.timestamp?' | '+v.timestamp:'')+'</div></div>';
      el.onclick=()=>selectSearchResult(v);
      results.appendChild(el);
    });
  }catch(e){ results.innerHTML='<p class="msg err">Errore di rete</p>'; }
  btn.disabled = false;
}

function selectSearchResult(v){
  state.currentVideo={videoId:v.videoId,url:'https://youtu.be/'+v.videoId};
  state.currentTitle=v.title; state.currentArtist=v.author||'';
  showPlayerMode();
}

function loadVideo(){
  const url = document.getElementById('songUrl').value.trim();
  const msg = document.getElementById('playerMsg');
  const videoId = extractVideoId(url);
  if(!videoId){ msg.textContent='Link YouTube non valido'; msg.className='msg err'; return; }
  state.currentVideo={videoId,url}; state.currentTitle=''; state.currentArtist='';
  fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(url)+'&format=json').then(r=>r.json()).then(o=>{state.currentTitle=o.title||'';state.currentArtist=o.author_name||''}).catch(()=>{});
  showPlayerMode();
}

function showPlayerMode(){
  const msg = document.getElementById('playerMsg');
  msg.textContent='Brano caricato! Scegli come ascoltarlo:'; msg.className='msg ok';
  document.getElementById('ytPlayer').innerHTML='';
  document.getElementById('audioView').innerHTML='';
  document.getElementById('audioView').classList.add('hidden');
  document.getElementById('modeButtons').classList.remove('hidden');
}

function playAsVideo(){
  const v = state.currentVideo; if(!v) return;
  document.getElementById('audioView').classList.add('hidden');
  document.getElementById('audioView').innerHTML='';
  document.getElementById('ytPlayer').innerHTML='<iframe width="100%" height="220" src="https://www.youtube.com/embed/'+v.videoId+'?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
}

function playAsAudio(){
  const v = state.currentVideo; if(!v) return;
  document.getElementById('ytPlayer').innerHTML='';
  const av = document.getElementById('audioView');
  const thumb = 'https://img.youtube.com/vi/'+v.videoId+'/hqdefault.jpg';
  av.innerHTML = '<div class="audio-visual"><img src="'+thumb+'"><div class="info"><div class="title">'+(state.currentTitle||'Caricamento...')+'</div><div class="artist">'+(state.currentArtist||'')+'</div></div></div><div class="mini-player"><iframe src="https://www.youtube.com/embed/'+v.videoId+'?autoplay=1&controls=1&modestbranding=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>';
  av.classList.remove('hidden');
}

function playOnly(mode){
  if(!state.currentVideo) return;
  const msg = document.getElementById('playerMsg');
  if(mode==='video') playAsVideo(); else playAsAudio();
  msg.textContent = 'Riproduzione nel sito...'; msg.className='msg ok';
}

async function notifyBot(mode){
  if(!state.currentVideo) return;
  const msg = document.getElementById('playerMsg');
  const btn = event ? event.target : null;
  if(btn) btn.disabled = true;
  if(mode==='video') playAsVideo(); else playAsAudio();
  msg.textContent='Invio al bot...'; msg.className='msg';
  try{
    let title = state.currentTitle, artist = state.currentArtist;
    if(!title){
      try{ const o = await fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(state.currentVideo.url)+'&format=json').then(r=>r.json()); title=o.title||'Canzone YouTube'; artist=o.author_name||''; state.currentTitle=title; state.currentArtist=artist; if(mode==='audio') playAsAudio(); }
      catch(e){ title='Canzone YouTube'; }
    }
    const thumb = 'https://img.youtube.com/vi/'+state.currentVideo.videoId+'/hqdefault.jpg';
    const r = await fetch('/now-playing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:state.username,songTitle:title,songUrl:state.currentVideo.url,songArtist:artist,mode,thumbnail:thumb})});
    const data = await r.json();
    if(data.success){
      msg.textContent='Bot avvisato! Controlla WhatsApp.'; msg.className='msg ok';
      const np = document.getElementById('nowPlaying'); np.classList.remove('hidden');
      np.innerHTML='<div class="title">'+title+'</div>'+(artist?'<div class="artist">'+artist+'</div>':'');
    } else { msg.textContent=(data.error||'Errore'); msg.className='msg err'; }
  }catch(e){ msg.textContent='Errore di rete'; msg.className='msg err'; }
  if(btn) btn.disabled = false;
}

async function autoLogin(){
  const savedUser = localStorage.getItem('zeno_user');
  const savedPass = localStorage.getItem('zeno_pass');
  if(!savedUser || !savedPass) return;
  try{
    const r = await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:savedUser,password:savedPass})});
    const data = await r.json();
    if(data.success){
      state.username = savedUser;
      state.profilePic = data.profilePic;
      document.getElementById('registerCard').classList.add('hidden');
      document.getElementById('loginCard').classList.add('hidden');
      document.getElementById('forgotCard').classList.add('hidden');
      document.getElementById('playerCard').classList.remove('hidden');
      document.getElementById('welcomeUser').textContent = savedUser;
      if(data.profilePic){ document.getElementById('userAvatar').src = data.profilePic; }
    } else {
      localStorage.removeItem('zeno_user');
      localStorage.removeItem('zeno_pass');
    }
  }catch(e){}
}

window.addEventListener('DOMContentLoaded', autoLogin);
</script>
</body>
</html>`);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log('[WebApp] Server in ascolto su http://localhost:' + PORT);
});
