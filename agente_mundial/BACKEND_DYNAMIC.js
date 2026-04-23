// ============================================
// GOOGLE APPS SCRIPT — BACKEND V4 (Dinámico)
// ============================================

const SPREADSHEET_ID = "TU_ID_DE_HOJA_AQUI"; // Ya lo tienes configurado

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getConfigs") {
    return createResponse({ status: "success", data: getBotConfigs() });
  }
  
  if (action === "getPhoneMapping") {
    return createResponse({ status: "success", data: getPhoneMapping() });
  }

  // ... (aquí irían tus funciones actuales de getPredictions, etc.)
  // Por brevedad, asumo que mantienes el resto igual.
  return createResponse({ status: "error", message: "Acción no válida" });
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;

  if (action === "updatePhone") {
    return updatePlayerPhone(params.playerName, params.phone);
  }
  
  // ... resto de tus funciones de guardado
}

// --- NUEVAS FUNCIONES ---

/**
 * Obtiene la configuración del bot (como el ID del grupo) desde la pestaña 'Config'
 */
function getBotConfigs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const configs = {};
  for (let i = 1; i < data.length; i++) {
    configs[data[i][0]] = data[i][1];
  }
  return configs;
}

/**
 * Obtiene el mapeo de Nombre -> Teléfono desde la pestaña 'Pool' o 'Profiles'
 * Asumimos que hay una columna llamada "Telefono"
 */
function getPhoneMapping() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON"); // Cambiado a playersJSON
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const phoneIdx = headers.indexOf("Telefono");
  const nameIdx = headers.indexOf("Jugador"); // Ajusta según tus cabeceras
  
  const mapping = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][phoneIdx]) {
      mapping[data[i][phoneIdx].toString().replace(/[^0-9]/g, '')] = data[i][nameIdx];
    }
  }
  return mapping;
}

/**
 * Actualiza el teléfono de un jugador
 */
function updatePlayerPhone(playerName, phone) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Jugador");
  const phoneIdx = headers.indexOf("Telefono");

  for (let i = 1; i < data.length; i++) {
    if (data[i][nameIdx] === playerName) {
      sheet.getRange(i + 1, phoneIdx + 1).setValue(phone);
      return createResponse({ status: "success" });
    }
  }
  return createResponse({ status: "error", message: "Jugador no encontrado" });
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
