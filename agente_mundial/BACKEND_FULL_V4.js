// ============================================
// GOOGLE APPS SCRIPT — BACKEND TOTAL V4
// ============================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const action = e.parameter.action;
  
  // --- ACCIONES NUEVAS DEL BOT ---
  if (action === "getConfigs") {
    return createResponse({ status: "success", data: getBotConfigs() });
  }
  if (action === "getPhoneMapping") {
    return createResponse({ status: "success", data: getPhoneMapping() });
  }

  // --- ACCIONES DE LA WEB ---
  if (action === "getPlayers") {
    return getPlayers();
  }
  if (action === "getAllInfo") {
    return getAllInfo();
  }
  if (action === "getPredictions") {
    return getPredictions();
  }
  if (action === "getResults") {
    return getResults();
  }
  if (action === "getAllSummaries") {
    return getAllSummaries();
  }

  return createResponse({ status: "error", message: "Acción no válida: " + action });
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;

  if (action === "login") {
    return login(params.playerName, params.playerPin);
  }
  if (action === "register") {
    return register(params.playerName, params.playerPin);
  }
  if (action === "savePredictions") {
    return savePredictions(params.playerName, params.predictions);
  }
  if (action === "saveInfo") {
    return savePlayerInfo(params.playerName, params.data);
  }
  if (action === "updatePhone") {
    return updatePlayerPhone(params.playerName, params.phone);
  }
  if (action === "saveSummary") {
    return saveSummary(params.playerName, params.summary);
  }

  return createResponse({ status: "error", message: "Acción POST no válida" });
}

// --- IMPLEMENTACIÓN DE FUNCIONES ---

function getPlayers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  const data = sheet.getDataRange().getValues();
  const players = [];
  for (let i = 1; i < data.length; i++) {
    players.push(data[i][0]); // Columna A: Jugador
  }
  return createResponse({ status: "success", data: players });
}

function login(name, pin) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name && data[i][1].toString() === pin.toString()) {
      return createResponse({ status: "success" });
    }
  }
  return createResponse({ status: "error", message: "PIN incorrecto" });
}

function register(name, pin) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === name.toLowerCase()) {
      return createResponse({ status: "error", message: "El jugador ya existe" });
    }
  }
  sheet.appendRow([name, pin, ""]); // Nombre, PIN, Teléfono (inicialmente vacío)
  return createResponse({ status: "success" });
}

function getPredictions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("predictionsJSON");
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    result[data[i][0]] = {
      timestamp: data[i][1],
      predictions: JSON.parse(data[i][2])
    };
  }
  return createResponse({ status: "success", data: result });
}

function savePredictions(name, predictions) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("predictionsJSON");
  const data = sheet.getDataRange().getValues();
  const timestamp = new Date().toISOString();
  const predString = JSON.stringify(predictions);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[timestamp, predString]]);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([name, timestamp, predString]);
  return createResponse({ status: "success" });
}

// --- NUEVAS FUNCIONES DINÁMICAS ---

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

function getPhoneMapping() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Jugador");
  const phoneIdx = headers.indexOf("Telefono");
  
  const mapping = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][phoneIdx]) {
      mapping[data[i][phoneIdx].toString().replace(/[^0-9]/g, '')] = data[i][nameIdx];
    }
  }
  return mapping;
}

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

function getAllInfo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("profilesJSON");
  if (!sheet) return createResponse({ status: "success", data: {} });
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    result[data[i][0]] = JSON.parse(data[i][1]);
  }
  return createResponse({ status: "success", data: result });
}

function savePlayerInfo(name, info) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("profilesJSON") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("profilesJSON");
  const data = sheet.getDataRange().getValues();
  const infoString = JSON.stringify(info);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 2).setValue(infoString);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([name, infoString]);
  return createResponse({ status: "success" });
}

function getAllSummaries() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("summariesJSON");
  if (!sheet) return createResponse({ status: "success", data: {} });
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    result[data[i][0]] = data[i][1];
  }
  return createResponse({ status: "success", data: result });
}

function saveSummary(name, summary) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("summariesJSON") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("summariesJSON");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 2).setValue(summary);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([name, summary]);
  return createResponse({ status: "success" });
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
