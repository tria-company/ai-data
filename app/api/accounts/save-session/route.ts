
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { accountId, cookies } = body;

        if (!accountId || !cookies) {
            return NextResponse.json({ error: 'Missing accountId or cookies' }, { status: 400 });
        }

        const cookiesJson = JSON.stringify(cookies);
        const encryptedCookies = encrypt(cookiesJson);
        const sessionData = { encrypted: encryptedCookies };

        const { error } = await supabase.from('scrapper_accounts').update({
            session_cookies: sessionData,
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq('id', accountId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
