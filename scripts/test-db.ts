
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing Supabase connection...');
    try {
        const { data, error } = await supabase.from('scrapper_accounts').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Connection failed:', error.message);
            if (error.code === 'PGRST204') {
                console.error('👉 Hint: Did you create the table "scrapper_accounts"? Run the SQL schema provided.');
            }
        } else {
            console.log('✅ Connection successful!');
            console.log(`📊 Found ${data} accounts (count query).`);
        }
    } catch (e: any) {
        console.error('❌ Unexpected error:', e.message);
    }
}

testConnection();
