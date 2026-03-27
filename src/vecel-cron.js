const baseCron = require('./base-cron'); 

export default async function handler(req, res) {
  try {
    console.log("Cron job triggered");

    await baseCron.checkAppointments(); // move your logic here

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Job failed" });
  }
}