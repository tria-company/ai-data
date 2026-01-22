
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

async function debugTargets() {
    console.log('Fetching targets with raw query...');
    try {
        const { data, error } = await supabase
            .from('users_scrapping')
            .select('*')
            .limit(5);

        if (error) {
            console.error('❌ Error fetching targets:', error.message);
        } else {
            console.log('✅ Targets Data:', JSON.stringify(data, null, 2));

            // Seed if empty for testing
            if (data && data.length === 0) {
                console.log('⚠️ No targets found. Inserting test targets...');
                const { error: insertError } = await supabase.from('users_scrapping').insert([
                    { user: 'mosseri', status: 'pending' },
                    { user: 'instagram', status: 'pending' }
                ]);
                if (insertError) {
                    // Try 'username' column if 'user' fails
                    console.log("Insert failed with 'user' column, trying 'username'...");
                    await supabase.from('users_scrapping').insert([
                        { username: 'mosseri', status: 'pending' }
                    ]);
                } else {
                    console.log("✅ Inserted test targets (mosseri, instagram)");
                }
            }
        }
    } catch (e: any) {
        console.error('❌ Unexpected error:', e.message);
    }
}

debugTargets();
