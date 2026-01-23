
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Define types for puppeteer options
interface BrowserOptions {
    headless: boolean;
    userDataDir?: string;
}

export async function launchBrowser(options: BrowserOptions) {
    const { headless, userDataDir } = options;

    let executablePath = await chromium.executablePath();

    // Determine if we are running locally
    const isLocal = !process.env.VERCEL && (process.platform === 'win32' || process.platform === 'darwin');

    let args: string[] = [];

    if (isLocal) {
        // LOCAL DEVELOPMENT STRATEGY
        // We do NOT use chromium.args here because they are optimized for Serverless (AWS Lambda/Vercel)
        // and cause crashes or instabilities (black screen) when running locally on Windows/Mac.

        if (process.platform === "win32") {
            const commonPaths = [
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
                "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
            ];
            const foundPath = commonPaths.find(p => fs.existsSync(p));
            if (foundPath) executablePath = foundPath;
        } else if (process.platform === "darwin") {
            executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
        } else {
            executablePath = "/usr/bin/google-chrome";
        }

        // Minimal args for local stability
        args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--window-position=0,0",
            "--ignore-certificate-errors",
            "--ignore-certificate-errors-spki-list",
            "--disable-acceleration",
            "--disable-gpu", // Keeping this disabled for stability based on recent tests
        ];

        if (!headless) {
            args.push("--window-size=1280,720");
        }

    } else {
        // VERCEL / PRODUCTION STRATEGY
        // Use sparticuz chromium args which are necessary for serverless
        args = [...chromium.args];
        // Ensure headless is enforced if required mostly

        // Add a realistic User Agent for Vercel/Serverless
        args.push("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    }

    // Common/Shared args if any (careful not to conflict)
    const extraArgs = [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
    ];

    return await puppeteer.launch({
        args: [...args, ...extraArgs],
        defaultViewport: isLocal && !headless ? { width: 1280, height: 720 } : { width: 1280, height: 720 },
        executablePath: executablePath as any,
        headless: headless ? (isLocal ? true : true) : false,
        ignoreDefaultArgs: ["--enable-automation"],
        userDataDir: userDataDir,
        dumpio: isLocal, // Log IO locally for debug
    });
}
