
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

export async function launchBrowser(options: BrowserOptions) {
    const { userDataDir } = options;

    // MANDATORY SERVERLESS ARGS
    // We remove any "local" logic because Vercel/Serverless treats everything as remote.
    // Even if running locally, we want to simulate the serverless behavior to catch issues.

    let executablePath = await chromium.executablePath();

    // Default Vercel/Serverless Args for Stability
    const args = [
        ...chromium.args,
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-features=IsolateOrigins,site-per-process",
        // Anti-detection:
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ];

    // Force Headless
    const headlessMode = true;

    return await puppeteer.launch({
        args: args,
        defaultViewport: { width: 1920, height: 1080 }, // Explicit viewport
        executablePath: executablePath as any,
        headless: headlessMode ? "shell" : true, // "shell" is the new headless mode in newer puppeteer, boolean true also works
        ignoreDefaultArgs: ["--enable-automation"],
        userDataDir: userDataDir,
        dumpio: false, // Clean logs
    });
}
