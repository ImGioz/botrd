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
  origin: 'https://casemirror.cv',  // Разрешаем только твой фронтенд
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
function checkTelegramInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  params.delete('signature'); // ⬅️ Убираем лишнее, Telegram использует только hash

  const dataCheckArray = [];

  for (const [key, rawValue] of params) {
    let decoded = decodeURIComponent(rawValue);
    if (key === 'user') {
      decoded = decoded.replace(/\\\//g, '/'); // удаляем лишние экранирования
    }
    dataCheckArray.push(`${key}=${decoded}`);
  }

  dataCheckArray.sort();
  const dataCheckString = dataCheckArray.join('\n');

  console.log('🔍 dataCheckString:\n', dataCheckString);

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  console.log('🔍 expected hash:', hash);
  console.log('🔍 computed hmac:', hmac);

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
