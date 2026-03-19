const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const express = require("express");
const router = express.Router();
const fs = require("fs");
const { exec } = require("child_process");
const { upload } = require("megajs"); // make sure you have megajs installed

let qrImage = ""; // browser QR

// utility function to generate random ID
function randomMegaId(length = 8, numberLength = 5) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  const number = Math.floor(Math.random() * Math.pow(10, numberLength));
  return `${result}${number}`;
}

// delay helper
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// remove session folder
async function removeFile(path) {
  if (fs.existsSync(path)) {
    fs.rmSync(path, { recursive: true, force: true });
  }
}

// main function
async function RobinPair(user_jid) {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const RobinPairWeb = makeWASocket({
      auth: state,
      printQRInTerminal: true, // terminal QR
    });

    RobinPairWeb.ev.on("creds.update", saveCreds);

    RobinPairWeb.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      try {
        if (qr) {
          qrImage = await qrcode.toDataURL(qr); // browser-friendly QR
          console.log("📌 Scan this QR in your phone:");
          console.log(qrImage);
        }

        if (connection === "open") {
          console.log("✅ WhatsApp Connected!");

          // Upload session to Mega.nz
          const auth_path = "./session/";
          const mega_url = await upload(
            fs.createReadStream(auth_path + "creds.json"),
            `${randomMegaId()}.json`
          );

          const string_session = mega_url.replace("https://mega.nz/file/", "");
          const sid = `*MALSHAN [The powerful WA BOT]*\n\n👉 ${string_session} 👈\n\n*Copy this ID into config.js*\n\n*wa.me/message/WKGLBR2PCETWD1*\n\n*Join group: https://chat.whatsapp.com/GAOhr0qNK7KEvJwbenGivZ*`;
          const mg = `🛑 *Do not share this code to anyone* 🛑`;

          await RobinPairWeb.sendMessage(user_jid, {
            image: {
              url: "https://raw.githubusercontent.com/Dark-Robin/Bot-Helper/refs/heads/main/autoimage/Bot%20robin%20WP.jpg",
            },
            caption: sid,
          });
          await RobinPairWeb.sendMessage(user_jid, { text: string_session });
          await RobinPairWeb.sendMessage(user_jid, { text: mg });

          await delay(100);
          await removeFile("./session");
          process.exit(0);
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          await delay(10000);
          RobinPair(user_jid);
        }
      } catch (e) {
        console.log("Error inside connection.update:", e);
        exec("pm2 restart Robin-md");
      }
    });
  } catch (err) {
    console.log("Service error:", err);
    exec("pm2 restart Robin-md");
    await removeFile("./session");
  }
}

// Express route to serve browser QR
router.get("/", (req, res) => {
  if (!qrImage) return res.send("QR not ready yet!");
  res.send(`<img src="${qrImage}" />`);
});

module.exports = router;
