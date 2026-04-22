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

    const { action, playerName, playerPin, predictions } = body;

    // --- ACCIÓN: REGISTRO ---
    if (action === 'register') {
      const sheet = ss.getSheetByName(SHEET_PLAYERS);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === playerName) throw new Error("El jugador ya existe.");
      }
      sheet.appendRow([playerName, playerPin]);
      return createResponse({ status: 'success', message: 'Usuario registrado' });
    }

    // --- ACCIÓN: LOGIN ---
    if (action === 'login') {
      const sheet = ss.getSheetByName(SHEET_PLAYERS);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === playerName && String(data[i][1]) === String(playerPin)) {
          return createResponse({ status: 'success', message: 'Login correcto' });
        }
      }
      throw new Error("Nombre o PIN incorrecto.");
    }

    // --- ACCIÓN: GUARDAR PREDICCIONES ---
    if (action === 'save') {
      const sheet = ss.getSheetByName(SHEET_PREDICTIONS);
      const data = sheet.getDataRange().getValues();
      let rowToUpdate = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === playerName) {
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
    
    // Si se pide la lista de jugadores (para el login dropdown)
    if (e.parameter.action === 'getPlayers') {
      const data = sheetPlayers.getDataRange().getValues();
      const players = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) players.push(data[i][0]);
      }
      return createResponse({ status: 'success', data: players });
    }

    // Por defecto devuelve todas las predicciones (para el Pool/Leaderboard)
    const data = sheetPred.getDataRange().getValues();
    const result = {};
    for (let i = 1; i < data.length; i++) {
      const pName = data[i][0];
      const time = data[i][1];
      const jsonStr = data[i][2];
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
