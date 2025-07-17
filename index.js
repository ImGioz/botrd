// npm install express node-telegram-bot-api cookie-parser
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const BOT_TOKEN = '7953079067:AAEAZcTsHYYYWQP6aB4HWWPQNrfYoP-nEts';
const WEBAPP_URL = 'https://casemirror.cv/';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public')); //опционально

// Создаем кнопку Web App
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Открыть WebApp', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Перейти', web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

// Проверка Telegram initData
function checkTelegramInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckArray = [...params].sort().map(([k,v]) => `${k}=${v}`);
  const dataCheckString = dataCheckArray.join('\n');

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return hmac === hash;
}

// Роут для приема initData
app.post('/webapp_init', (req, res) => {
  const { initData } = req.body;
  if (!initData || !checkTelegramInitData(initData)) {
    return res.status(403).json({ ok: false, error: 'Invalid initData' });
  }

  const params = new URLSearchParams(initData);
  const userId = params.get('user[id]');
  const firstName = params.get('user[first_name]');

  // Устанавливаем безопасный cookie
  res.cookie('tg_user', userId, {
    httpOnly: true,
    secure: true, // ⚠️ ставь true на HTTPS в продакшене
    maxAge: 24 * 3600 * 1000,
    sameSite: 'lax'
  });

  return res.json({ ok: true, userId, firstName });
});

// Пример защищенного роута
app.get('/me', (req, res) => {
  const userId = req.cookies.tg_user;
  if (!userId) return res.status(401).json({ ok: false });
  res.json({ ok: true, userId });
});

app.listen(3001, () => console.log('Server listening on http://localhost:3001'));
