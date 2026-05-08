// ===============================
// BOT UPLOAD TRANSFER vFinal (COMMAND ONLY)
// ===============================
import express from "express";
import axios from "axios";
import { google } from "googleapis";

// Konfigurasi dasar
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;

// ======== ENVIRONMENT CHECK ========
const { TELEGRAM_TOKEN, SPREADSHEET_ID, SHEET_NAME, GOOGLE_CREDENTIALS } = process.env;

if (!TELEGRAM_TOKEN || !SPREADSHEET_ID || !SHEET_NAME || !GOOGLE_CREDENTIALS) {
  console.error("❌ Missing environment variables. Pastikan semua sudah diset di Render!");
  process.exit(1);
}

// ======== SETUP GOOGLE SHEETS API ========
let credentials;
try {
  credentials = JSON.parse(GOOGLE_CREDENTIALS);
} catch (error) {
  console.error("❌ GOOGLE_CREDENTIALS tidak valid:", error);
  process.exit(1);
}

const client = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth: client });

// ======== TELEGRAM API BASE ========
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const WEBHOOK_URL = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;

// ======== SET WEBHOOK ========
(async () => {
  try {
    await axios.post(`${TELEGRAM_API}/setWebhook`, { url: WEBHOOK_URL });
    console.log("✅ Webhook aktif di:", WEBHOOK_URL);
  } catch (err) {
    console.error("❌ Gagal set webhook:", err.message);
  }
})();

// ======== HANDLE MESSAGE (COMMAND ONLY) ========
async function handleMessage(msg) {
  const chatId = msg.chat.id;

  // Ambil caption atau text
  const text = msg.caption || msg.text;
  if (!text) return; // Abaikan pesan kosong

  // Regex ketat: hanya format username/kode/nominal
  const match = text.trim().match(/^([\w]+)\/([Tt]\d{2})\/(\d+)$/);

  if (!match) return; // Abaikan semua chat yang tidak sesuai format

  const nama = match[1].trim();
  const kode = match[2].trim();
  const nominal = match[3].trim();
  const waktu = match[4].trim();

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:C`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[nama, kode, nominal]] },
    });

    await sendMessage(chatId, `✅ DONE input ya:\nNama: ${nama}\nKode: ${kode}\nNominal: ${nominal}`);
  } catch (err) {
    console.error("❌ Gagal menyimpan:", err.message);
    await sendMessage(chatId, "❌ Gagal menyimpan ke Google Sheets.");
  }
}

// ======== SEND MESSAGE ========
async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text });
}

// ======== WEBHOOK HANDLER ========
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
  const body = req.body;
  if (body.message) {
    await handleMessage(body.message);
  }
  res.status(200).send("OK");
});

// ======== SERVER LISTEN ========
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
