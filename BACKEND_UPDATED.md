# Actualización del Backend (Google Apps Script)

IMPORTANTE: Para que el nuevo sistema de login funcione, debes actualizar el código de tu Google Apps Script. 

## 1. Preparar el Google Sheet
Asegúrate de crear una nueva pestaña (Sheet) llamada exactamente: `PlayersJSON`
Columnas necesarias en la fila 1:
- Celda A1: `Player`
- Celda B1: `Data` (aquí se guardará el PIN)

---

## 2. Nuevo Código Apps Script
Borra todo el código anterior en tu editor de Apps Script y pega este:

```javascript
const SHEET_PREDICTIONS = 'PrediccionesJSON';
const SHEET_PLAYERS = 'PlayersJSON';
const SHEET_INFO = 'playersInfo.JSON';
const SHEET_SUMMARIES = 'summariesJSON';

function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.parameter;
    }

    const { action, playerName, playerPin, predictions, data, summary } = body;

    // --- ACCIÓN: REGISTRO ---
    if (action === 'register') {
      const sheet = ss.getSheetByName(SHEET_PLAYERS);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === playerName) throw new Error("El jugador ya existe.");
      }
      sheet.appendRow([playerName, playerPin]);
      return createResponse({ status: 'success', message: 'Usuario registrado' });
    }

    // --- ACCIÓN: LOGIN ---
    if (action === 'login') {
      const sheet = ss.getSheetByName(SHEET_PLAYERS);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === playerName && String(rows[i][1]) === String(playerPin)) {
          return createResponse({ status: 'success', message: 'Login correcto' });
        }
      }
      throw new Error("Nombre o PIN incorrecto.");
    }

    // --- ACCIÓN: GUARDAR INFO DE USUARIO (Personalidad) ---
    if (action === 'saveInfo') {
      const sheet = ss.getSheetByName(SHEET_INFO);
      if (!sheet) ss.insertSheet(SHEET_INFO).appendRow(['Player', 'Data']);
      const activeSheet = ss.getSheetByName(SHEET_INFO);
      const rows = activeSheet.getDataRange().getValues();
      let rowToUpdate = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === playerName) {
          rowToUpdate = i + 1;
          break;
        }
      }
      const stringifiedData = typeof data === 'string' ? data : JSON.stringify(data);
      if (rowToUpdate > -1) {
        activeSheet.getRange(rowToUpdate, 2).setValue(stringifiedData);
      } else {
        activeSheet.appendRow([playerName, stringifiedData]);
      }
      return createResponse({ status: 'success', message: 'Información guardada' });
    }

    // --- ACCIÓN: GUARDAR RESUMEN IA ---
    if (action === 'saveSummary') {
      const sheet = ss.getSheetByName(SHEET_SUMMARIES);
      if (!sheet) ss.insertSheet(SHEET_SUMMARIES).appendRow(['Player', 'Summary']);
      const activeSheet = ss.getSheetByName(SHEET_SUMMARIES);
      const rows = activeSheet.getDataRange().getValues();
      let rowToUpdate = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === playerName) {
          rowToUpdate = i + 1;
          break;
        }
      }
      if (rowToUpdate > -1) {
        activeSheet.getRange(rowToUpdate, 2).setValue(summary);
      } else {
        activeSheet.appendRow([playerName, summary]);
      }
      return createResponse({ status: 'success', message: 'Resumen guardado' });
    }

    // --- ACCIÓN: GUARDAR PREDICCIONES ---
    if (action === 'save') {
      const sheet = ss.getSheetByName(SHEET_PREDICTIONS);
      const rows = sheet.getDataRange().getValues();
      let rowToUpdate = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === playerName) {
          rowToUpdate = i + 1;
          break;
        }
      }
      const timestamp = new Date();
      const stringifiedData = typeof predictions === 'string' ? predictions : JSON.stringify(predictions);

      if (rowToUpdate > -1) {
        sheet.getRange(rowToUpdate, 2).setValue(timestamp);
        sheet.getRange(rowToUpdate, 3).setValue(stringifiedData);
      } else {
        sheet.appendRow([playerName, timestamp, stringifiedData]);
      }
      return createResponse({ status: 'success', message: 'Predicciones guardadas' });
    }

    throw new Error("Acción no válida");
  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetPred = ss.getSheetByName(SHEET_PREDICTIONS);
    const sheetPlayers = ss.getSheetByName(SHEET_PLAYERS);
    const sheetInfo = ss.getSheetByName(SHEET_INFO);
    
    // Si se pide la lista de jugadores
    if (e.parameter.action === 'getPlayers') {
      const rows = sheetPlayers.getDataRange().getValues();
      const players = [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0]) players.push(rows[i][0]);
      }
      return createResponse({ status: 'success', data: players });
    }

    // Si se pide toda la información de personalidad
    if (e.parameter.action === 'getAllInfo') {
      if (!sheetInfo) return createResponse({ status: 'success', data: {} });
      const rows = sheetInfo.getDataRange().getValues();
      const result = {};
      for (let i = 1; i < rows.length; i++) {
        const pName = rows[i][0];
        const jsonStr = rows[i][1];
        if (pName && jsonStr) {
          try { result[pName] = JSON.parse(jsonStr); } catch(err) {}
        }
      }
      return createResponse({ status: 'success', data: result });
    }

    // Si se pide todos los resúmenes guardados
    if (e.parameter.action === 'getAllSummaries') {
      if (!sheetInfo) return createResponse({ status: 'success', data: {} });
      const activeSheet = ss.getSheetByName(SHEET_SUMMARIES);
      if (!activeSheet) return createResponse({ status: 'success', data: {} });
      const rows = activeSheet.getDataRange().getValues();
      const result = {};
      for (let i = 1; i < rows.length; i++) {
        const pName = rows[i][0];
        const sumText = rows[i][1];
        if (pName && sumText) {
          result[pName] = sumText;
        }
      }
      return createResponse({ status: 'success', data: result });
    }

    // Por defecto devuelve todas las predicciones
    const rows = sheetPred.getDataRange().getValues();
    const result = {};
    for (let i = 1; i < rows.length; i++) {
      const pName = rows[i][0];
      const time = rows[i][1];
      const jsonStr = rows[i][2];
      if (pName && jsonStr) {
        try {
          result[pName] = { timestamp: time, predictions: JSON.parse(jsonStr) };
        } catch(err) {}
      }
    }
    return createResponse({ status: 'success', data: result });
  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  }
}


function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3. Implementar
Dale a **Implementar > Nueva implementación** y asegúrate de elegir **"Cualquier Persona"** como antes. Copia la nueva URL y asegúrate de actualizarla en la constante `SCRIPT_URL` de tus archivos.

URL Actualizada: `https://script.google.com/macros/s/AKfycbwUG7NAswIhcLn90C6JkA_Dt-45HBz8Klvmwij2UO0ilh85KUs6tUTz05-wALfTulnN/exec`

