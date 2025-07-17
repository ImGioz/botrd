const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createHmac, createHash } = require('crypto');

const app = express();

const BOT_TOKEN = '7953079067:AAGAkWW2amf18i-B5sM63BWSJ65Cxugvhx0'; // 🔐 Заменить на настоящий токен!

app.use(cors({
  origin: 'https://casemirror.cv', // 🔁 фронтент домен
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

function isValidTelegramInitData(data) {
  if (!data || !data.hash) return false;

  const { hash, ...rest } = data;

  // Строим data_check_string
  const dataCheckArr = Object.keys(rest)
    .sort()
    .map(key => `${key}=${typeof rest[key] === 'object' ? JSON.stringify(rest[key]) : rest[key]}`);

  const dataCheckString = dataCheckArr.join('\n');

  // Ключ: HMAC-SHA-256 от bot_token с ключом 'WebAppData'
  const secret = createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}

app.post('/webapp_init', (req, res) => {
  try {
    const initData = req.body;
    console.log('🔹 Received initDataUnsafe:', initData);

    const isValid = isValidTelegramInitData(initData);

    if (!isValid) {
      console.warn('❌ Invalid initData');
      return res.status(403).json({ ok: false, error: 'Invalid initData' });
    }

    const user = initData.user;
    if (!user || !user.id) {
      return res.status(400).json({ ok: false, error: 'No user data' });
    }

    res.cookie('tg_user', user.id, {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 3600 * 1000,
      sameSite: 'none',
    });

    return res.json({ ok: true, userId: user.id, firstName: user.first_name });
  } catch (err) {
    console.error('🔥 Error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
