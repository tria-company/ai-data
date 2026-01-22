
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

async function checkTargets() {
    console.log('Fetching targets...');
    try {
        const { data, error, count } = await supabase
            .from('users_scrapping')
            .select('*', { count: 'exact' })
            .limit(20);

        if (error) {
            console.error('❌ Error fetching targets:', error.message);
        } else {
            console.log(`✅ Found ${count} total targets (showing first ${data.length}):`);
            data.forEach(t => console.log(` - [${t.id}] ${t.user} (${t.status})`));

            if (count === 0) {
                console.log("⚠️ Table 'users_scrapping' is empty. Please add targets.");
            }
        }
    } catch (e: any) {
        console.error('❌ Unexpected error:', e.message);
    }
}

checkTargets();
