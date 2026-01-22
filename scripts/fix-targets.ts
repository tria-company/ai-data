
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

async function fixTargets() {
    console.log('Fixing null targets...');

    // Update null users to 'instagram' as placeholder
    const { data, error } = await supabase
        .from('users_scrapping')
        .update({ user: 'instagram' })
        .is('user', null);

    if (error) {
        console.error('❌ Error updating targets:', error.message);
    } else {
        // Also insert a known fresh one just in case
        const { error: insError } = await supabase
            .from('users_scrapping')
            .insert([{ user: 'mosseri', status: 'pending' }]);

        if (!insError) console.log("✅ Added @mosseri");
        console.log('✅ Fix applied.');
    }
}

fixTargets();
