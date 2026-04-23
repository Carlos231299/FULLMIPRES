const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../electron/public.pem');

// 1. Asegurar que las llaves existan
function ensureKeys() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.log("No se encontraron llaves criptográficas. Generando un nuevo par RS256...");
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
    console.log("✅ Llaves creadas con éxito!");
    console.log(`Pública guardada en: ${PUBLIC_KEY_PATH} (para ser distribuida en la app)`);
    console.log(`Privada guardada en: ${PRIVATE_KEY_PATH} (¡MANTENER SECRETA!)`);
  }
}

function generateLicense(machineId, duration) {
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

  // Payload a incrustar en la licencia (token)
  const payload = {
    machineId: machineId,
    type: 'premium_offline'
  };

  const signOptions = {
    algorithm: 'RS256',
    expiresIn: duration
  };

  const token = jwt.sign(payload, privateKey, signOptions);
  
  console.log("\n=======================================================");
  console.log("✨ LICENCIA GENERADA CON ÉXITO ✨");
  console.log("=======================================================\n");
  console.log(`Machine ID Vinculado: ${machineId}`);
  console.log(`Válida por         : ${duration}\n`);
  console.log("Copia y entrega al cliente el siguiente bloque de texto:\n");
  console.log(token);
  console.log("\n=======================================================\n");
}

function init() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--init-keys') {
    ensureKeys();
    process.exit(0);
  }

  if (args.length < 2) {
    console.log("Uso: node keyGen.js <MACHINE_ID> <DURACION>");
    console.log("Formatos de duración: 30 = 30 días | 30s = 30 segundos | 5m = 5 minutos | 2h = 2 horas");
    console.log("Opcional: node keyGen.js --init-keys (Para forzar primera creación)");
    process.exit(1);
  }

  const machineId = args[0];
  const durationArg = args[1];

  let duration;
  // Si mandan solo un número como "30", sumimos que son días y le pegamos la "d" ("30d")
  if (/^\d+$/.test(durationArg)) {
    duration = `${durationArg}d`;
  } else {
    // Si mandan "30s", "5m", lo aceptamos como viene
    duration = durationArg;
  }

  ensureKeys();
  generateLicense(machineId, duration);
}

init();
