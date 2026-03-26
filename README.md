# Turnos watcher (cada 5 minutos)

Proyecto Node.js que consulta una API de turnos cada 5 minutos y envia un WhatsApp cuando hay disponibilidad.

## Que hace

- Ejecuta un chequeo en cron `*/5 * * * *` (cada 5 minutos).
- Maneja los escenarios:
  - `401`: token invalido.
  - `400` con mensaje `"PERS-Reserva de turnos - No hay turnos disponibles para el tramite seleccionado. Intente nuevamente en otro momento."`: sin turnos (esperado).
  - `200`: hay respuesta valida de disponibilidad -> envia WhatsApp.
- Evita spam por defecto: si la respuesta `200` no cambia, no vuelve a enviar (configurable).

## Requisitos

- Node.js 18+ (recomendado 20).
- Cuenta de Twilio con WhatsApp habilitado (sandbox o numero productivo).

## Configuracion

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` desde el ejemplo:

```bash
cp .env.example .env
```

3. Completar valores en `.env`:

- `APPOINTMENTS_API_URL`: endpoint para consultar turnos.
- `API_TOKEN`: token de autenticacion.
- `API_TOKEN_HEADER`: nombre del header del token (por defecto `Authorization`).
- `API_TOKEN_PREFIX`: prefijo del token (por defecto `Bearer `).
- `APPOINTMENTS_API_METHOD`: `GET` o `POST`.
- `APPOINTMENTS_API_HEADERS`: JSON opcional con headers extras.
- `APPOINTMENTS_API_BODY`: JSON opcional para body (si `POST`).
- `TWILIO_WHATSAPP_FROM`: por ejemplo `whatsapp:+14155238886` (sandbox).
- `WHATSAPP_TO`: tu numero, ejemplo `whatsapp:+54911XXXXXXXX`.

## Ejecucion local

```bash
npm start
```

Al iniciar:
- corre una verificacion inmediata.
- luego vuelve a correr cada 5 minutos.

## Despliegue recomendado (Railway)

Esta app usa `node-cron` interno, entonces necesita un proceso siempre encendido.

1. Subir este proyecto a GitHub.
2. En Railway, crear `New Project` desde el repo.
3. Agregar todas las variables del `.env` en Railway.
4. Deploy.

Railway mantendra el worker corriendo 24/7 y el cron interno ejecutara cada 5 minutos.

## Despliegue con Docker (alternativo)

```bash
docker build -t turnos-watcher .
docker run --env-file .env turnos-watcher
```

## Nota sobre Twilio WhatsApp

- En sandbox, tenes que unir tu numero al sandbox de Twilio y usar el `from` de sandbox.
- En produccion, Twilio debe aprobar tu template/caso de uso segun politicas de WhatsApp.
