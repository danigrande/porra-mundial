// ============================================
// GOOGLE APPS SCRIPT — BACKEND TOTAL V4 (SCALED & CLEAN)
// ============================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

/**
 * Punto de entrada para peticiones GET.
 */
function doGet(e) {
  const action = e.parameter.action;
  const groupName = e.parameter.groupName;
  
  console.log(`[API GET] Action: ${action}, Group: ${groupName}`);

  const handlers = {
    "getPhoneMapping": () => getPhoneMapping(groupName),
    "getGroupsForPlayer": () => getGroupsForPlayer(e.parameter.playerName),
    "getPlayers": () => getPlayers(groupName),
    "getAllInfo": () => getAllInfo(groupName),
    "getPredictions": () => getPredictions(groupName),
    "getRules": () => getRules(groupName),
    "getAllSummaries": () => getAllSummaries(groupName),
    "listGroups": () => listGroups()
  };

  if (handlers[action]) {
    try {
      const result = handlers[action]();
      return (result && result.setMimeType) ? result : createResponse({ status: "success", data: result });
    } catch (err) {
      return createResponse({ status: "error", message: err.toString() });
    }
  }

  return createResponse({ status: "error", message: "Acción GET no válida: " + action });
}

/**
 * Punto de entrada para peticiones POST.
 */
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const groupName = params.groupName;
  const name = params.playerName;

  console.log(`[API POST] Action: ${action}, Group: ${groupName}, Player: ${name}`);

  const handlers = {
    "login": () => login(name, params.playerPin, groupName),
    "register": () => register(name, params.playerPin, groupName, params.isNewGroup),
    "savePredictions": () => savePredictions(name, groupName, params.predictions),
    "saveInfo": () => savePlayerInfo(name, groupName, params.data),
    "updatePhone": () => updatePlayerPhone(name, groupName, params.phone),
    "saveSummary": () => saveSummary(name, groupName, params.summary),
    "saveRules": () => saveRules(name, groupName, params.data),
    "addPlayer": () => addPlayer(name, groupName)
  };

  if (handlers[action]) {
    try {
      return handlers[action]();
    } catch (err) {
      return createResponse({ status: "error", message: err.toString() });
    }
  }

  return createResponse({ status: "error", message: "Acción POST no válida: " + action });
}

// --- FUNCIONES AUXILIARES DE GESTIÓN DE HOJAS ---

function getSheet(name, autoCreate = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet && autoCreate) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  return {
    sheet: sheet,
    headers: values[0],
    rows: values.slice(1),
    allValues: values
  };
}

/**
 * Busca el índice de una columna por su nombre.
 */
function getColIdx(headers, colName) {
  const idx = headers.indexOf(colName);
  if (idx === -1) throw new Error(`Columna '${colName}' no encontrada`);
  return idx;
}

// --- IMPLEMENTACIÓN DE ACCIONES ---

function getPlayers(groupName) {
  const data = getSheetData("playersJSON");
  if (!data) return [];
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const nameIdx = getColIdx(data.headers, "Jugador");
  
  return data.rows
    .filter(row => row[groupIdx] === groupName)
    .map(row => row[nameIdx]);
}

function getGroupsForPlayer(playerName) {
  if (!playerName) return [];
  const data = getSheetData("playersJSON");
  if (!data) return [];
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const nameIdx = getColIdx(data.headers, "Jugador");
  const searchName = playerName.trim().toLowerCase();
  
  const groups = data.rows
    .filter(row => row[nameIdx] && row[nameIdx].toString().trim().toLowerCase() === searchName)
    .map(row => row[groupIdx])
    .filter(g => g);
    
  return [...new Set(groups)];
}

function login(name, pin, groupName) {
  const data = getSheetData("playersJSON");
  if (!data) return createResponse({ status: "error", message: "No hay datos de jugadores" });
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const nameIdx = getColIdx(data.headers, "Jugador");
  const pinIdx = getColIdx(data.headers, "PIN");
  
  const user = data.rows.find(row => 
    row[groupIdx] === groupName && 
    row[nameIdx] === name && 
    row[pinIdx].toString() === pin.toString()
  );

  if (user) {
    return createResponse({ status: "success", isAdmin: checkIsAdmin(name, groupName) });
  }
  return createResponse({ status: "error", message: "PIN o Grupo incorrecto" });
}

