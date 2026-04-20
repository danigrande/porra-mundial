# Implementación en Google Sheets

Para que la web guarde las predicciones en tu Google Sheet automáticamente, debes crear un pequeño "backend" con Google Apps Script. 

Sigue estos pasos EXACTAMENTE en este orden desde tu cuenta **aidgrandecuevas@gmail.com**:

## Paso 1: Preparar el Google Sheet
1. Abre tu Google Sheet: https://docs.google.com/spreadsheets/d/10uxR-RUf3ikur_3Yp_iQuNpfLRYES599HO3poQL7Jrw/edit
2. Crea una **nueva pestaña** llamándola exactamente: `PrediccionesJSON`
   *(Las otras tres pestañas WORLDCUP, Pool y Fixture déjalas como están)*
3. En la fila 1 de la nueva pestaña `PrediccionesJSON` pon los siguientes encabezados:
   - Celda A1: `Player`
   - Celda B1: `Timestamp`
   - Celda C1: `Data`

## Paso 2: Crear el Google Apps Script
1. En el menú superior de Google Sheets, ve a **Extensiones > Apps Script**.
2. Se abrirá una nueva pestaña (editor de código). Borra todo lo que haya y pega este código:

```javascript
const SHEET_NAME = 'PrediccionesJSON';

function doPost(e) {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error("La pestaña " + SHEET_NAME + " no existe.");
    }

    // Parse the incoming JSON data
    let body = {};
    if (e.postData && e.postData.contents) {
       body = JSON.parse(e.postData.contents);
    } else {
       // Fallback for form data testing
       body = e.parameter;
    }

    const { action, playerName, predictions } = body;

    if (action === 'save') {
      if (!playerName) throw new Error("Nombre de jugador obligatorio");

      // Buscar si el jugador ya existe
      const data = sheet.getDataRange().getValues();
      let rowToUpdate = -1;
      
      // Start from 1 to skip header row
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === playerName) {
          rowToUpdate = i + 1; // +1 because array is 0-indexed and row is 1-indexed
          break;
        }
      }

      const timestamp = new Date();
      const stringifiedData = typeof predictions === 'string' ? predictions : JSON.stringify(predictions);

      if (rowToUpdate > -1) {
        // Actualizar jugador existente
        sheet.getRange(rowToUpdate, 2).setValue(timestamp);
        sheet.getRange(rowToUpdate, 3).setValue(stringifiedData);
      } else {
        // Añadir nuevo jugador
        sheet.appendRow([playerName, timestamp, stringifiedData]);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Predicciones guardadas' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error("Acción no válida");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error("La pestaña " + SHEET_NAME + " no existe.");
    }
    
    // Obtener todos los datos
    const data = sheet.getDataRange().getValues();
    const result = {};
    
    // Saltamos la fila 1 (cabeceras)
    for (let i = 1; i < data.length; i++) {
      const playerName = data[i][0];
      const timestamp = data[i][1];
      const jsonStr = data[i][2];
      
      if (playerName && jsonStr) {
        try {
          result[playerName] = {
            timestamp: timestamp,
            predictions: JSON.parse(jsonStr)
          };
        } catch(err) {
          // Ignorar fila si el JSON está malformado
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. Haz clic en el icono de disco (Guardar) arriba a la izquierda.
4. Ponle de nombre al proyecto "Porra Mundial 2026 API" o similar.

## Paso 3: Desplegar la API
1. Arriba a la derecha, haz clic en el botón azul **"Implementar"** (o Deploy) -> **"Nueva implementación"** (New deployment).
2. Haz clic en el icono de rueda dentada (Seleccionar tipo) y elige **"Aplicación web"** (Web app).
3. Rellena los siguientes campos **EXACTAMENTE ASÍ**:
   - **Descripción:** API Porra Mundial
   - **Ejecutar como (Execute as):** Yo (Me - aidgrandecuevas@gmail.com)
   - **Quién tiene acceso (Who has access):** Cualquier persona (Anyone)
     *(¡Importante! No elijas "Cualquier persona con cuenta de Google", sino "Cualquier persona" a secas, para que tus amigos no tengan que iniciar sesión de google para usar la web)*
4. Haz clic en **Implementar**.
5. Google te pedirá permisos. Dale a "Autorizar accesos", elige tu cuenta, puede que salga un aviso de "Google no ha verificado esta aplicación" -> dale a "Configuración avanzada" abajo y "Ir a Proyecto (inseguro)" y dale a "Permitir".
6. Se generará una **URL de la aplicación web** (empieza por `https://script.google.com/macros/s/...`). 
7. **COPIA ESA URL.**
https://script.google.com/macros/s/AKfycbx6pGgaZd4-sv8oBfZZSN2ylgvp7-yVZis2KdOm14RE7uTbV9ypdMXlr3zjPBZC4VRy/exec

## Paso 4: Añadir la URL a los archivos HTML
Ahora necesitas reemplazar el texto `TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI` en los archivos `worldcup.html` y `pool.html` con la URL que acabas de copiar de Google Apps Script.

(Ya he modificado los archivos para que estén listos para recibirla).
