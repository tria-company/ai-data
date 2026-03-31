
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const { nome } = await request.json();

        if (!nome || nome.trim() === '') {
            return NextResponse.json(
                { error: 'Nome do projeto e obrigatorio' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('projetos')
            .insert({ nome: nome.trim() })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
