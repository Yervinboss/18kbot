<div align="center">

<img src="https://i.postimg.cc/266mKgQj/lv-0-20260913184208.jpg" alt="Zeno Bot" width="300" />

# ⚡ ZENO BOT ⚡

</div>

---

## 🍎 Installazione su iPhone

> ⚠️ WhatsApp non permette di hostare un bot direttamente dall'iPhone. Serve un **server remoto** (Termux, VPS) che gestisci dal telefono.

### 🅰️ Metodo 1 — Usare Termux (su Android) e controllare da iPhone

1. **Su un telefono Android:**
   - Installa **Termux** da [F-Droid](https://f-droid.org/packages/com.termux/) (non dal Play Store)
   - Apri Termux e lancia:
     ```bash
     pkg update && pkg upgrade
     pkg install nodejs git ffmpeg
     git clone https://github.com/tuo-utente/ZenoBot.git
     cd ZenoBot
     npm install
     node index.js
     ```
   - Scansiona il QR code con WhatsApp

2. **Sull'iPhone:**
   - Installa **Termius** dall'App Store
   - Connettiti al server dove gira il bot
   - Gestisci il bot da remoto

### 🅱️ Metodo 2 — VPS + Termius

1. Affitta un **VPS** (Hetzner, DigitalOcean, Contabo) da ~3€/mese
2. Installa **Ubuntu 22.04**
3. Connettiti via SSH da **Termius** su iPhone
4. Lancia i comandi:
   ```bash
   sudo apt update && sudo apt install -y nodejs npm git ffmpeg
   git clone https://github.com/tuo-utente/ZenoBot.git
   cd ZenoBot
   npm install
   npm install -g pm2
   pm2 start index.js --name zeno
   pm2 save
   pm2 startup
