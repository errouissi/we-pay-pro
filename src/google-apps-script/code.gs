const USERS_SHEET_NAME = "Users";
const CLIENTS_SHEET_NAME = "Clients";
const AGENTS_SHEET_NAME = "Agents";

// Google Drive folder ID
const DRIVE_FOLDER_ID = "1g9wXnrBn63Vy0I6mjXX4Mta7KAD4iC3g";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_OPERATORS = ["INWI", "ORANGE", "IAM"];

function doPost(e) {
  try {
    const body = parseBody(e);

    if (!body.action) {
      return jsonResponse({
        success: false,
        message: "Action is required",
      });
    }

    switch (body.action) {
      case "login":
        return handleLogin(body);

      case "createClient":
        return handleCreateClient(body);

      case "getClients":
        return handleGetClients(body);

      case "createAgent":
        return handleCreateAgent(body);

      case "getAgents":
        return handleGetAgents(body);

      default:
        return jsonResponse({
          success: false,
          message: "Unknown action",
        });
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || "Server error",
    });
  }
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body");
  }

  return JSON.parse(e.postData.contents);
}

function handleLogin(body) {
  const username = String(body.username || "").trim();
  const password = String(body.password || "").trim();

  if (!username || !password) {
    return jsonResponse({
      success: false,
      message: "Username and password are required",
    });
  }

  const sheet = getSheet(USERS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return jsonResponse({
      success: false,
      message: "No users found",
    });
  }

  const headers = values[0];
  const rows = values.slice(1);

  const user = rows
    .map((row) => rowToObject(headers, row))
    .find((item) => {
      return (
        String(item.username || "").trim() === username &&
        String(item.password || "").trim() === password &&
        String(item.status || "").trim().toLowerCase() === "active"
      );
    });

  if (!user) {
    return jsonResponse({
      success: false,
      message: "Identifiants incorrects",
    });
  }

  return jsonResponse({
    success: true,
    user: {
      user_id: user.user_id,
      username: user.username,
      name: user.name,
    },
  });
}

function handleCreateClient(body) {
  const requiredFields = [
    "userId",
    "userName",
    "nom",
    "prenom",
    "cin",
    "ville",
    "telephone",
    "operator",
    "latitude",
    "longitude",
    "localisationLink",
  ];

  requiredFields.forEach((field) => {
    if (!body[field]) {
      throw new Error(`${field} is required`);
    }
  });

  const normalizedTelephone = normalizeMoroccanPhone(body.telephone);

  if (!isValidMoroccanPhone(normalizedTelephone)) {
    throw new Error("Invalid Moroccan phone number");
  }

  const operator = String(body.operator || "").trim().toUpperCase();

  if (!ALLOWED_OPERATORS.includes(operator)) {
    throw new Error("Invalid operator");
  }

  const latitude = String(body.latitude || "").trim();
  const longitude = String(body.longitude || "").trim();
  const localisationLink = String(body.localisationLink || "").trim();

  if (!latitude || !longitude || !localisationLink) {
    throw new Error("Location is required");
  }

  if (!body.cinRecto || !body.cinVerso || !body.pieceJointe) {
    throw new Error("All files are required");
  }

  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  const clientId = generateClientId();

  const cinRectoLink = uploadBase64File(folder, body.cinRecto, clientId, "cin-recto");
  const cinVersoLink = uploadBase64File(folder, body.cinVerso, clientId, "cin-verso");
  const pieceJointeLink = uploadBase64File(folder, body.pieceJointe, clientId, "piece-jointe");

  const sheet = getSheet(CLIENTS_SHEET_NAME);

  sheet.appendRow([
    new Date(),
    clientId,
    body.nom,
    body.prenom,
    body.cin,
    body.ville,
    "", // telephone will be written as text below to keep leading 0
    operator,
    latitude,
    longitude,
    localisationLink,
    cinRectoLink,
    cinVersoLink,
    pieceJointeLink,
    body.userId,
    body.userName,
  ]);

  const lastRow = sheet.getLastRow();
  const telephoneColumnIndex = 7; // telephone column

  sheet
    .getRange(lastRow, telephoneColumnIndex)
    .setNumberFormat("@")
    .setValue("'" + normalizedTelephone);

  return jsonResponse({
    success: true,
    message: "Client enregistré avec succès",
    client_id: clientId,
  });
}

function handleGetClients(body) {
  const userId = String(body.userId || "").trim();

  if (!userId) {
    throw new Error("userId is required");
  }

  const sheet = getSheet(CLIENTS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return jsonResponse({
      success: true,
      clients: [],
    });
  }

  const headers = values[0];
  const rows = values.slice(1);

  const clients = rows
    .map((row) => rowToObject(headers, row))
    .filter((client) => {
      return String(client.created_by_user_id || "").trim() === userId;
    })
    .map((client) => ({
      timestamp: formatDate(client.timestamp),
      client_id: client.client_id || "",
      nom: client.nom || "",
      prenom: client.prenom || "",
      cin: client.cin || "",
      ville: client.ville || "",
      telephone: client.telephone || "",
      operator: client.operator || "",
      latitude: client.latitude || "",
      longitude: client.longitude || "",
      localisation_link: client.localisation_link || "",
      cin_recto_link: client.cin_recto_link || "",
      cin_verso_link: client.cin_verso_link || "",
      piece_jointe_link: client.piece_jointe_link || "",
      created_by_user_id: client.created_by_user_id || "",
      created_by_name: client.created_by_name || "",
    }));

  return jsonResponse({
    success: true,
    clients,
  });
}

