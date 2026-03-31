import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { usernames, projeto } = body;

        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
            return NextResponse.json(
                { error: 'usernames deve ser um array com pelo menos um item' },
                { status: 400 }
            );
        }

        const cleaned = usernames
            .map((u: string) => u.trim().replace(/^@/, '').toLowerCase())
            .filter((u: string) => u.length > 0);

        if (cleaned.length === 0) {
            return NextResponse.json(
                { error: 'Nenhum username válido fornecido' },
                { status: 400 }
            );
        }

        const results = [];
        for (const username of cleaned) {
            const row: any = { user: username, status: 'pending' };
            if (projeto) row.projeto = projeto;

            const { data, error } = await supabase
                .from('users_scrapping')
                .insert(row)
                .select()
                .single();

            if (error) {
                // 23505 = unique_violation — already exists, skip
                if (error.code === '23505') {
                    console.log(`[targets/create] Skipped duplicate: ${username}`);
                    continue;
                }
                console.error(`[targets/create] Error inserting ${username}:`, error);
                throw error;
            }
            results.push(data);
        }

        return NextResponse.json(
            { inserted: results.length, targets: results },
            { status: 201 }
        );
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
