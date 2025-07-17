// npm install express node-telegram-bot-api cookie-parser cors
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const cors = require('cors'); // <-- добавляем CORS

const BOT_TOKEN = '7953079067:AAEAZcTsHYYYWQP6aB4HWWPQNrfYoP-nEts';
const WEBAPP_URL = 'https://casemirror.cv/';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

// ✅ Настройка CORS ДО всех middleware
app.use(cors({
  origin: true,  // Разрешаем только твой фронтенд
  credentials: true                 // Разрешаем куки
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public')); // если нужно отдавать статические файлы

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
const { createHash, createHmac } = require('crypto');

function checkTelegramInitData(initData) {
  const params = Object.fromEntries(new URLSearchParams(initData));
  // params — объект с ключами из initData
  // Вытаскиваем hash отдельно
  const { hash, ...data } = params;

  // Раскодируем значения, если нужно, например user
  if (data.user) {
    data.user = decodeURIComponent(data.user).replace(/\\\//g, '/');
  }

  return checkSignature(BOT_TOKEN, { hash, ...data });
}

function checkSignature(token, { hash, ...data }) {
  const secret = createHash('sha256')
    .update(token)
    .digest();
  const checkString = Object.keys(data)
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('\n');
  const hmac = createHmac('sha256', secret)
    .update(checkString)
    .digest('hex');
  return hmac === hash;
}


app.post('/webapp_init', (req, res) => {
  const { initData } = req.body;
  console.log('Received initData:', initData);
  const valid = initData && checkTelegramInitData(initData);
  console.log('checkTelegramInitData returns:', valid);

  if (!valid) {
    return res.status(403).json({ ok: false, error: 'Invalid initData' });
  }

  const params = new URLSearchParams(initData);
  const userStr = params.get('user');
  let user = null;
  try {
    user = JSON.parse(userStr);
  } catch (e) {
    console.error('Failed to parse user JSON:', e);
    return res.status(400).json({ ok: false, error: 'Invalid user data' });
  }

  // Устанавливаем безопасный cookie
  res.cookie('tg_user', user.id, {
    httpOnly: true,
    secure: true,
    maxAge: 24 * 3600 * 1000,
    sameSite: 'none'
  });

  return res.json({ ok: true, userId: user.id, firstName: user.first_name });
});


// Пример защищенного роута
app.get('/me', (req, res) => {
  const userId = req.cookies.tg_user;
  if (!userId) return res.status(401).json({ ok: false });
  res.json({ ok: true, userId });
});

// Запуск сервера
app.listen(3001, () => console.log('Server listening on good'));
