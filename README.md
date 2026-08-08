# 🤖 18k bot | High Performance Multi-Device Bot

<p align="center">
  <img src="https://catbox.moe" alt="18k bot Asuka" width="450">
  </p>

  Benvenuto nella pagina ufficiale di **18k bot**! Un bot multi-dispositivo potente, leggero e veloce. 

  Questa guida è scritta in modo semplice per permettere a **CHIUNQUE** di installarlo, sia che tu sia da **Telefono (Android)**, sia che tu sia da **Computer (Windows)**.

  ---

  ## 📋 Indice
  * [✨ Funzionalità](#-funzionalità)
  * [📱 Installazione su Telefono (Termux)](#-installazione-su-telefono-termux)
  * [🖥️ Installazione su Computer (Windows)](#%EF%B8%8F-installazione-su-computer-windows)
  * [🔐 Sicurezza e Privacy](#-sicurezza-e-privacy)

  ---

  ## ✨ Funzionalità
  * ⚡ **Tecnologia MD:** Rimane connesso senza bisogno del telefono sempre online.
  * 🔌 **Plugin Auto-Load:** I comandi nella cartella `plugins` si caricano da soli.
  * 🎵 **Download Media:** Scarica e riproduce file musicali direttamente nelle chat.

  ---

  ## 📱 Installazione su Telefono (Termux)

  Se usi solo lo smartphone, segui questi passaggi uno alla volta dentro l'app Termux:

  ### 1. Prepara l'applicazione
  ```bash
  pkg update && pkg upgrade -y
  pkg install nodejs git -y
  ```

  ### 2. Scarica ed entra nella cartella di 18k bot
  ```bash
  git clone https://github.com
  cd 18kbot
  ```

  ### 3. Installa i componenti del bot
  ```bash
  npm install
  ```

  ### 4. Accendi 18k bot
  ```bash
  node .
  ```
  *Ora ti apparirà un codice QR sullo schermo di Termux. Fai uno screenshot, invialo velocemente a un altro telefono (o PC), apri WhatsApp sul tuo telefono principale, vai su **Dispositivi collegati > Collega un dispositivo** e inquadra lo screenshot al volo prima che scada!*

  ---

  ## 🖥️ Installazione su Computer (Windows)

  Se hai un PC, non usare comandi difficili. Fai tutto con il mouse:

  1. Scarica e installa **Node.js** dal sito ufficiale: [nodejs.org](https://nodejs.org) (clicca sul pulsante verde "LTS").
  2. Scarica questo bot in formato ZIP cliccando sul pulsante verde **Code** in alto su questa pagina di GitHub e poi su **Download ZIP**.
  3. Estrai il file ZIP sul tuo computer per trasformarlo in una cartella normale.
  4. Apri la cartella estratta. Clicca sulla barra degli indirizzi in alto in Windows (dove c'è scritto il percorso della cartella), cancella tutto, scrivi la parola `cmd` (o `powershell`) e premi **Invio**.
  5. Nella finestra nera che si apre, scrivi questo comando per installare i componenti:
  ```bash
  npm install
  ```
  6. Infine, accendi il bot scrivendo:
  ```bash
  node .
  ```
  *Inquadra il codice QR che appare sul monitor con il tuo WhatsApp ed è fatta!*

  ---

  ## 🔐 Sicurezza e Privacy
  La sicurezza dei tuoi dati è garantita al 100%. I file delle sessioni (`auth_info_baileys`) e i file musicali temporanei sono protetti dal file `.gitignore`. Questo significa che le tue informazioni private rimangono sul tuo dispositivo e non verranno **MAI** condivise pubblicamente su questo sito.

  ---
  ⭐ **Se il progetto di 18k bot ti piace, lascia una stella alla repository!** ⭐
  
