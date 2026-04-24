// ============================================
// GOOGLE APPS SCRIPT — BACKEND TOTAL V4 (SCALED)
// ============================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const action = e.parameter.action;
  const groupName = e.parameter.groupName;
  
  // --- ACCIONES NUEVAS DEL BOT ---
  if (action === "getConfigs") {
    return createResponse({ status: "success", data: getBotConfigs() });
  }
  if (action === "getPhoneMapping") {
    return createResponse({ status: "success", data: getPhoneMapping(groupName) });
  }

  if (action === "getGroupsForPlayer") {
    const playerName = e.parameter.playerName;
    return getGroupsForPlayer(playerName);
  }
  if (action === "getPlayers") {
    return getPlayers(groupName);
  }
  if (action === "getAllInfo") {
    return getAllInfo(groupName);
  }
  if (action === "getPredictions") {
    return getPredictions(groupName);
  }
  if (action === "getRules") {
    return getRules(groupName);
  }
  if (action === "getAllSummaries") {
    return getAllSummaries(groupName);
  }
  if (action === "listGroups") {
    return listGroups();
  }

  return createResponse({ status: "error", message: "Acción no válida: " + action });
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const groupName = params.groupName;

  if (action === "login") {
    return login(params.playerName, params.playerPin, groupName);
  }
  if (action === "register") {
    return register(params.playerName, params.playerPin, groupName, params.isNewGroup);
  }
  if (action === "savePredictions") {
    return savePredictions(params.playerName, groupName, params.predictions);
  }
  if (action === "saveInfo") {
    return savePlayerInfo(params.playerName, groupName, params.data);
  }
  if (action === "updatePhone") {
    return updatePlayerPhone(params.playerName, groupName, params.phone);
  }
  if (action === "saveSummary") {
    return saveSummary(params.playerName, groupName, params.summary);
  }
  if (action === "saveRules") {
    return saveRules(params.playerName, groupName, params.data);
  }

  return createResponse({ status: "error", message: "Acción POST no válida" });
}

// --- IMPLEMENTACIÓN DE FUNCIONES ---

function getPlayers(groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  if (!sheet) return createResponse({ status: "success", data: [] });
  const data = sheet.getDataRange().getValues();
  const players = [];
  for (let i = 1; i < data.length; i++) {
    // Col A: GroupName, Col B: Name
    if (data[i][0] === groupName) {
      players.push(data[i][1]); 
    }
  }
  return createResponse({ status: "success", data: players });
}

function getGroupsForPlayer(playerName) {
  if (!playerName) return createResponse({ status: "success", data: [] });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  if (!sheet) return createResponse({ status: "success", data: [] });
  const data = sheet.getDataRange().getValues();
  const groups = [];
  const searchName = playerName.trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    // Col A: GroupName, Col B: Name
    if (data[i][1] && data[i][1].toString().trim().toLowerCase() === searchName) {
      if (data[i][0]) groups.push(data[i][0]); 
    }
  }
  return createResponse({ status: "success", data: [...new Set(groups)] });
}

function login(name, pin, groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    // Col A: GroupName, Col B: Name, Col C: PIN
    if (data[i][0] === groupName && data[i][1] === name && data[i][2].toString() === pin.toString()) {
      const isAdmin = checkIsAdmin(name, groupName);
      return createResponse({ status: "success", isAdmin: isAdmin });
    }
  }
  return createResponse({ status: "error", message: "PIN o Grupo incorrecto" });
}

function register(name, pin, groupName, isNewGroup) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playerSheet = ss.getSheetByName("playersJSON") || ss.insertSheet("playersJSON");
  const groupSheet = ss.getSheetByName("groupsJSON") || ss.insertSheet("groupsJSON");
  
  const players = playerSheet.getDataRange().getValues();
  const groups = groupSheet.getDataRange().getValues();

  // 1. Validar grupo
  let groupExists = false;
  for (let i = 1; i < groups.length; i++) {
    if (groups[i][0].toLowerCase() === groupName.toLowerCase()) {
      groupExists = true;
      break;
    }
  }

  if (isNewGroup) {
    if (groupExists) return createResponse({ status: "error", message: "El grupo ya existe" });
    groupSheet.appendRow([groupName, name, "{}"]); // GroupName, AdminName, Rules
  } else {
    if (!groupExists) return createResponse({ status: "error", message: "El grupo no existe" });
  }

  // 2. Validar jugador en ese grupo
  for (let i = 1; i < players.length; i++) {
    // Col A: GroupName, Col B: Name
    if (players[i][0] === groupName && players[i][1].toLowerCase() === name.toLowerCase()) {
      return createResponse({ status: "error", message: "El jugador ya existe en este grupo" });
    }
  }

  playerSheet.appendRow([groupName, name, pin, ""]); // GroupName, Nombre, PIN, Teléfono
  return createResponse({ status: "success", isAdmin: isNewGroup });
}