function register(name, pin, groupName, isNewGroup) {
  const playerSheet = getSheet("playersJSON", true);
  const groupSheet = getSheet("groupsJSON", true);
  
  const groupData = groupSheet.getDataRange().getValues();
  const groupNameIdx = groupData[0].indexOf("GroupName");
  
  if (groupData.slice(1).some(row => row[groupNameIdx]?.toString().toLowerCase() === groupName.toLowerCase())) {
    return createResponse({ status: "error", message: "El grupo ya existe" });
  }

  groupSheet.appendRow([groupName, name, "{}"]);
  playerSheet.appendRow([groupName, name, pin, ""]); 
  
  return createResponse({ status: "success", message: "Grupo creado con éxito" });
}

function checkIsAdmin(name, groupName) {
  const data = getSheetData("groupsJSON");
  if (!data) return false;
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const adminIdx = getColIdx(data.headers, "AdminName");
  
  return data.rows.some(row => row[groupIdx] === groupName && row[adminIdx] === name);
}

function getPredictions(groupName) {
  const data = getSheetData("predictionsJSON");
  if (!data) return {};
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const nameIdx = getColIdx(data.headers, "Jugador");
  const tsIdx = getColIdx(data.headers, "Timestamp");
  const predIdx = getColIdx(data.headers, "Predictions");
  
  const result = {};
  data.rows.forEach(row => {
    if (!groupName || row[groupIdx] === groupName) {
      result[row[nameIdx]] = {
        timestamp: row[tsIdx],
        predictions: JSON.parse(row[predIdx] || "{}")
      };
    }
  });
  return result;
}

