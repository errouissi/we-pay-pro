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

      case "createUser":
        return handleCreateUser(body);

      case "getUsers":
        return handleGetUsers(body);

      case "updateUser":
        return handleUpdateUser(body);

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

  const matchedUser = rows
    .map((row) => rowToObject(headers, row))
    .find((item) => {
      return (
        String(item.username || "").trim() === username &&
        String(item.password || "").trim() === password
      );
    });

  if (!matchedUser) {
    return jsonResponse({
      success: false,
      message: "Identifiants incorrects",
    });
  }

  // Only "blocked" is treated as blocked.
  // Missing, empty, or any other unknown status allows login (backward compat).
  if (String(matchedUser.status || "").trim().toLowerCase() === "blocked") {
    return jsonResponse({
      success: false,
      message: "Votre compte est bloqué. Veuillez contacter l'administrateur.",
    });
  }

  return jsonResponse({
    success: true,
    user: {
      user_id: matchedUser.user_id,
      username: matchedUser.username,
      name: matchedUser.name,
      role: String(matchedUser.role || "").trim().toLowerCase() === "admin" ? "admin" : "commercial",
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

  const cinRectoLink = uploadBase64File(folder, body.cinRecto, clientId, "cin-recto").url;
  const cinVersoLink = uploadBase64File(folder, body.cinVerso, clientId, "cin-verso").url;
  const pieceJointeLink = uploadBase64File(folder, body.pieceJointe, clientId, "piece-jointe").url;

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

  const isAdmin = getUserRole(userId) === "admin";

  const clients = rows
    .map((row) => rowToObject(headers, row))
    .filter((client) => {
      if (isAdmin) return true;
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
    "email",
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

  const email = String(body.email || "").trim();
  if (!isValidEmail(email)) {
    throw new Error("Invalid email address");
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

  const photoDocument = uploadBase64File(folder, body.photoDocument, agentId, "photo-document");
  const cinRecto      = uploadBase64File(folder, body.cinRecto,       agentId, "cin-recto");
  const cinVerso      = uploadBase64File(folder, body.cinVerso,       agentId, "cin-verso");
  const photoLocal    = uploadBase64File(folder, body.photoLocal,     agentId, "photo-local");

  const sheet = getOrCreateAgentsSheet();

  sheet.appendRow([
    new Date(),
    body.nom,
    body.prenom,
    "", // telephone written as text below to preserve leading 0 (col 4)
    email, // col 5
    typeAgent,
    photoDocument.url,
    cinRecto.url,
    cinVerso.url,
    photoLocal.url,
    latitude,
    longitude,
    localisationLink,
    body.userId,
    body.userName,
    "", // agent_pdf_url — updated below after PDF generation (col 16)
  ]);

  const lastRow = sheet.getLastRow();
  const telephoneColumnIndex = 4; // column D — same trick as createClient

  sheet
    .getRange(lastRow, telephoneColumnIndex)
    .setNumberFormat("@")
    .setValue("'" + normalizedTelephone);

  // Generate PDF after the row is saved — failure here does not lose the agent
  var agentPdfUrl = "";
  var agentPdfError = "";
  try {
    agentPdfUrl = generateAgentPdf(folder, {
      nom: body.nom,
      prenom: body.prenom,
      telephone: normalizedTelephone,
      email: email,
      typeAgent: typeAgent,
      localisationLink: localisationLink,
    }, {
      photoDocument: photoDocument.fileId,
      cinRecto: cinRecto.fileId,
      cinVerso: cinVerso.fileId,
      photoLocal: photoLocal.fileId,
    });
  } catch (pdfError) {
    agentPdfError = String(pdfError.message || pdfError);
    Logger.log("PDF generation failed: " + agentPdfError);
  }

  if (agentPdfUrl) {
    var pdfColIndex = getAgentPdfColumnIndex(sheet);
    sheet.getRange(lastRow, pdfColIndex).setValue(agentPdfUrl);
  }

  return jsonResponse({
    success: true,
    message: "Agent enregistré avec succès",
    pdf_debug: agentPdfError || null,
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

  const isAdmin = getUserRole(userId) === "admin";

  const agents = rows
    .map((row) => rowToObject(headers, row))
    .filter((agent) => {
      if (isAdmin) return true;
      return String(agent.created_by_user_id || "").trim() === userId;
    })
    .map((agent) => ({
      created_at: formatDate(agent.created_at),
      created_by_user_id: agent.created_by_user_id || "",
      created_by_username: agent.created_by_username || "",
      nom: agent.nom || "",
      prenom: agent.prenom || "",
      telephone: agent.telephone || "",
      email: agent.email || "",
      type_agent: agent.type_agent || "",
      document_photo_url: agent.document_photo_url || "",
      cin_recto_url: agent.cin_recto_url || "",
      cin_verso_url: agent.cin_verso_url || "",
      local_photo_url: agent.local_photo_url || "",
      latitude: agent.latitude || "",
      longitude: agent.longitude || "",
      localisation_link: agent.localisation_link || "",
      agent_pdf_url: agent.agent_pdf_url || "",
    }));

  return jsonResponse({ success: true, agents });
}

function handleCreateUser(body) {
  var requesterId = String(body.requesterId || "").trim();
  if (getUserRole(requesterId) !== "admin") {
    return jsonResponse({ success: false, message: "Accès refusé" });
  }

  var username = String(body.username || "").trim();
  var password = String(body.password || "").trim();
  var name     = String(body.name || "").trim();

  if (!username || !password || !name) {
    throw new Error("username, password et name sont requis");
  }

  var sheet   = getSheet(USERS_SHEET_NAME);
  var values  = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows    = values.slice(1);

  var exists = rows
    .map(function(row) { return rowToObject(headers, row); })
    .some(function(u) {
      return String(u.username || "").trim().toLowerCase() === username.toLowerCase();
    });

  if (exists) {
    throw new Error("Ce nom d'utilisateur est déjà utilisé");
  }

  var colMap = getSheetColumnMap(sheet);
  var newRow = new Array(sheet.getLastColumn()).fill("");
  var userId = generateUserId();

  if (colMap.user_id)  newRow[colMap.user_id  - 1] = userId;
  if (colMap.username) newRow[colMap.username  - 1] = username;
  if (colMap.password) newRow[colMap.password  - 1] = password;
  if (colMap.name)     newRow[colMap.name      - 1] = name;
  if (colMap.status)   newRow[colMap.status    - 1] = "active";
  if (colMap.role)     newRow[colMap.role      - 1] = "commercial"; // always commercial — admin creation not supported from UI

  sheet.appendRow(newRow);

  return jsonResponse({
    success: true,
    message: "Utilisateur créé avec succès",
    user_id: userId,
  });
}

function handleGetUsers(body) {
  var requesterId = String(body.requesterId || "").trim();
  if (getUserRole(requesterId) !== "admin") {
    return jsonResponse({ success: false, message: "Accès refusé" });
  }

  var sheet  = getSheet(USERS_SHEET_NAME);
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return jsonResponse({ success: true, users: [] });
  }

  var headers = values[0];
  var rows    = values.slice(1);

  var users = rows
    .map(function(row) { return rowToObject(headers, row); })
    .filter(function(u) { return String(u.username || "").trim() !== ""; })
    .map(function(u) {
      return {
        user_id:  String(u.user_id  || ""),
        username: String(u.username || ""),
        name:     String(u.name     || ""),
        role:     String(u.role || "").trim().toLowerCase() === "admin" ? "admin" : "commercial",
        status:   String(u.status   || ""),
      };
    });

  return jsonResponse({ success: true, users: users });
}

function handleUpdateUser(body) {
  var requesterId = String(body.requesterId || "").trim();
  if (getUserRole(requesterId) !== "admin") {
    return jsonResponse({ success: false, message: "Accès refusé" });
  }

  var targetUserId = String(body.user_id || "").trim();
  var name         = String(body.name || "").trim();
  var username     = String(body.username || "").trim();
  var status       = String(body.status || "").trim().toLowerCase();
  var password     = String(body.password || "").trim();

  if (!targetUserId || !name || !username) {
    return jsonResponse({ success: false, message: "user_id, name et username sont requis" });
  }

  if (status !== "active" && status !== "blocked") {
    return jsonResponse({ success: false, message: "Statut invalide. Valeurs acceptées : active, blocked" });
  }

  if (requesterId === targetUserId && status === "blocked") {
    return jsonResponse({ success: false, message: "Vous ne pouvez pas bloquer votre propre compte." });
  }

  var sheet   = getSheet(USERS_SHEET_NAME);
  var values  = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows    = values.slice(1);

  var targetRowIndex = -1;
  for (var i = 0; i < rows.length; i++) {
    var u = rowToObject(headers, rows[i]);
    if (String(u.user_id || "").trim() === targetUserId) {
      targetRowIndex = i + 2; // +1 for header row, +1 for 1-based index
      break;
    }
  }

  if (targetRowIndex === -1) {
    return jsonResponse({ success: false, message: "Utilisateur non trouvé" });
  }

  var usernameConflict = rows
    .map(function(row) { return rowToObject(headers, row); })
    .some(function(u) {
      return String(u.user_id || "").trim() !== targetUserId &&
             String(u.username || "").trim().toLowerCase() === username.toLowerCase();
    });

  if (usernameConflict) {
    return jsonResponse({ success: false, message: "Ce nom d'utilisateur est déjà utilisé" });
  }

  var colMap = getSheetColumnMap(sheet);

  if (!colMap.status) {
    return jsonResponse({ success: false, message: "La colonne status est manquante dans la feuille Users." });
  }

  if (colMap.name)     sheet.getRange(targetRowIndex, colMap.name).setValue(name);
  if (colMap.username) sheet.getRange(targetRowIndex, colMap.username).setValue(username);
  sheet.getRange(targetRowIndex, colMap.status).setValue(status);
  if (password && colMap.password) sheet.getRange(targetRowIndex, colMap.password).setValue(password);
  // role is intentionally never updated here

  return jsonResponse({ success: true, message: "Utilisateur mis à jour avec succès" });
}

function generateUserId() {
  var now = new Date();
  var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  var random = Math.floor(Math.random() * 9000) + 1000;
  return "U" + timestamp + random;
}

function getSheetColumnMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function(h, i) {
    map[String(h).trim()] = i + 1;
  });
  return map;
}

function generateAgentPdf(folder, agentInfo, fileIds) {
  var docName = agentInfo.nom + " " + agentInfo.prenom;
  Logger.log("generateAgentPdf: start — " + docName);

  var doc = DocumentApp.create(docName);
  Logger.log("generateAgentPdf: doc created — id=" + doc.getId());

  var body = doc.getBody();

  var titlePara = body.appendParagraph(docName);
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph("");
  body.appendParagraph("Téléphone : " + agentInfo.telephone);
  body.appendParagraph("Email : " + agentInfo.email);
  body.appendParagraph("Type agent : " + agentInfo.typeAgent);
  body.appendParagraph("");

  var locPara = body.appendParagraph("Localisation du local : ");
  locPara.appendText(agentInfo.localisationLink).setLinkUrl(agentInfo.localisationLink);
  body.appendParagraph("");

  var sections = [
    { label: "Photo document",           fileId: fileIds.photoDocument },
    { label: "CIN Recto",                fileId: fileIds.cinRecto },
    { label: "CIN Verso",                fileId: fileIds.cinVerso },
    { label: "Photo du local / magasin", fileId: fileIds.photoLocal },
  ];

  sections.forEach(function(section) {
    Logger.log("generateAgentPdf: inserting image — " + section.label + " fileId=" + section.fileId);
    body.appendParagraph(section.label).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    try {
      var imageBlob = DriveApp.getFileById(section.fileId).getBlob();
      var image = body.appendImage(imageBlob);
      var originalWidth = image.getWidth();
      var originalHeight = image.getHeight();
      var maxWidth = 400;
      if (originalWidth > maxWidth) {
        var ratio = maxWidth / originalWidth;
        image.setWidth(maxWidth).setHeight(Math.round(originalHeight * ratio));
      }
    } catch (imgErr) {
      Logger.log("generateAgentPdf: image insert failed — " + section.label + " — " + imgErr.message);
      body.appendParagraph("[Image non disponible]");
    }
    body.appendParagraph("");
  });

  doc.saveAndClose();
  Logger.log("generateAgentPdf: doc saved, exporting PDF");

  var docFile = DriveApp.getFileById(doc.getId());
  var pdfBlob = docFile.getAs("application/pdf");
  pdfBlob.setName(docName + ".pdf");

  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  docFile.setTrashed(true);

  Logger.log("generateAgentPdf: done — pdfId=" + pdfFile.getId());
  return "https://drive.google.com/file/d/" + pdfFile.getId() + "/view";
}

function getAgentPdfColumnIndex(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = headers.indexOf("agent_pdf_url");
  if (idx >= 0) {
    return idx + 1;
  }
  // Column not found — add it to the end of the header row
  var newColIndex = lastCol + 1;
  sheet.getRange(1, newColIndex).setValue("agent_pdf_url");
  return newColIndex;
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

  return {
    url: `https://drive.google.com/file/d/${fileId}/view`,
    fileId: fileId,
  };
}

function normalizeMoroccanPhone(value) {
  return String(value || "").replace(/\s/g, "");
}

function isValidMoroccanPhone(value) {
  return /^(05|06|07)\d{8}$/.test(value);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getUserRole(userId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) return "commercial";

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return "commercial";

  var headers = values[0];
  var rows = values.slice(1);

  var found = rows
    .map(function(row) { return rowToObject(headers, row); })
    .find(function(u) { return String(u.user_id || "").trim() === String(userId || "").trim(); });

  if (!found) return "commercial";
  return String(found.role || "").trim().toLowerCase() === "admin" ? "admin" : "commercial";
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
      "email",
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
      "agent_pdf_url",
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