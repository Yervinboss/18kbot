import express from 'express';
import axios from 'axios';
import querystring from 'querystring';

const app = express();
const PORT = 3000;

const CLIENT_ID = 'c6217c74aa8e483b908cabf0c1af2c10';
const CLIENT_SECRET = '3b2a6aadab454a38b1b93f0d8e26c505';
const REDIRECT_URI = 'http://127.0.0.1:3000/callback';

app.get('/login', (req, res) => {
    const scope = 'user-read-currently-playing user-read-playback-state';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI
        }));
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
            }
        });

        const { access_token, refresh_token } = response.data;
        
        res.send('<h1>Autenticazione riuscita!</h1><p>Puoi chiudere questa pagina e controllare il terminale Termux per il tuo Refresh Token.</p>');
        
        console.log('\n--- TOKEN SALVATI CON SUCCESSO ---');
        console.log('Refresh Token:', refresh_token);
        console.log('Copia questo token!\n');

    } catch (error) {
        console.error('Errore:', error.response ? error.response.data : error.message);
        res.send('Errore durante l autenticazione.');
    }
});

app.listen(PORT, () => {
    console.log(`Server avviato su http://127.0.0.1:${PORT}`);
    console.log(`Apri nel browser: http://127.0.0.1:${PORT}/login`);
});
