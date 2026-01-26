
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    // If limit is '0' or 'all', we set a flag to fetch all.
    const fetchAll = (limitParam === '0' || limitParam === 'all');
    // Default limit for single page if not fetching all, or pageSize for looping if fetching all
    let limit = (limitParam && !fetchAll) ? parseInt(limitParam) : 1000;

    try {
        let allData: any[] = [];
        let from = 0;
        let keepFetching = true;

        while (keepFetching) {
            const to = from + limit - 1;

            let query = supabase
                .from('users_scrapping')
                .select('*')
                .order('data_ultimo_scrapping', { ascending: true, nullsFirst: true })
                .range(from, to);

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                allData = allData.concat(data);

                // If we aren't fetching all, or if we got less than the limit, we stop.
                if (!fetchAll || data.length < limit) {
                    keepFetching = false;
                } else {
                    from += limit;
                }
            } else {
                keepFetching = false;
            }
        }

        return NextResponse.json(allData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
