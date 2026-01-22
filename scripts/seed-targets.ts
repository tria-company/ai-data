
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

async function seedTargets() {
    console.log('Seeding targets...');

    // Clean valid targets first? No, just upsert.
    // Actually, let's delete rows where user is null if any.
    // But safest is just to insert known good ones.

    const targets = ['instagram', 'mosseri', 'creators'];

    for (const user of targets) {
        const { error } = await supabase.from('users_scrapping').upsert({
            user: user,
            status: 'pending',
            data_ultimo_scrapping: null
        }, { onConflict: 'user' as any }); // assuming 'user' has unique constraint or PK

        if (error) {
            console.error(`❌ Error inserting ${user}: ${error.message}`);
            // Fallback if 'user' is not unique but 'id' is PK. we might just insert.
            if (error.code === '23505') { // unique violation
                console.log(`Target ${user} already exists.`);
            }
        } else {
            console.log(`✅ Upserted ${user}`);
        }
    }
}

seedTargets();
