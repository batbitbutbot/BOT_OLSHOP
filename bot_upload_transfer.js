// ===============================
// BOT UPLOAD TRANSFER vFINAL
// FORMAT:
// NAMA/KODE/NOMINAL/WAKTU
//
// CONTOH:
// noirlucien/t04/50000/16.15
//
// BOT HANYA RESPON JIKA FORMAT VALID
// CHAT BIASA AKAN DIABAIKAN
// ===============================

import express from "express";
import axios from "axios";
import { google } from "googleapis";

// ======== BASIC CONFIG ========
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ======== ENVIRONMENT ========
const {
  TELEGRAM_TOKEN,
  SPREADSHEET_ID,
  SHEET_NAME,
  GOOGLE_CREDENTIALS,
} = process.env;

// ======== VALIDASI ENV ========
if (
  !TELEGRAM_TOKEN ||
  !SPREADSHEET_ID ||
  !SHEET_NAME ||
  !GOOGLE_CREDENTIALS
) {
  console.error("❌ Environment variables belum lengkap!");
  process.exit(1);
}

// ======== GOOGLE CREDENTIALS ========
let credentials;

try {
  credentials = JSON.parse(GOOGLE_CREDENTIALS);
} catch (err) {
  console.error("❌ GOOGLE_CREDENTIALS invalid:", err.message);
  process.exit(1);
}

// ======== GOOGLE SHEETS AUTH ========
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

  // Jika kosong -> abaikan
  if (!text) return;

  // ===== FORMAT VALID =====
  // nama/t04/50000/16.15

  const match = text.trim().match(
    /^([\w]+)\/([Tt]\d{2})\/(\d+)\/(\d{2}\.\d{2})$/
  );

  // Jika bukan format valid -> diam
  if (!match) return;

  // ===== AMBIL DATA =====
  const nama = match[1].trim();
  const kode = match[2].trim();
  const nominal = match[3].trim();
  const waktu = match[4].trim();

  try {
    // ===== INPUT KE SHEETS =====
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[nama, kode, nominal, waktu]],
      },
    });

    // ===== RESPON SUKSES =====
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

// ======== ROOT ========
app.get("/", (req, res) => {
  res.send("✅ BOT RUNNING");
});

// ======== START SERVER ========
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