function handleCreateAgent(body) {
  const requiredFields = [
    "userId",
    "userName",
    "nom",
    "prenom",
    "telephone",
    "typeAgent",
    "latitude",
    "longitude",
    "localisationLink",
  ];

  requiredFields.forEach((field) => {
    if (!body[field]) {
      throw new Error(`${field} is required`);
    }
  });

  const normalizedTelephone = normalizeMoroccanPhone(body.telephone);

  if (!isValidMoroccanPhone(normalizedTelephone)) {
    throw new Error("Invalid Moroccan phone number");
  }

  const typeAgent = String(body.typeAgent || "").trim();

  if (!["agence", "détaillant"].includes(typeAgent)) {
    throw new Error("Invalid agent type");
  }

  const latitude = String(body.latitude || "").trim();
  const longitude = String(body.longitude || "").trim();
  const localisationLink = String(body.localisationLink || "").trim();

  if (!latitude || !longitude || !localisationLink) {
    throw new Error("Location is required");
  }

  if (!body.photoDocument || !body.cinRecto || !body.cinVerso || !body.photoLocal) {
    throw new Error("All files are required");
  }

  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const agentId = generateAgentId();

  const photoDocumentUrl = uploadBase64File(folder, body.photoDocument, agentId, "photo-document");
  const cinRectoUrl = uploadBase64File(folder, body.cinRecto, agentId, "cin-recto");
  const cinVersoUrl = uploadBase64File(folder, body.cinVerso, agentId, "cin-verso");
  const photoLocalUrl = uploadBase64File(folder, body.photoLocal, agentId, "photo-local");

  const sheet = getOrCreateAgentsSheet();

  sheet.appendRow([
    new Date(),
    body.nom,
    body.prenom,
    "", // telephone written as text below to preserve leading 0
    typeAgent,
    photoDocumentUrl,
    cinRectoUrl,
    cinVersoUrl,
    photoLocalUrl,
    latitude,
    longitude,
    localisationLink,
    body.userId,
    body.userName,
  ]);

  const lastRow = sheet.getLastRow();
  const telephoneColumnIndex = 4; // column D — same trick as createClient

  sheet
    .getRange(lastRow, telephoneColumnIndex)
    .setNumberFormat("@")
    .setValue("'" + normalizedTelephone);

  return jsonResponse({
    success: true,
    message: "Agent enregistré avec succès",
  });
}

function handleGetAgents(body) {
  const userId = String(body.userId || "").trim();

  if (!userId) {
    throw new Error("userId is required");
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(AGENTS_SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ success: true, agents: [] });
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return jsonResponse({ success: true, agents: [] });
  }

  const headers = values[0];
  const rows = values.slice(1);

  const agents = rows
    .map((row) => rowToObject(headers, row))
    .filter((agent) => {
      return String(agent.created_by_user_id || "").trim() === userId;
    })
    .map((agent) => ({
      created_at: formatDate(agent.created_at),
      created_by_user_id: agent.created_by_user_id || "",
      created_by_username: agent.created_by_username || "",
      nom: agent.nom || "",
      prenom: agent.prenom || "",
      telephone: agent.telephone || "",
      type_agent: agent.type_agent || "",
      document_photo_url: agent.document_photo_url || "",
      cin_recto_url: agent.cin_recto_url || "",
      cin_verso_url: agent.cin_verso_url || "",
      local_photo_url: agent.local_photo_url || "",
      latitude: agent.latitude || "",
      longitude: agent.longitude || "",
      localisation_link: agent.localisation_link || "",
    }));

  return jsonResponse({ success: true, agents });
}

function uploadBase64File(folder, fileData, clientId, label) {
  if (!fileData || !fileData.base64) {
    throw new Error(`${label} file is missing`);
  }

  const originalName = fileData.name || `${label}`;
  const extension = getExtensionFromName(originalName);
  const contentType = getContentType(fileData.type, extension);

  const safeFileName = `${clientId}_${label}_${Date.now()}${extension}`;

  const bytes = Utilities.base64Decode(fileData.base64);

  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${label} file exceeds 10 MB`);
  }

  const blob = Utilities.newBlob(bytes, contentType, safeFileName);

  const file = folder.createFile(blob);

  // باش الرابط يتحل لأي واحد عندو link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();

  // Stable Drive URL, compatible with preview modal
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function normalizeMoroccanPhone(value) {
  return String(value || "").replace(/\s/g, "");
}

function isValidMoroccanPhone(value) {
  return /^(05|06|07)\d{8}$/.test(value);
}

function getContentType(fileType, extension) {
  if (fileType && fileType !== "application/octet-stream") {
    return fileType;
  }

  const ext = String(extension || "").toLowerCase();

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function getExtensionFromName(fileName) {
  const match = String(fileName).match(/\.[^/.]+$/);
  return match ? match[0] : "";
}

function generateClientId() {
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `C${timestamp}${random}`;
}

function generateAgentId() {
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `A${timestamp}${random}`;
}

function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  return sheet;
}

function getOrCreateAgentsSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(AGENTS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(AGENTS_SHEET_NAME);
    sheet.appendRow([
      "created_at",
      "nom",
      "prenom",
      "telephone",
      "type_agent",
      "document_photo_url",
      "cin_recto_url",
      "cin_verso_url",
      "local_photo_url",
      "latitude",
      "longitude",
      "localisation_link",
      "created_by_user_id",
      "created_by_username",
    ]);
  }

  return sheet;
}

function rowToObject(headers, row) {
  const object = {};

  headers.forEach((header, index) => {
    object[String(header).trim()] = row[index];
  });

  return object;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  }

  return String(value);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}