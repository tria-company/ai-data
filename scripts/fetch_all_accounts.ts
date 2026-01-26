
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllAccounts() {
    console.log('Fetching all targets from users_scrapping...');
    let allAccounts: any[] = [];
    let from = 0;
    const step = 1000;
    let keepGoing = true;

    while (keepGoing) {
        const to = from + step - 1;
        console.log(`Fetching range ${from}-${to}...`);

        // Query users_scrapping instead of scrapper_accounts
        const { data, error } = await supabase
            .from('users_scrapping')
            .select('id, user, status, data_ultimo_scrapping')
            // .eq('status', 'pending') // Optional: filter by status if needed, but fetching all for now
            .range(from, to)
            .order('id', { ascending: true }); // Ordering by ID is usually safer for pagination

        if (error) {
            console.error('Error fetching accounts:', error);
            break;
        }

        if (data && data.length > 0) {
            allAccounts = allAccounts.concat(data);
            from += step;
            if (data.length < step) {
                keepGoing = false;
            }
        } else {
            keepGoing = false;
        }
    }

    console.log(`Total targets fetched: ${allAccounts.length}`);
    const outputPath = path.resolve('users_scrapping_dump.json');
    fs.writeFileSync(outputPath, JSON.stringify(allAccounts, null, 2));
    console.log(`Targets saved to ${outputPath}`);
}

fetchAllAccounts();
