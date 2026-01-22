
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { targetId, status, data_ultimo_scrapping } = body;

        if (!targetId || !status) {
            return NextResponse.json({ error: 'Missing targetId or status' }, { status: 400 });
        }

        const updateData: any = { status };
        if (data_ultimo_scrapping) updateData.data_ultimo_scrapping = data_ultimo_scrapping;

        const { error } = await supabase
            .from('users_scrapping')
            .update(updateData)
            .eq('id', targetId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