function checkIsAdmin(name, groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("groupsJSON");
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupName && data[i][1] === name) return true;
  }
  return false;
}

function getPredictions(groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("predictionsJSON");
  if (!sheet) return createResponse({ status: "success", data: {} });
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    if (!groupName || data[i][0] === groupName) {
      result[data[i][1]] = { // data[i][1] is Jugador
        timestamp: data[i][2],
        predictions: JSON.parse(data[i][3])
      };
    }
  }
  return createResponse({ status: "success", data: result });
}

function savePredictions(name, groupName, predictions) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("predictionsJSON") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("predictionsJSON");
  const data = sheet.getDataRange().getValues();
  const timestamp = new Date().toISOString();
  const predString = JSON.stringify(predictions);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupName && data[i][1] === name) {
      sheet.getRange(i + 1, 3, 1, 2).setValues([[timestamp, predString]]);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([groupName, name, timestamp, predString]);
  return createResponse({ status: "success" });
}

function getRules(groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("groupsJSON");
  if (!sheet) return createResponse({ status: "error", message: "No hay grupos configurados" });
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupName) {
      return createResponse({ status: "success", data: JSON.parse(data[i][2] || "{}") });
    }
  }
  return createResponse({ status: "error", message: "Grupo no encontrado" });
}

function saveRules(name, groupName, rules) {
  if (!checkIsAdmin(name, groupName)) {
    return createResponse({ status: "error", message: "No tienes permisos de administrador" });
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("groupsJSON");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupName) {
      sheet.getRange(i + 1, 3).setValue(JSON.stringify(rules));
      return createResponse({ status: "success" });
    }
  }
  return createResponse({ status: "error", message: "Grupo no encontrado" });
}

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

function getPhoneMapping(groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Jugador");
  const phoneIdx = headers.indexOf("Telefono");
  const groupIdx = headers.indexOf("GroupName");
  
  const mapping = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][phoneIdx] && (!groupName || data[i][groupIdx] === groupName)) {
      mapping[data[i][phoneIdx].toString().replace(/[^0-9]/g, '')] = data[i][nameIdx];
    }
  }
  return mapping;
}

function updatePlayerPhone(playerName, groupName, phone) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("playersJSON");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === playerName && data[i][3] === groupName) {
      sheet.getRange(i + 1, 3).setValue(phone); // Columna C: Telefono
      return createResponse({ status: "success" });
    }
  }
  return createResponse({ status: "error", message: "Jugador no encontrado" });
}

function getAllInfo(groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("profilesJSON");
  if (!sheet) return createResponse({ status: "success", data: {} });
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    if (!groupName || data[i][0] === groupName) {
      result[data[i][1]] = JSON.parse(data[i][2]);
    }
  }
  return createResponse({ status: "success", data: result });
}

function savePlayerInfo(name, groupName, info) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("profilesJSON") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("profilesJSON");
  const data = sheet.getDataRange().getValues();
  const infoString = JSON.stringify(info);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupName && data[i][1] === name) {
      sheet.getRange(i + 1, 3).setValue(infoString);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([groupName, name, infoString]);
  return createResponse({ status: "success" });
}

function getAllSummaries(groupName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("summariesJSON");
  if (!sheet) return createResponse({ status: "success", data: {} });
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    if (!groupName || data[i][0] === groupName) {
      result[data[i][1]] = data[i][2];
    }
  }
  return createResponse({ status: "success", data: result });
}

function saveSummary(name, groupName, summary) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("summariesJSON") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("summariesJSON");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupName && data[i][1] === name) {
      sheet.getRange(i + 1, 3).setValue(summary);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([groupName, name, summary]);
  return createResponse({ status: "success" });
}

function listGroups() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("groupsJSON");
    if (!sheet) {
      // Si no existe, la creamos con cabeceras para que no falle la próxima vez
      const newSheet = ss.insertSheet("groupsJSON");
      newSheet.appendRow(["GroupName", "AdminName", "Rules"]);
      return createResponse({ status: "success", data: [], message: "Hoja creada" });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return createResponse({ status: "success", data: [] });
    
    const groups = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) groups.push(data[i][0]);
    }
    // Eliminar duplicados y valores vacíos
    const uniqueGroups = [...new Set(groups)].filter(g => g.trim() !== "");
    return createResponse({ status: "success", data: uniqueGroups });
  } catch (e) {
    return createResponse({ status: "error", message: e.toString() });
  }
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
