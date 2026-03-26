function setRequiredEnv() {
  process.env.APPOINTMENTS_API_URL = "https://example.com/appointments";
  process.env.API_TOKEN = "token-123";
  process.env.TWILIO_ACCOUNT_SID = "AC123";
  process.env.TWILIO_AUTH_TOKEN = "auth-123";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
  process.env.WHATSAPP_TO = "whatsapp:+5491100000000";
  process.env.BOOK_APPOINTMENT_ON_AVAILABLE = "false";
}

async function setupModule() {
  jest.resetModules();
  setRequiredEnv();

  jest.doMock("axios", () => jest.fn());
  jest.doMock("twilio", () =>
    jest.fn(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({ sid: "SM123" }),
      },
    })),
  );

  const mod = require("../src/index");
  const axios = require("axios");
  const twilio = require("twilio");
  mod.resetStateForTests();

  const twilioClient = twilio.mock.results[0].value;
  return {
    checkAppointments: mod.checkAppointments,
    axios,
    sendWhatsAppMock: twilioClient.messages.create,
  };
}

describe("checkAppointments", () => {
  test("handles 401 and does not send WhatsApp", async () => {
    const { checkAppointments, axios, sendWhatsAppMock } = await setupModule();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    axios.mockRejectedValueOnce({
      response: { status: 401, data: { message: "Unauthorized" } },
    });

    await checkAppointments();

    expect(errorSpy).toHaveBeenCalledWith(
      "401 Unauthorized. Invalid token or auth header.",
    );
    expect(sendWhatsAppMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("handles expected 400 no-appointments response", async () => {
    const { checkAppointments, axios, sendWhatsAppMock } = await setupModule();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const noAppointmentsMessage =
      "PERS-Reserva de turnos - No hay turnos disponibles para el tramite seleccionado. Intente nuevamente en otro momento.";

    axios.mockRejectedValueOnce({
      response: { status: 400, data: noAppointmentsMessage },
    });

    await checkAppointments();

    expect(logSpy).toHaveBeenCalledWith("400 No appointments available (expected).");
    expect(sendWhatsAppMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test("handles 200 and sends WhatsApp notification", async () => {
    const { checkAppointments, axios, sendWhatsAppMock } = await setupModule();
    const response200 = {
      status: 200,
      data: {
        Data: {
          Fecha_Disponible: "2026-03-30T00:00:00",
          Fecha_Ultimo_Turno: "2026-04-30T00:00:00",
          Fecha_Primer_Turno: "2026-03-30T07:30:00",
          Filas: [
            {
              Id_Agenda: 8442,
              Hora_Desde: "07:30",
              Fecha: "31/03/2026",
              Libre: 4,
            },
          ],
        },
      },
    };

    axios.mockResolvedValueOnce(response200);

    await checkAppointments();

    expect(sendWhatsAppMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppMock.mock.calls[0][0]).toMatchObject({
      from: "whatsapp:+14155238886",
      to: "whatsapp:+5491100000000",
    });
  });
});
