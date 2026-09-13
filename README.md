<div align="center">

<img src="https://i.postimg.cc/266mKgQj/lv-0-20260913184208.jpg" alt="Zeno Bot" width="900" />

# ⚡ ゼノ・ボット ⚡
### *ZENO BOT*

---

**🤖 Il bot WhatsApp più potente e veloce**  
*Multi-device • Personalizzabile • Open Source*

</div>

---

## 📖 INDICE

| Categoria | Link |
|-----------|------|
| 🤖 **Android** | [Vai al tutorial](#-android) |
| 🍎 **iPhone** | [Vai al tutorial](#-iphone) |
| 💻 **PC** | [Vai al tutorial](#-pc) |
| 🚀 **Avvio con PM2** | [Vai](#-avvio-con-pm2) |
| 🐛 **Problemi comuni** | [Vai](#-problemi-comuni) |

---

## 🤖 ANDROID

<div align="center">

### 📱 Tutorial completo per Android

</div>

> ✨ **Il metodo più facile e veloce.**  
> Con Termux puoi far girare il bot **direttamente dal tuo telefono Android**.

---

### 📥 STEP 1 — Installa Termux

**Termux** è un terminale Linux per Android. Ti serve per far girare il bot.

> ⚠️ **IMPORTANTE:** Scarica Termux da **F-Droid**, NON dal Play Store (la versione Play Store è vecchia e non funziona).

**👇 Come fare:**

1. Apri il browser sul telefono
2. Vai su → **[F-Droid - Termux](https://f-droid.org/packages/com.termux/)**
3. Clicca su **"Download APK"**
4. Apri il file scaricato e **installa** (se chiede permessi, accetta)
5. Apri **Termux**

---

### ⚙️ STEP 2 — Aggiorna Termux

Apri Termux e scrivi questo comando (poi premi **Invio**):

```bash
pkg update && pkg upgrade -y
```

⏳ *Aspetta che finisca. Ci metterà 1-2 minuti.*

Se chiede conferma durante l'aggiornamento, premi **`y`** e poi **Invio**.

---

### 📦 STEP 3 — Installa le dipendenze

Ora installa quello che serve al bot:

```bash
pkg install nodejs git ffmpeg -y
```

⏳ *Aspetta. Anche qui 1-2 minuti.*

---

### 📥 STEP 4 — Scarica il bot

Scarica **Zeno Bot** da GitHub:

```bash
git clone https://github.com/Yervinboss/18kbot.git
```

Poi entra nella cartella:

```bash
cd 18kbot
```

---

### 📚 STEP 5 — Installa le librerie

```bash
npm install
```

⏳ *Ci mette 1-3 minuti. Aspetta.*

Se dà errori, non ti preoccupare — puoi riprovare:
```bash
npm install --force
```

---

### 🚀 STEP 6 — Avvia il bot

```bash
node index.js
```

⏳ *Aspetta qualche secondo.*

---

### 📱 STEP 7 — Scansiona il QR

1. Apparirà un **QR code** nel terminale
2. Apri **WhatsApp** sul telefono
3. Vai su **⚙️ Impostazioni → Dispositivi collegati → Collega dispositivo**
4. **Scansiona il QR** che vedi su Termux
5. ✅ **Bot connesso!**

> 💡 **Suggerimento:** se il QR sparisce prima di scansionarlo, ingrandisci il testo di Termux con la pinch gesture.

---

### 🔄 STEP 8 — Mantieni il bot online (opzionale)

Se chiudi Termux, il bot si spegne. Per tenerlo sempre attivo:

```bash
pkg install pm2 -y
pm2 start index.js --name zeno
pm2 save
```

Da quel momento il bot rimane attivo anche chiudendo Termux.

---

## 🍎 IPHONE

<div align="center">

### 📱 Tutorial completo per iPhone

</div>

> ⚠️ **ATTENZIONE:** WhatsApp **NON permette** di far girare un bot direttamente dall'iPhone.  
> Serve un **server remoto** (Android, PC o VPS) che fa girare il bot, e l'iPhone lo **controlla da remoto**.

---

### 🎯 Come funziona

```
┌─────────────────┐         ┌──────────────┐
│  ANDROID/PC/VPS │  ────→  │    IPHONE    │
│  (fa girare il  │         │  (controlla  │
│      bot)       │         │   da remoto) │
└─────────────────┘         └──────────────┘
```

**In pratica:** il bot gira su un altro dispositivo, tu dall'iPhone lo gestisci.

---

### 📥 STEP 1 — Avvia il bot su un altro dispositivo

Prima di tutto, il bot deve girare su uno di questi:

- 📱 **Un telefono Android** → segui il tutorial [ANDROID](#-android)
- 💻 **Un PC** → segui il tutorial [PC](#-pc)
- 🌐 **Un VPS** → segui il tutorial [VPS](#-vps)

**Scrivi da qualche parte:**
- 📍 **IP del server** (es. `192.168.1.100` o `mioserver.com`)
- 📍 **Nome utente SSH** (es. `root`)
- 📍 **Password SSH**

---

### 📲 STEP 2 — Installa Termius sull'iPhone

**Termius** è l'app che ti permette di collegarti al server dall'iPhone.

1. Apri l'**App Store**
2. Cerca **"Termius"**
3. Installa l'app (gratis)
4. Aprila

---

### 🔌 STEP 3 — Connettiti al server

1. Apri **Termius**
2. Clicca **"New Host"** (o **+**)
3. Compila:
   - **Alias:** `Zeno Bot` (nome a caso)
   - **Hostname:** l'IP del server
   - **Username:** il tuo utente SSH
   - **Password:** la tua password
4. Clicca **"Save"**
5. Tocca la connessione appena creata per collegarti

Se tutto è giusto → sei dentro il server! ✅

---

### 🎛️ STEP 4 — Gestisci il bot

Ora puoi lanciare comandi dal tuo iPhone:

**Per vedere se il bot è online:**
```bash
pm2 status
```

**Per riavviare il bot:**
```bash
pm2 restart zeno
```

**Per vedere i log in tempo reale:**
```bash
pm2 logs zeno
```

*(Per uscire dai log: premi `CTRL+C` sulla tastiera di Termius)*

---

### 🚀 STEP 5 — Comandi rapidi (bonus)

Su Termius puoi salvare i comandi come **snippet**:

1. Vai in **Settings → Snippets**
2. Crea un nuovo snippet
3. Chiamalo **"Riavvia Zeno"**
4. Comando: `pm2 restart zeno`
5. Salva

Ora con **1 tocco** riavvii il bot dall'iPhone. 🎯

---

## 💻 PC

<div align="center">

### 🖥️ Tutorial completo per PC

</div>

> ✨ **Il metodo più comodo** se hai un computer.  
> Il bot gira sempre, anche quando non sei davanti allo schermo.

---

### 🪟 WINDOWS

#### 📥 STEP 1 — Installa Node.js

Node.js serve per far girare il bot.

1. Vai su → **[nodejs.org](https://nodejs.org)**
2. Scarica la versione **LTS** (quella consigliata)
3. Apri il file scaricato
4. Clicca **Next → Next → Install**
5. ✅ Lascia tutto di default

**Per verificare:** apri **Prompt dei comandi** (`Win + R` → scrivi `cmd` → Invio) e digita:
```cmd
node -v
```
Se vedi un numero tipo `v20.11.0` → ✅ funziona!

---

#### 📥 STEP 2 — Installa Git

Git serve per scaricare il bot da GitHub.

1. Vai su → **[git-scm.com](https://git-scm.com)**
2. Scarica la versione per Windows
3. Apri il file
4. Clicca **Next → Next → Install**
5. ✅ Lascia tutto di default

**Per verificare:**
```cmd
git --version
```

---

#### 📥 STEP 3 — Installa FFmpeg

FFmpeg serve per convertire audio e video.

1. Vai su → **[ffmpeg.org/download.html](https://ffmpeg.org/download.html)**
2. Clicca su **Windows** → scarica la build
3. Estrai lo zip in → `C:\ffmpeg`
4. **Aggiungi al PATH:**
   - Cerca **"Variabili d'ambiente"** nel menu Start
   - Apri **"Modifica le variabili d'ambiente del sistema"**
   - Clicca **"Variabili d'ambiente..."**
   - Nella sezione **"Variabili di sistema"** → seleziona **Path** → **Modifica**
   - Clicca **Nuovo** → incolla → `C:\ffmpeg\bin`
   - **OK → OK → OK**

**Per verificare:**
```cmd
ffmpeg -version
```

---

#### 📥 STEP 4 — Scarica il bot

Apri **Prompt dei comandi** (`Win + R` → `cmd` → Invio) e scrivi:

```cmd
cd Desktop
git clone https://github.com/Yervinboss/18kbot.git
cd 18kbot
```

---

#### 📚 STEP 5 — Installa le librerie

```cmd
npm install
```

⏳ *Ci mette 1-3 minuti.*

---

#### 🚀 STEP 6 — Avvia il bot

```cmd
node index.js
```

⏳ *Aspetta qualche secondo.*

---

#### 📱 STEP 7 — Scansiona il QR

1. Apparirà un **QR code** nel Prompt
2. Apri **WhatsApp** sul telefono
3. **Impostazioni → Dispositivi collegati → Collega dispositivo**
4. Scansiona il QR
5. ✅ **Bot connesso!**

---

### 🍎 macOS

#### 📥 STEP 1 — Installa Homebrew

Apri **Terminale** (cerca "Terminale" nel Launchpad) e incolla:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Premi **Invio** e segui le istruzioni.

---

#### 📥 STEP 2 — Installa Node.js, Git, FFmpeg

```bash
brew install node git ffmpeg
```

---

#### 📥 STEP 3 — Scarica il bot

```bash
cd ~/Desktop
git clone https://github.com/Yervinboss/18kbot.git
cd 18kbot
npm install
```

---

#### 🚀 STEP 4 — Avvia

```bash
node index.js
```

Poi **scansiona il QR** (vedi STEP 7 Windows).

---

### 🐧 LINUX (Ubuntu/Debian)

#### 📥 STEP 1 — Installa tutto

Apri il **Terminale** (`Ctrl+Alt+T`) e scrivi:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm git ffmpeg
```

---

#### 📥 STEP 2 — Scarica e avvia

```bash
cd ~
git clone https://github.com/Yervinboss/18kbot.git
cd 18kbot
npm install
node index.js
```

---

## 🌐 VPS

<div align="center">

### ☁️ Tutorial per VPS (server remoto)

</div>

> ✨ **Il metodo più professionale.**  
> Il bot gira **24/7** su un server remoto, anche se il tuo PC è spento.

---

### 📥 STEP 1 — Affitta un VPS

Consiglio questi provider economici:

| Provider | Prezzo | Link |
|----------|--------|------|
| **Hetzner** | ~3€/mese | [hetzner.com](https://www.hetzner.com) |
| **DigitalOcean** | ~4€/mese | [digitalocean.com](https://www.digitalocean.com) |
| **Contabo** | ~4€/mese | [contabo.com](https://contabo.com) |

Scegli:
- **OS:** Ubuntu 22.04
- **RAM:** minimo 1GB
- **CPU:** 1 vCPU

---

### 🔌 STEP 2 — Connettiti via SSH

Dal tuo PC (Windows/macOS/Linux):

```bash
ssh root@TUO_IP
```

Sostituisci `TUO_IP` con l'IP del VPS che ti hanno dato.

---

### 📥 STEP 3 — Installa il bot

```bash
sudo apt update && sudo apt install -y nodejs npm git ffmpeg
git clone https://github.com/Yervinboss/18kbot.git
cd 18kbot
npm install
```

---

### 🚀 STEP 4 — Avvia con PM2

```bash
npm install -g pm2
pm2 start index.js --name zeno
pm2 save
pm2 startup
```

**Poi scansiona il QR** (vedi STEP 7 Windows).

---

### ✅ STEP 5 — Fatto!

Il bot ora gira **24/7**. Anche se spegni il PC, il bot resta online.

---

## 🚀 AVVIO CON PM2

**PM2** mantiene il bot sempre online anche se:
- Chiudi il terminale
- Spegni il PC
- C'è un crash

---

### 📥 Installazione

```bash
npm install -g pm2
```

### 🚀 Avvio

```bash
cd ~/18kbot
pm2 start index.js --name zeno
pm2 save
pm2 startup
```

### 📋 Comandi utili

| Comando | Cosa fa |
|---------|---------|
| `pm2 status` | Stato del bot |
| `pm2 restart zeno` | Riavvia il bot |
| `pm2 stop zeno` | Ferma il bot |
| `pm2 logs zeno` | Log in tempo reale |
| `pm2 monit` | Monitor CPU/RAM |

---

## 🐛 PROBLEMI COMUNI

### ❌ `Cannot find module`

**Soluzione:**
```bash
npm install
```

---

### ❌ `Connection Closed (428)`

**Cosa significa:** normale, WhatsApp si riconnette da solo.

**Soluzione:** aspetta 10 secondi.

---

### ❌ `Bad MAC` o `Session Error`

**Cosa significa:** la sessione WhatsApp è corrotta.

**Soluzione:**
```bash
rm -rf session/
node index.js
```
Poi riscansiona il QR.

---

### ❌ Il bot non risponde

**Soluzione:**
```bash
pm2 restart zeno
pm2 logs zeno --lines 50
```

---

### ❌ Il QR non si vede bene

**Soluzione:** ingrandisci il terminale con `Ctrl + +` oppure la pinch gesture.

---

### ❌ Termux si chiude da solo

**Soluzione:**
1. Vai su **Impostazioni Android → App → Termux**
2. **Batteria → Senza restrizioni**
3. Disattiva **"Risparmio energetico"**

---

<div align="center">

### ⚔️ *進撃のゼノ* ⚔️

**⚡ Powered by Zeno Bot ⚡**

*Made with ❤️ by Zeno*

</div>
