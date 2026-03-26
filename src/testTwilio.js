const twilio = require("twilio");
require("dotenv").config();

const REQUIRED_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "WHATSAPP_TO",
];

for (const variableName of REQUIRED_ENV) {
  if (!process.env[variableName]) {
    console.error(`Missing required env var: ${variableName}`);
    process.exit(1);
  }
}

const customMessage = process.argv.slice(2).join(" ").trim();
const body =
  customMessage ||
  `Test message from turnos watcher at ${new Date().toISOString()}`;

async function main() {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );

  const result = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: process.env.WHATSAPP_TO,
    body,
  });

  console.log("Twilio message sent successfully.");
  console.log(`SID: ${result.sid}`);
  console.log(`To: ${result.to}`);
}

main().catch((error) => {
  const detail = error?.message || "Unknown error";
  console.error("Failed to send Twilio test message:", detail);
  process.exit(1);
});
