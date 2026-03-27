const crypto = require("crypto");
const cron = require("node-cron");
const axios = require("axios");
const twilio = require("twilio");
require("dotenv").config();

const REQUIRED_ENV = [
  "APPOINTMENTS_API_URL",
  "API_TOKEN",
];

for (const variableName of REQUIRED_ENV) {
  if (!process.env[variableName]) {
    console.error(`Missing required env var: ${variableName}`);
    process.exit(1);
  }
}

const POLL_CRON = process.env.POLL_CRON || "*/5 * * * *";
const API_METHOD = (process.env.APPOINTMENTS_API_METHOD || "GET").toUpperCase();
const API_TOKEN_HEADER = process.env.API_TOKEN_HEADER || "Authorization";
const API_TOKEN_PREFIX = process.env.API_TOKEN_PREFIX;
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || "15000");
const API_JSON_BODY = parseJsonSafe(process.env.APPOINTMENTS_API_BODY || "");
const API_EXTRA_HEADERS = parseJsonSafe(
  process.env.APPOINTMENTS_API_HEADERS || "{}",
);
const NOTIFY_ON_EVERY_SUCCESS = process.env.NOTIFY_ON_EVERY_SUCCESS === "true";
const BOOK_APPOINTMENT_ON_AVAILABLE =
  process.env.BOOK_APPOINTMENT_ON_AVAILABLE === "true";
const BOOK_APPOINTMENT_URL =
  process.env.BOOK_APPOINTMENT_URL ||
  "https://turnero.cordoba.gob.ar/api/Turno/Post_Turno_Online";
const TASAS_TURNO_URL =
  process.env.TASAS_TURNO_URL ||
  "https://turnero.cordoba.gob.ar/api/TRS/Get_Tasas_Turno";
const BOOK_ID_TRAMITE_RELEVADO = Number(
  process.env.BOOK_ID_TRAMITE_RELEVADO || "183",
);
const BOOK_ID_AGENDA = Number(process.env.BOOK_ID_AGENDA || "7935");
const BOOK_ID_MODALIDAD = Number(process.env.BOOK_ID_MODALIDAD || "2");
const BOOK_NOTIFICAR_SMS = process.env.BOOK_NOTIFICAR_SMS || "S";
const BOOK_NOTIFICAR_EMAIL = process.env.BOOK_NOTIFICAR_EMAIL || "S";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

let isRunning = false;
let lastSentHash = null;
let bookingFlowExecuted = false;

function parseJsonSafe(value) {
  if (!value || value.trim() === "") {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Invalid JSON config value:", value);
    process.exit(1);
  }
}

function isNoAppointments400(response) {
  if (response.status !== 400) {
    return false;
  }

  const expectedMessage =
    "PERS-Reserva de turnos - No hay turnos disponibles para el tramite seleccionado. Intente nuevamente en otro momento.";
  const text =
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data);
  return text.includes(expectedMessage);
}

function extractAvailabilityInfo(data) {
  const source = data && data.Data ? data.Data : data;
  const filas = Array.isArray(source?.Filas) ? source.Filas : [];
  const totalLibre = filas.reduce(
    (sum, item) => sum + Number(item?.Libre || 0),
    0,
  );

  return {
    fechaDisponible: source?.Fecha_Disponible,
    fechaPrimerTurno: source?.Fecha_Primer_Turno,
    fechaUltimoTurno: source?.Fecha_Ultimo_Turno,
    filasCount: filas.length,
    totalLibre,
  };
}

function buildMessage(info, rawData) {
  const lines = [
    "Hay turnos disponibles!",
    `Fecha disponible: ${info.fechaDisponible || "N/D"}`,
    `Primer turno: ${info.fechaPrimerTurno || "N/D"}`,
    `Ultimo turno: ${info.fechaUltimoTurno || "N/D"}`,
    `Bloques con turnos: ${info.filasCount}`,
    `Total de cupos libres: ${info.totalLibre}`,
    "",
    "Respuesta cruda:",
    JSON.stringify(rawData, null, 2),
  ];

  return lines.join("\n");
}

