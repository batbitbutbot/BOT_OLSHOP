// ===============================
// BOT UPLOAD TRANSFER vFinal
// FORMAT:
// NAMA/KODE/NOMINAL/WAKTU
// CONTOH:
// BUDI/T12/50000/16.15
// ===============================

import express from "express";
import axios from "axios";
import { google } from "googleapis";

// ======== BASIC CONFIG ========
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ======== ENV CHECK ========
const {
  TELEGRAM_TOKEN,
  SPREADSHEET_ID,
  SHEET_NAME,
  GOOGLE_CREDENTIALS,
} = process.env;

if (
  !TELEGRAM_TOKEN ||
  !SPREADSHEET_ID ||
  !SHEET_NAME ||
  !GOOGLE_CREDENTIALS
) {
  console.error("❌ Environment variables belum lengkap!");
  process.exit(1);
}

// ======== GOOGLE SHEETS SETUP ========
let credentials;

try {
  credentials = JSON.parse(GOOGLE_CREDENTIALS);
} catch (err) {
  console.error("❌ GOOGLE_CREDENTIALS invalid:", err.message);
  process.exit(1);
}

const client = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth: client,
});

// ======== TELEGRAM ========
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const WEBHOOK_URL =
  `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` +
  `/webhook/${TELEGRAM_TOKEN}`;

// ======== SET WEBHOOK ========
(async () => {
  try {
    await axios.post(`${TELEGRAM_API}/setWebhook`, {
      url: WEBHOOK_URL,
    });

    console.log("✅ Webhook aktif:");
    console.log(WEBHOOK_URL);
  } catch (err) {
    console.error("❌ Gagal set webhook:", err.message);
  }
})();

// ======== SEND MESSAGE ========
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
    });
  } catch (err) {
    console.error("❌ Gagal kirim pesan:", err.message);
  }
}

// ======== HANDLE MESSAGE ========
async function handleMessage(msg) {
  const chatId = msg.chat.id;

  // Ambil text / caption
  const text = msg.text || msg.caption;

  if (!text) return;

  // ===== FORMAT =====
  // NAMA/KODE/NOMINAL/WAKTU
  // CONTOH:
  // BUDI/T12/50000/16.15

  const match = text.trim().match(
    /^([\w]+)\/([Tt]\d{2})\/(\d+)\/(\d{2}\.\d{2})$/
  );

  // Jika format salah -> abaikan
  if (!match) {
    return await sendMessage(
      chatId,
      "❌ Format salah!\n\nGunakan:\nNAMA/KODE/NOMINAL/WAKTU\n\nContoh:\nBUDI/T12/50000/16.15"
    );
  }

  const nama = match[1].trim();
  const kode = match[2].trim();
  const nominal = match[3].trim();
  const waktu = match[4].trim();

  try {
    // ===== SAVE TO SHEETS =====
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[nama, kode, nominal, waktu]],
      },
    });

    // ===== SUCCESS MESSAGE =====
    await sendMessage(
      chatId,
      `✅ DONE input ya:

Nama: ${nama}
Kode: ${kode}
Nominal: ${nominal}
Waktu: ${waktu}`
    );
  } catch (err) {
    console.error("❌ Gagal simpan:", err.message);

    await sendMessage(
      chatId,
      "❌ Gagal menyimpan ke Google Sheets."
    );
  }
}

// ======== WEBHOOK ========
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
  try {
    const body = req.body;

    if (body.message) {
      await handleMessage(body.message);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).send("ERROR");
  }
});

// ======== HOME ========
app.get("/", (req, res) => {
  res.send("✅ BOT RUNNING");
});

// ======== START SERVER ========
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
