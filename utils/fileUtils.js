const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureFile(filePath, defaultValue) {
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

function readJson(filePath, defaultValue) {
  try {
    ensureFile(filePath, defaultValue);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ Erreur lecture ${filePath} :`, error);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  try {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Erreur écriture ${filePath} :`, error);
  }
}

module.exports = {
  ensureDir,
  ensureFile,
  readJson,
  writeJson
};