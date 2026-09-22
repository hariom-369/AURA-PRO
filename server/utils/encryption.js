import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

let cachedKey;
function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!raw) {
    const err = new Error(
      'PAYOUT_ENCRYPTION_KEY is not configured — cannot encrypt/decrypt seller payout fields. Generate one with `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` and set it in server/.env.'
    );
    err.statusCode = 503;
    throw err;
  }
  // Accept a 64-char hex string (32 bytes) — the format the setup docs generate.
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    const err = new Error('PAYOUT_ENCRYPTION_KEY must decode to exactly 32 bytes (a 64-character hex string).');
    err.statusCode = 503;
    throw err;
  }
  cachedKey = key;
  return cachedKey;
}

// Encrypts a plaintext string for at-rest storage. Returns a single string
// (`iv:authTag:ciphertext`, all hex) safe to store directly in a schema field.
export function encryptSecret(plaintext) {
  if (plaintext === undefined || plaintext === null || plaintext === '') return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

// Reverses encryptSecret. Only ever call this from a trusted, narrowly-scoped
// admin/seller-self code path — never return the result directly from an API.
export function decryptSecret(stored) {
  if (!stored) return null;
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted payload.');
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}

// Last 4 characters only — safe to store in plaintext and return from APIs
// for display ("···· 4821"), never enough to identify the full number.
export function last4(value) {
  if (!value) return '';
  const digitsOnly = String(value).replace(/\s+/g, '');
  return digitsOnly.slice(-4);
}