function parseFechaAndTime(fecha, horaDesde) {
  if (!fecha || !horaDesde) {
    return null;
  }

  const [day, month, year] = String(fecha).split("/");
  if (!day || !month || !year) {
    return null;
  }

  const yyyy = year.padStart(4, "0");
  const mm = month.padStart(2, "0");
  const dd = day.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${horaDesde}`;
}

async function sendWhatsAppMessage(messageBody) {
  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: process.env.WHATSAPP_TO,
    body: messageBody,
  });
}

async function runBookingFlowOnce(availabilityData) {
  if (!BOOK_APPOINTMENT_ON_AVAILABLE || bookingFlowExecuted) {
    return;
  }
  bookingFlowExecuted = true;

  const source =
    availabilityData && availabilityData.Data
      ? availabilityData.Data
      : availabilityData;
  const firstFila = Array.isArray(source?.Filas) ? source.Filas[0] : null;

  if (!firstFila) {
    console.log("Booking flow skipped. No rows in Filas.");
    return;
  }

  const fecTurno = parseFechaAndTime(firstFila.Fecha, firstFila.Hora_Desde);
  if (!fecTurno) {
    console.error(
      "Booking flow aborted. Could not build Fec_Turno from first Filas item.",
    );
    return;
  }

  const bookingPayload = {
    Fec_Turno: fecTurno,
    Id_Tramite_Relevado: BOOK_ID_TRAMITE_RELEVADO,
    Id_Modalidad: BOOK_ID_MODALIDAD,
    Datos_Adicionales: "",
    Observaciones: "",
    Notificar_Sms: BOOK_NOTIFICAR_SMS,
    Notificar_Email: BOOK_NOTIFICAR_EMAIL,
    Nro_Ticket: "",
    Sujeto_Ley_9131: "",
    Id_Agenda: Number(firstFila.Id_Agenda),
    Id_Tramite_Suac: "",
    I_AppExterna: null,
    Tasas: null,
    Patente_Dominio: "",
  };

  try {
    const bookingResponse = await axios({
      url: BOOK_APPOINTMENT_URL,
      method: "POST",
      timeout: API_TIMEOUT_MS,
      headers: {
        ...(API_EXTRA_HEADERS || {}),
        [API_TOKEN_HEADER]: `${API_TOKEN_PREFIX}${process.env.API_TOKEN}`,
      },
      data: bookingPayload,
    });

    const idTurno = bookingResponse?.data?.Data?.Id_Turno;
    console.log("Booking request executed once.", bookingResponse.data);

    if (!idTurno) {
      return;
    }

    const tasasResponse = await axios({
      url: TASAS_TURNO_URL,
      method: "GET",
      timeout: API_TIMEOUT_MS,
      params: { id_turno: idTurno },
      headers: {
        ...(API_EXTRA_HEADERS || {}),
        [API_TOKEN_HEADER]: `${API_TOKEN_PREFIX}${process.env.API_TOKEN}`,
      },
    });

    console.log("Get_Tasas_Turno response:", tasasResponse.data);
  } catch (error) {
    if (error.response) {
      console.error(
        `Booking flow failed with HTTP ${error.response.status}:`,
        error.response.data,
      );
      return;
    }
    console.error("Booking flow failed:", error.message);
  }
}

async function checkAppointments() {
  if (isRunning) {
    console.log("Previous run still executing. Skipping this cycle.");
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();
  console.log(`[${startedAt}] Running appointment check...`);

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fechaParam = tomorrow.toISOString();

    const response = await axios({
      url: `${process.env.APPOINTMENTS_API_URL}?Id_Tramite_Relevado=${BOOK_ID_TRAMITE_RELEVADO}&fecha=${encodeURIComponent(fechaParam)}&id_agenda=${BOOK_ID_AGENDA}`,
      method: API_METHOD,
      timeout: API_TIMEOUT_MS,
      headers: {
        ...(API_EXTRA_HEADERS || {}),
        [API_TOKEN_HEADER]: `${API_TOKEN_PREFIX}${process.env.API_TOKEN}`,
      },
      data: API_JSON_BODY,
    });

    if (response.status === 200) {
      const info = extractAvailabilityInfo(response.data);
      await runBookingFlowOnce(response.data);
      const responseHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(response.data))
        .digest("hex");
      const shouldNotify =
        NOTIFY_ON_EVERY_SUCCESS || lastSentHash !== responseHash;

      if (!shouldNotify) {
        console.log(
          "Availability response unchanged. WhatsApp notification skipped.",
        );
        return;
      }

      const message = buildMessage(info, response.data);
      await sendWhatsAppMessage(message);
      lastSentHash = responseHash;
      console.log("Availability found. WhatsApp notification sent.");
      return;
    }

    console.warn(`Unexpected status code: ${response.status}`);
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        console.error("401 Unauthorized. Invalid token or auth header.");
      } else if (isNoAppointments400(error.response)) {
        console.log("400 No appointments available (expected).");
      } else {
        console.error(`HTTP ${status}. Unexpected response:`, data);
      }
    } else {
      console.error("Network or timeout error:", error.message);
    }
  } finally {
    isRunning = false;
  }
}

function startWatcher() {
  console.log(`Appointment watcher started. Schedule: "${POLL_CRON}"`);
  cron.schedule(POLL_CRON, checkAppointments, {
    timezone: "America/Argentina/Buenos_Aires",
  });

  // Run immediately on startup as well.
  checkAppointments();
}

function resetStateForTests() {
  isRunning = false;
  lastSentHash = null;
  bookingFlowExecuted = false;
}

module.exports = {
  checkAppointments,
  startWatcher,
  resetStateForTests,
};

if (require.main === module) {
  startWatcher();
}
