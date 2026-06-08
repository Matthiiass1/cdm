const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureFile(filePath, defaultValue) {
  ensureDir(filePath);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

function readJson(filePath, defaultValue = null) {
  try {
    ensureFile(filePath, defaultValue ?? {});
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`❌ Erreur lecture JSON ${filePath} :`, error);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  try {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Erreur écriture JSON ${filePath} :`, error);
  }
}

module.exports = {
  ensureFile,
  readJson,
  writeJson
};