function savePredictions(name, groupName, predictions) {
  const sheet = getSheet("predictionsJSON", true);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const timestamp = new Date().toISOString();
  const predString = JSON.stringify(predictions);

  // Si no hay cabeceras, las ponemos
  if (headers.length < 2) {
    sheet.appendRow(["GroupName", "Jugador", "Timestamp", "Predictions"]);
    sheet.appendRow([groupName, name, timestamp, predString]);
    return createResponse({ status: "success" });
  }

  const groupIdx = headers.indexOf("GroupName");
  const nameIdx = headers.indexOf("Jugador");

  for (let i = 1; i < data.length; i++) {
    if (data[i][groupIdx] === groupName && data[i][nameIdx] === name) {
      sheet.getRange(i + 1, 3, 1, 2).setValues([[timestamp, predString]]);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([groupName, name, timestamp, predString]);
  return createResponse({ status: "success" });
}

function getRules(groupName) {
  const data = getSheetData("groupsJSON");
  if (!data) return createResponse({ status: "error", message: "Sin datos" });
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const rulesIdx = getColIdx(data.headers, "Rules");
  
  const row = data.rows.find(r => r[groupIdx] === groupName);
  if (row) {
    return createResponse({ status: "success", data: JSON.parse(row[rulesIdx] || "{}") });
  }
  return createResponse({ status: "error", message: "Grupo no encontrado" });
}

function saveRules(name, groupName, rules) {
  if (!checkIsAdmin(name, groupName)) return createResponse({ status: "error", message: "No eres admin" });
  
  const sheet = getSheet("groupsJSON");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const groupIdx = headers.indexOf("GroupName");
  const rulesIdx = headers.indexOf("Rules");

  for (let i = 1; i < data.length; i++) {
    if (data[i][groupIdx] === groupName) {
      sheet.getRange(i + 1, rulesIdx + 1).setValue(JSON.stringify(rules));
      return createResponse({ status: "success" });
    }
  }
  return createResponse({ status: "error", message: "Grupo no encontrado" });
}

function addPlayer(name, groupName) {
  const sheet = getSheet("playersJSON", true);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  if (headers.length < 2) {
    sheet.appendRow(["GroupName", "Jugador", "PIN", "Telefono"]);
  }

  const groupIdx = headers.indexOf("GroupName");
  const nameIdx = headers.indexOf("Jugador");

  if (data.slice(1).some(row => row[groupIdx] === groupName && row[nameIdx].toString().trim() === name.toString().trim())) {
    return createResponse({ status: "error", message: "Ya existe" });
  }

  sheet.appendRow([groupName, name, "", ""]); 
  return createResponse({ status: "success" });
}

function getPhoneMapping(groupName) {
  const data = getSheetData("playersJSON");
  if (!data) return {};
  
  const nameIdx = getColIdx(data.headers, "Jugador");
  const phoneIdx = getColIdx(data.headers, "Telefono");
  const groupIdx = getColIdx(data.headers, "GroupName");
  
  const mapping = {};
  data.rows.forEach(row => {
    if (row[phoneIdx] && (!groupName || row[groupIdx] === groupName)) {
      mapping[row[phoneIdx].toString().replace(/[^0-9]/g, '')] = row[nameIdx];
    }
  });
  return mapping;
}

function updatePlayerPhone(playerName, groupName, phone) {
  const sheet = getSheet("playersJSON");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Jugador");
  const groupIdx = headers.indexOf("GroupName");
  const phoneIdx = headers.indexOf("Telefono");

  for (let i = 1; i < data.length; i++) {
    if (data[i][nameIdx] === playerName && data[i][groupIdx] === groupName) {
      sheet.getRange(i + 1, phoneIdx + 1).setValue(phone);
      return createResponse({ status: "success" });
    }
  }
  return createResponse({ status: "error", message: "No encontrado" });
}

function getAllInfo(groupName) {
  const data = getSheetData("profilesJSON");
  if (!data) return {};
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const nameIdx = getColIdx(data.headers, "Jugador");
  const infoIdx = getColIdx(data.headers, "Profile");
  
  const result = {};
  data.rows.forEach(row => {
    if (!groupName || row[groupIdx] === groupName) {
      result[row[nameIdx]] = JSON.parse(row[infoIdx] || "{}");
    }
  });
  return result;
}

function savePlayerInfo(name, groupName, info) {
  const sheet = getSheet("profilesJSON", true);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const infoString = JSON.stringify(info);

  if (headers.length < 2) {
    sheet.appendRow(["GroupName", "Jugador", "Profile"]);
  }

  const groupIdx = headers.indexOf("GroupName");
  const nameIdx = headers.indexOf("Jugador");
  const infoIdx = headers.indexOf("Profile");

  for (let i = 1; i < data.length; i++) {
    if (data[i][groupIdx] === groupName && data[i][nameIdx] === name) {
      sheet.getRange(i + 1, infoIdx + 1).setValue(infoString);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([groupName, name, infoString]);
  return createResponse({ status: "success" });
}

function getAllSummaries(groupName) {
  const data = getSheetData("summariesJSON");
  if (!data) return {};
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const nameIdx = getColIdx(data.headers, "Jugador");
  const summaryIdx = getColIdx(data.headers, "Summary");
  
  const result = {};
  data.rows.forEach(row => {
    if (!groupName || row[groupIdx] === groupName) {
      result[row[nameIdx]] = row[summaryIdx];
    }
  });
  return result;
}

function saveSummary(name, groupName, summary) {
  const sheet = getSheet("summariesJSON", true);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  if (headers.length < 2) {
    sheet.appendRow(["GroupName", "Jugador", "Summary"]);
  }

  const groupIdx = headers.indexOf("GroupName");
  const nameIdx = headers.indexOf("Jugador");
  const summaryIdx = headers.indexOf("Summary");

  for (let i = 1; i < data.length; i++) {
    if (data[i][groupIdx] === groupName && data[i][nameIdx] === name) {
      sheet.getRange(i + 1, summaryIdx + 1).setValue(summary);
      return createResponse({ status: "success" });
    }
  }
  sheet.appendRow([groupName, name, summary]);
  return createResponse({ status: "success" });
}

function listGroups() {
  const data = getSheetData("groupsJSON");
  if (!data || data.rows.length === 0) return [];
  
  const groupIdx = getColIdx(data.headers, "GroupName");
  const groups = data.rows.map(row => row[groupIdx]).filter(g => g && g.toString().trim() !== "");
  return [...new Set(groups)];
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
