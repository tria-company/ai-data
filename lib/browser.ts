
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Define types for puppeteer options
interface BrowserOptions {
    headless: boolean; // Kept for interface compatibility, but ignored/enforced internally
    userDataDir?: string;
}

// Common Chrome paths for local development
const LOCAL_CHROME_PATHS = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',           // macOS
    '/Applications/Chromium.app/Contents/MacOS/Chromium',                     // macOS Chromium
    '/usr/bin/google-chrome',                                                 // Linux
    '/usr/bin/chromium-browser',                                              // Linux
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',             // Windows
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',       // Windows x86
];

function findLocalChrome(): string | null {
    for (const chromePath of LOCAL_CHROME_PATHS) {
        if (fs.existsSync(chromePath)) return chromePath;
    }
    return null;
}

export async function launchBrowser(options: BrowserOptions) {
    const { userDataDir } = options;
    const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

    let executablePath: string;
    let args: string[];

    if (isLocal) {
        // Local dev: use installed Chrome
        const localChrome = findLocalChrome();
        if (!localChrome) {
            throw new Error('Chrome not found locally. Install Google Chrome or set CHROME_PATH env var.');
        }
        executablePath = process.env.CHROME_PATH || localChrome;
        args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-features=IsolateOrigins,site-per-process",
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ];
        console.log(`🖥️ Using local Chrome: ${executablePath}`);
    } else {
        // Vercel/Serverless: use @sparticuz/chromium
        executablePath = await chromium.executablePath() as string;
        args = [
            ...chromium.args,
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-features=IsolateOrigins,site-per-process",
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ];
    }

    return await puppeteer.launch({
        args: args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: executablePath,
        headless: "shell",
        ignoreDefaultArgs: ["--enable-automation"],
        userDataDir: userDataDir,
        dumpio: false,
    });
}
