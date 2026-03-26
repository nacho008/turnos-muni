GET
<https://turnero.cordoba.gob.ar/api/Calendario/Get_Calendario_Online?Id_Tramite_Relevado=183&fecha=2026-03-27T03:00:00.000Z&id_agenda=7935>

RESPONSE
{
"Data": {
"Fecha_Disponible": "2026-03-30T00:00:00",
"Fecha_Ultimo_Turno": "2026-04-30T00:00:00",
"Fecha_Primer_Turno": "2026-03-30T07:30:00",
"Filas": [
{
"id_semana": 0,
"Libre": 4,
"Ocupado": 5,
"ciclos_turnos": 5,
"Id_Bloqueo_Calendario": 0,
"Id_Agenda": 7935,
"Hora_Hasta": "07:35",
"Hora_Desde": "07:30",
"Fecha": "31/03/2026"
}
]
}
}

POST
<https://turnero.cordoba.gob.ar/api/Turno/Post_Turno_Online>

Request
{"Fec_Turno":"2026-3-31T07:30","Id_Tramite_Relevado":183,"Id_Modalidad":2,"Datos_Adicionales":"","Observaciones":"","Notificar_Sms":"S","Notificar_Email":"S","Nro_Ticket":"","Sujeto_Ley_9131":"","Id_Agenda":7935,"Id_Tramite_Suac":"","I_AppExterna":null,"Tasas":null,"Patente_Dominio":""}

Response
{"Data":{"Id_Turno":5985603,"Mensaje":null}}

GET
<https://turnero.cordoba.gob.ar/api/TRS/Get_Tasas_Turno?id_turno=5985603>

Response
{"Data":[]}
