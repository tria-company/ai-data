
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // Must be 32 chars
const IV_LENGTH = 16; // For AES, this is always 16

function getEncryptionKey() {
    if (!ENCRYPTION_KEY) {
        console.warn('ENCRYPTION_KEY not set in environment variables');
        return Buffer.alloc(32); // Fallback for dev only (unsafe) or throw error
    }
    if (ENCRYPTION_KEY.length !== 32) {
        // If key is not 32 chars, we can hash it to make it 32 chars or throw error
        // Ideally we throw, but for robustness we might hash
        return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    }
    return Buffer.from(ENCRYPTION_KEY);
}

export function encrypt(text: string): string {
    if (!text) return '';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
    if (!text) return '';
    const key = getEncryptionKey();
    const textParts = text.split(':');
    if (textParts.length < 2) return text; // Not encrypted or invalid
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
