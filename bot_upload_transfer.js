// ===============================
// BOT UPLOAD TRANSFER - POLLING VERSION
// ===============================
import TelegramBot from "node-telegram-bot-api";
import { google } from "googleapis";

// ======== ENVIRONMENT CHECK ========
const { TELEGRAM_TOKEN, SPREADSHEET_ID, SHEET_NAME, GOOGLE_CREDENTIALS } = process.env;
if (!TELEGRAM_TOKEN || !SPREADSHEET_ID || !SHEET_NAME || !GOOGLE_CREDENTIALS) {
  console.error("❌ Missing environment variables. Pastikan semua sudah diset!");
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

// ======== TELEGRAM BOT (LONG POLLING — OPTIMIZED) ========
const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: {
    autoStart: false,
    interval: 0,
    params: {
      timeout: 50,
      allowed_updates: ["message"],
    },
  },
});

// ======== HANDLE MESSAGE (COMMAND ONLY) ========
bot.on("message", async (msg) => {
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

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:C`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[nama, kode, nominal]] },
    });
    await bot.sendMessage(
      chatId,
      `✅ [TEST] DONE input ya:\nNama: ${nama}\nKode: ${kode}\nNominal: ${nominal}`
    );
  } catch (err) {
    console.error("❌ Gagal menyimpan:", err.message);
    await bot.sendMessage(chatId, "❌ [TEST] Gagal menyimpan ke Google Sheets.");
  }
});

// ======== ERROR HANDLER (network glitch, dll) ========
bot.on("polling_error", (err) => {
  console.error("⚠️ Polling error:", err.code, "-", err.message);
});

// ======== START POLLING ========
(async () => {
  try {
    // Bersihin webhook lama dari setup Render
    await bot.deleteWebHook({ drop_pending_updates: true });
    // Start long polling
    await bot.startPolling();
    console.log("✅ [TEST] Bot UPLOAD TRANSFER aktif (polling mode)");
  } catch (err) {
    console.error("❌ Gagal start bot:", err.message);
    process.exit(1);
  }
})();
