
import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    // If limit is '0' or 'all', return max. Otherwise default to 100.
    const limit = (limitParam === '0' || limitParam === 'all') ? 10000 : (limitParam ? parseInt(limitParam) : 100);

    try {
        let query = supabase
            .from('users_scrapping')
            .select('*')
            .order('data_ultimo_scrapping', { ascending: true, nullsFirst: true })
            .limit(limit);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
