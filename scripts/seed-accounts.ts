
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Encryption helper (duplicated here to avoid import issues with ts-node if paths not set up)
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
function getEncryptionKey() {
    if (!ENCRYPTION_KEY) return Buffer.alloc(32);
    if (ENCRYPTION_KEY.length !== 32) return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    return Buffer.from(ENCRYPTION_KEY);
}
function encrypt(text: string): string {
    if (!text) return '';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

const accounts = [
    { u: 'lucassilvasouza12314', p: '6IYw4G1f7G6R' },
    { u: 'josuebomdefaixa123', p: '6IYw4G1f7G6R@' },
    { u: 'josuebomdefaixa12345', p: '6IYw4G1f7G6R' },
    { u: 'josuelucasbomdefaixa123', p: '6IYw4G1f7G6R' },
    { u: 'josuebomdelucas2035', p: '6IYw4G1f7G6R' },
    { u: 'aleca_rlito', p: '6IYw4G1f7G6R.' },
    { u: 'madu_pipa', p: '6IYw4G1f7G6R' },
    { u: 'martelo_pai_de_heitor', p: '6IYw4G1f7G6R.' },
    { u: 'carol_raffs', p: '6IYw4G1f7G6R' },
    { u: 'nogr.afa', p: '6IYw4G1f7G6R' },
    { u: 'marianaalvesdesouza9', p: '6IYw4G1f7G6R' },
    { u: 'joaopedroribeirolima5', p: '6IYw4G1f7G6R' },
    { u: 'anacarolina.ferreira8', p: '6IYw4G1f7G6R' },
    { u: 'lucashenriqueduartesantos7', p: '6IYw4G1f7G6R' },
    { u: 'beatrizrochamenezes', p: '6IYw4G1f7G6R' },
    { u: 'gabrielcostanogueira2', p: '6IYw4G1f7G6R' },
    { u: 'brunoalmeidatavares6', p: '6IYw4G1f7G6R' },
    { u: 'isabelanunescarvalho2', p: '6IYw4G1f7G6R' },
    { u: 'lara.monteiro_2269', p: '6IYw4G1f7G6R' },
    { u: 'luana.ribeiro_2034', p: '6IYw4G1f7G6R' },
    { u: 'sofi.amrt0927', p: '6IYw4G1f7G6R' },
    { u: 'gustavo_leal3412', p: '6IYw4G1f7G6R' },
    { u: 'mariana.drt_7289', p: '6IYw4G1f7G6R' }
];

async function seed() {
    console.log(`Seeding ${accounts.length} accounts...`);

    for (const acc of accounts) {
        const encryptedPassword = encrypt(acc.p);

        const { error } = await supabase.from('scrapper_accounts').upsert({
            username: acc.u,
            password_encrypted: encryptedPassword,
            is_active: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'username' });

        if (error) {
            console.error(`❌ Failed to insert ${acc.u}:`, error.message);
        } else {
            console.log(`✅ Inserted/Updated ${acc.u}`);
        }
    }
    console.log('Seeding completed.');
}

seed();
