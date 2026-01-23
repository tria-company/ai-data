import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { accountId, cookies } = body;

        // Validation
        if (!accountId) {
            return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
        }

        if (!cookies || !Array.isArray(cookies)) {
            return NextResponse.json({ error: "Invalid cookies format. Expected array." }, { status: 400 });
        }

        // Check for essential cookie (sessionid)
        const hasSessionId = cookies.some((c: any) => c.name === 'sessionid');
        if (!hasSessionId) {
            return NextResponse.json({ error: "Invalid cookies: Missing 'sessionid' cookie. Please export cookies again while logged in." }, { status: 400 });
        }

        // Encrypt cookies
        let encryptedCookies;
        try {
            const jsonStr = JSON.stringify(cookies);
            encryptedCookies = encrypt(jsonStr);
        } catch (e) {
            console.error("Encryption error:", e);
            return NextResponse.json({ error: "Failed to encrypt cookies" }, { status: 500 });
        }

        // Saving as a JSON object with encrypted field
        const sessionData = { encrypted: encryptedCookies };

        // Save to Supabase
        const { error } = await supabase.from('scrapper_accounts').update({
            session_cookies: sessionData,
            last_login: new Date().toISOString(),
            is_active: true
        }).eq('id', accountId);

        if (error) {
            console.error("Database error:", error);
            return NextResponse.json({ error: "Failed to save to database: " + error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
