import pptr from "puppeteer-core";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { chromePath, chromeArgs, getUserDataDir } from "./utils.js";
import {
  INSTAGRAM_URL,
  INSTAGRAM_USERNAME,
  INSTAGRAM_PASSWORD,
  BTN_LOGIN,
  USERNAME_INPUT,
  PASSWORD_INPUT,
  INSTAGRAM_LOGIN_URL,
} from "../const.js";

import instagramPostsScraper from "./instagram-posts-scraper.js";
const { extractPostsData, checkIfPrivate, scrollToBottom } =
  instagramPostsScraper;

// Config
const MAX_LOGIN_RETRIES = 3;
const MAX_POSTS_PER_ACCOUNT = 50;
const RETRY_DELAY = 5000;
const MAX_ACCOUNT_RETRIES = 2;
const ACCOUNT_TIMEOUT = 180000; // Aumentado para 180s (3 minutos) para permitir processamento de reels + carrosséis
const DELAY_BETWEEN_ACCOUNTS = 3000;

// global
let browser = null;
let shouldStop = false;
let progressCallback = null;
let portsPath = "./ports"; // Default path for development

// Function to set ports path (called from main.js)
export function setPortsPath(path) {
  portsPath = path;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sendLog(message, type = "info", data = {}) {
  if (progressCallback) {
    progressCallback({
      type: "log",
      logType: type,
      message: message,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }
  console.log(`[${type.toUpperCase()}] ${message}`);
}

async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    const cookiesDir = join(portsPath, "cookies");
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }
    const cookiesPath = join(cookiesDir, "instagram-cookies.json");
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    sendLog("Cookies saved successfully", "success");
  } catch (error) {
    sendLog(`Error saving cookies: ${error.message}`, "error");
  }
}

async function loadCookies(page) {
  try {
    const cookiesPath = join(portsPath, "cookies", "instagram-cookies.json");
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
      await page.setCookie(...cookies);
      sendLog("Cookies loaded successfully", "success");
      return true;
    }
    return false;
  } catch (error) {
    sendLog(`Error loading cookies: ${error.message}`, "warning");
    return false;
  }
}

function saveError(account, error, retryCount) {
  try {
    const outputDir = join(portsPath, "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const errorsPath = join(outputDir, "errors.json");
    let errors = [];
    if (fs.existsSync(errorsPath)) {
      errors = JSON.parse(fs.readFileSync(errorsPath, "utf8"));
    }

    errors.push({
      account,
      error: error.message,
      stack: error.stack,
      retryCount,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 2));
  } catch (err) {
    sendLog(`Failed to save error to file: ${err.message}`, "error");
  }
}

function saveSuccess(account, data) {
  try {
    const outputDir = join(portsPath, "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const successPath = join(outputDir, "success.json");
    let successes = [];
    if (fs.existsSync(successPath)) {
      successes = JSON.parse(fs.readFileSync(successPath, "utf8"));
    }

    successes.push({
      account,
      data,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(successPath, JSON.stringify(successes, null, 2));
  } catch (err) {
    sendLog(`Failed to save success to file: ${err.message}`, "error");
  }
}

async function isLoggedIn(page) {
  try {
    await delay(2000);

    const loginButton = await page.$(BTN_LOGIN);
    if (loginButton === null) {
      sendLog("Already logged in!", "success");
      return true;
    }

    const metaLoginPage =
      (await page.$('input[name="email"]')) ||
      (await page.$('input[type="email"]'));
    if (metaLoginPage) {
      sendLog("Detected Meta mobile login page", "warning");
      return false;
    }

    return false;
  } catch (error) {
    sendLog(`Error checking login status: ${error.message}`, "error");
    return false;
  }
}

async function attemptLogin(page, retryCount = 0) {
  try {
    sendLog(`Login attempt ${retryCount + 1}/${MAX_LOGIN_RETRIES}`, "info");

    sendLog("Navigating to login page...", "info");
    await page.goto(
      INSTAGRAM_LOGIN_URL || "https://www.instagram.com/accounts/login/",
      {
        waitUntil: "networkidle2",
        timeout: 30000,
      },
    );

    await delay(3000);

    sendLog("Looking for login form...", "info");
    const usernameInput = await page.$(USERNAME_INPUT);
    const passwordInput = await page.$(PASSWORD_INPUT);
    const loginButton = await page.$(BTN_LOGIN);

    if (!usernameInput || !passwordInput || !loginButton) {
      sendLog("Standard login form not found", "warning");

      const metaEmailInput = await page.$('input[name="email"]');
      if (metaEmailInput) {
        sendLog("Meta mobile authentication page detected!", "warning");
        throw new Error("Meta mobile auth page - retry needed");
      }

      throw new Error("Login form elements not found");
    }

    sendLog("Login form found! Proceeding with login...", "info");

    await page.waitForSelector(USERNAME_INPUT, { timeout: 10000 });
    await page.waitForSelector(PASSWORD_INPUT, { timeout: 10000 });

    await page.click(USERNAME_INPUT, { clickCount: 3 });
    await page.keyboard.press("Backspace");

    sendLog("Typing credentials...", "info");
    await page.type(USERNAME_INPUT, INSTAGRAM_USERNAME, { delay: 100 });
    await delay(500);

    await page.type(PASSWORD_INPUT, INSTAGRAM_PASSWORD, { delay: 100 });
    await delay(1000);

    sendLog("Clicking login button...", "info");
    await page.click(BTN_LOGIN);

    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    } catch (navError) {
      sendLog(
        "Navigation timeout, checking if login succeeded anyway...",
        "warning",
      );
    }

    await delay(3000);

    const loginSuccessful = await isLoggedIn(page);

    if (loginSuccessful) {
      sendLog("✅ Login successful!", "success");
      await saveCookies(page);
      return true;
    } else {
      throw new Error("Login verification failed");
    }
  } catch (error) {
    sendLog(
      `❌ Login attempt ${retryCount + 1} failed: ${error.message}`,
      "error",
    );

    if (retryCount < MAX_LOGIN_RETRIES - 1) {
      sendLog(`Waiting ${RETRY_DELAY / 1000}s before retry...`, "info");
      await delay(RETRY_DELAY);

      sendLog("Closing current page and opening a new one...", "info");
      await page.close();
      const newPage = await page.browser().newPage();

      await newPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });
        window.chrome = { runtime: {} };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      return attemptLogin(newPage, retryCount + 1);
    } else {
      sendLog("❌ Max login retries reached. Login failed.", "error");
      throw new Error("Failed to login after maximum retries");
    }
  }
}

// Função para processar uma conta
async function processAccount(
  page,
  account,
  index,
  total,
  abortController = null,
) {
  try {
    const username = account.replace("@", "").trim();
    const profileUrl = `${INSTAGRAM_URL}${username}`;

    sendLog(`Navigating to ${profileUrl}`, "info", { account: username });

    await page.goto(profileUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await delay(3000);

    const pageLoaded = await page.evaluate(() => {
      return document.readyState === "complete";
    });

    if (!pageLoaded) {
      throw new Error("Page did not load completely");
    }

    sendLog("Page loaded successfully!", "success", { account: username });

    let scrapedData = {
      username,
      url: profileUrl,
    };

    // Verificar se é privada
    let isPrivate = await checkIfPrivate(page);
    scrapedData.isPrivate = isPrivate;

    // Extrair seguidores
    scrapedData.followers = await extractFollowers(page, sendLog, username);

    // Extrair seguindo
    scrapedData.following = await extractFollowing(page, sendLog, username);

    // Extrair número de posts
    scrapedData.postsCount = await extractPostsCount(page, sendLog, username);

    // todo: extrair stories

    try {
      if (!isPrivate) {
        await scrollToBottom(page, sendLog, username, MAX_POSTS_PER_ACCOUNT);

        const posts = await extractPostsData(
          page,
          username,
          sendLog,
          MAX_POSTS_PER_ACCOUNT,
          abortController?.signal,
        );

        scrapedData.posts = {
          total: posts.length,
          items: posts.slice(0, MAX_POSTS_PER_ACCOUNT),
        };
      } else {
        sendLog("Conta privada - Não é possível extrair posts", "warning", {
          account: username,
        });
        scrapedData.posts = null;
      }
    } catch (err) {
      sendLog(`Failed to extract posts: ${err.message}`, "warning", {
        account: username,
      });
      scrapedData.posts = null;
    }

    return {
      success: true,
      data: scrapedData,
    };
  } catch (error) {
    sendLog(`Error in processAccount: ${error.message}`, "error", {
      account: account,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

// Função para processar uma conta com timeout e retry
async function processAccountWithRetry(
  page,
  account,
  index,
  total,
  retryCount = 0,
) {
  const username = account.replace("@", "").trim();

  try {
    if (progressCallback) {
      progressCallback({
        type: "progress",
        account: username,
        processed: index + 1,
        total: total,
        retryCount: retryCount + 1,
      });
    }

    sendLog(
      `Processing [${index + 1}/${total}]: ${account} (Attempt ${retryCount + 1}/${MAX_ACCOUNT_RETRIES})`,
      "info",
    );

    // Cria AbortController para cancelar operações em caso de timeout
    const abortController = new AbortController();

    const result = await Promise.race([
      processAccount(page, account, index, total, abortController),
      new Promise((_, reject) =>
        setTimeout(() => {
          abortController.abort(); // Sinaliza cancelamento
          reject(new Error("Account processing timeout"));
        }, ACCOUNT_TIMEOUT),
      ),
    ]);

    if (result.success) {
      sendLog(`✅ Completed for ${account}`, "success", { account: username });
      saveSuccess(account, result.data);

      if (progressCallback) {
        progressCallback({
          type: "account-success",
          account: username,
          data: result.data,
        });
      }

      return { success: true, account };
    } else {
      throw new Error(result.error || "Unknown error");
    }
  } catch (error) {
    sendLog(`❌ Error for ${account}: ${error.message}`, "error");

    if (retryCount < MAX_ACCOUNT_RETRIES - 1) {
      sendLog(
        `Retrying ${account} (${retryCount + 2}/${MAX_ACCOUNT_RETRIES})...`,
        "info",
      );
      await delay(2000);
      return processAccountWithRetry(
        page,
        account,
        index,
        total,
        retryCount + 1,
      );
    } else {
      sendLog(`❌ Max retries reached for ${account}`, "error");
      saveError(account, error, retryCount + 1);

      if (progressCallback) {
        progressCallback({
          type: "account-error",
          account: username,
          error: error.message,
        });
      }

      return { success: false, account, error: error.message };
    }
  }
}

// Função principal de scraping (exportada)
export async function startScraping(callback) {
  try {
    shouldStop = false;
    progressCallback = callback;

    sendLog("Starting scraping process...", "info");

    const inputDir = join(portsPath, "input");
    const files = fs.readdirSync(inputDir);
    const csvFile = files.find((file) => file.endsWith(".csv"));

    if (!csvFile) {
      throw new Error("No CSV file found in input directory");
    }

    const csvPath = join(inputDir, csvFile);
    sendLog(`Reading CSV file: ${csvFile}`, "info");

    const input = fs.readFileSync(csvPath, "utf8");
    const accountsToScraping = input
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.trim());

    if (accountsToScraping.length === 0) {
      throw new Error("CSV file is empty");
    }

    sendLog(`Total accounts to scrape: ${accountsToScraping.length}`, "info");

    const userDataDir = getUserDataDir();
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
      sendLog(`Created directory at ${userDataDir}`, "info");
    }

    // todo: delete older output file
    const outputDir = join(portsPath, "output");
    const outputFilePath = join(outputDir, "success.json");
    if (fs.existsSync(outputFilePath)) {
      fs.unlinkSync(outputFilePath);
      sendLog(`Deleted older output file at ${outputFilePath}`, "info");
    }

    sendLog("Launching browser...", "info");
    browser = await pptr.launch({
      headless: false,
      userDataDir: userDataDir,
      args: chromeArgs(),
      executablePath: chromePath(),
      ignoreDefaultArgs: ["--enable-automation"],
    });

    sendLog("Browser launched successfully!", "success");

    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
      window.chrome = { runtime: {} };
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });

    await loadCookies(page);

    sendLog("Checking login status...", "info");
    await page.goto(INSTAGRAM_URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    const loggedIn = await isLoggedIn(page);

    if (!loggedIn) {
      sendLog("Not logged in, attempting to login...", "warning");
      await attemptLogin(page);
    } else {
      sendLog("✅ Already logged in!", "success");
    }

    await saveCookies(page);

    sendLog("Starting account processing...", "info");

    let successCount = 0;
    let failCount = 0;
    const failedAccounts = [];

    for (let i = 0; i < accountsToScraping.length; i++) {
      if (shouldStop) {
        sendLog("Scraping stopped by user", "warning");
        break;
      }

      const account = accountsToScraping[i];

      try {
        const result = await processAccountWithRetry(
          page,
          account,
          i,
          accountsToScraping.length,
        );

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          failedAccounts.push(account);
        }
      } catch (error) {
        sendLog(
          `Critical error processing ${account}: ${error.message}`,
          "error",
        );
        failCount++;
        failedAccounts.push(account);
        saveError(account, error, MAX_ACCOUNT_RETRIES);
        await delay(3000);
      }
    }

    const successRate =
      accountsToScraping.length > 0
        ? ((successCount / accountsToScraping.length) * 100).toFixed(2)
        : 0;

    sendLog("Scraping completed!", "success");
    sendLog(`✅ Successful: ${successCount}`, "success");
    sendLog(`❌ Failed: ${failCount}`, "error");
    sendLog(`📊 Total: ${accountsToScraping.length}`, "info");
    sendLog(`📈 Success Rate: ${successRate}%`, "info");

    if (failedAccounts.length > 0) {
      sendLog(`Failed accounts: ${failedAccounts.join(", ")}`, "warning");
    }

    await saveCookies(page);

    if (browser) {
      await browser.close();
      browser = null;
      sendLog("Browser closed", "info");
    }

    return {
      successCount,
      failCount,
      total: accountsToScraping.length,
      successRate: successRate,
      failedAccounts: failedAccounts,
    };
  } catch (error) {
    sendLog(`Fatal error: ${error.message}`, "error");

    if (browser) {
      await browser.close();
      browser = null;
    }

    throw error;
  }
}

// Função para parar o scraping (exportada)
export async function stopScraping() {
  shouldStop = true;
  sendLog("Stopping scraping...", "warning");

  if (browser) {
    try {
      await browser.close();
      browser = null;
      sendLog("Browser closed", "info");
    } catch (error) {
      sendLog(`Error closing browser: ${error.message}`, "error");
    }
  }
}

async function extractFollowers(page, sendLog, username) {
  try {
    sendLog("Extract followers", "info", { account: username });

    const followers = await page.evaluate(() => {
      const followersLink = document.querySelector("a[href*='/followers']");
      if (followersLink) {
        const match = followersLink.textContent.match(/[\d,.]+/);
        if (match) return match[0].replace(/[,.]/g, "");
      }

      const allText = document.body.innerText;
      const patterns = [
        /(\d+(?:[.,]\d+)*)\s*(?:seguidores?|followers?)/i,
        /(?:seguidores?|followers?)\s*(\d+(?:[.,]\d+)*)/i,
      ];

      for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) return match[1].replace(/[,.]/g, "");
      }

      const listItems = document.querySelectorAll("li, span");
      for (const item of listItems) {
        const text = item.textContent.toLowerCase();
        if (text.includes("seguidores") || text.includes("followers")) {
          const numMatch = text.match(/(\d+(?:[.,]\d+)*)/);
          if (numMatch) return numMatch[1].replace(/[,.]/g, "");
        }
      }

      const headerSection = document.querySelector("header section");
      if (headerSection) {
        const spans = headerSection.querySelectorAll("span");
        for (const span of spans) {
          const text = span.textContent;
          if (
            (text.includes("seguidores") || text.includes("followers")) &&
            /\d/.test(text)
          ) {
            const numMatch = text.match(/(\d+(?:[.,]\d+)*)/);
            if (numMatch) return numMatch[1].replace(/[,.]/g, "");
          }
        }
      }

      return null;
    });

    if (followers) {
      sendLog(`Followers extracted: ${followers}`, "success", {
        account: username,
      });
      return followers;
    } else {
      sendLog("Followers not found", "warning", { account: username });
      return null;
    }
  } catch (err) {
    sendLog(`Failed to extract followers: ${err.message}`, "warning", {
      account: username,
    });
    return null;
  }
}

async function extractFollowing(page, sendLog, username) {
  try {
    sendLog("Extract following", "info", { account: username });

    const following = await page.evaluate(() => {
      const followingLink = document.querySelector("a[href*='/following']");
      if (followingLink) {
        const match = followingLink.textContent.match(/[\d,.]+/);
        if (match) return match[0].replace(/[,.]/g, "");
      }

      const allText = document.body.innerText;
      const patterns = [
        /(\d+(?:[.,]\d+)*)\s*(?:seguindo|following)/i,
        /(?:seguindo|following)\s*(\d+(?:[.,]\d+)*)/i,
      ];

      for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) return match[1].replace(/[,.]/g, "");
      }

      const listItems = document.querySelectorAll("li, span");
      for (const item of listItems) {
        const text = item.textContent.toLowerCase();
        if (text.includes("seguindo") || text.includes("following")) {
          const numMatch = text.match(/(\d+(?:[.,]\d+)*)/);
          if (numMatch) return numMatch[1].replace(/[,.]/g, "");
        }
      }

      const headerSection = document.querySelector("header section");
      if (headerSection) {
        const spans = headerSection.querySelectorAll("span");
        for (const span of spans) {
          const text = span.textContent;
          if (
            (text.includes("seguindo") || text.includes("following")) &&
            /\d/.test(text)
          ) {
            const numMatch = text.match(/(\d+(?:[.,]\d+)*)/);
            if (numMatch) return numMatch[1].replace(/[,.]/g, "");
          }
        }
      }

      return null;
    });

    if (following) {
      sendLog(`Following extracted: ${following}`, "success", {
        account: username,
      });
      return following;
    } else {
      sendLog("Following not found", "warning", { account: username });
      return null;
    }
  } catch (err) {
    sendLog(`Failed to extract following: ${err.message}`, "warning", {
      account: username,
    });
    return null;
  }
}

async function extractPostsCount(page, sendLog, username) {
  try {
    sendLog("Extract posts count", "info", { account: username });

    const postsCount = await page.evaluate(() => {
      const allText = document.body.innerText;
      const patterns = [
        /(\d+(?:[.,]\d+)*)\s*(?:posts?|publicaç(?:ões?|ao))/i,
        /(?:posts?|publicaç(?:ões?|ao))\s*(\d+(?:[.,]\d+)*)/i,
      ];

      for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) return match[1].replace(/[,.]/g, "");
      }

      const headerSection = document.querySelector("header section");
      if (headerSection) {
        const spans = headerSection.querySelectorAll("span");
        for (const span of spans) {
          const text = span.textContent;
          if (
            (text.includes("posts") || text.includes("publicaç")) &&
            /\d/.test(text)
          ) {
            const numMatch = text.match(/(\d+(?:[.,]\d+)*)/);
            if (numMatch) return numMatch[1].replace(/[,.]/g, "");
          }
        }
      }

      return null;
    });

    if (postsCount) {
      sendLog(`Posts count extracted: ${postsCount}`, "success", {
        account: username,
      });
      return postsCount;
    } else {
      sendLog("Posts count not found", "warning", { account: username });
      return null;
    }
  } catch (err) {
    sendLog(`Failed to extract posts count: ${err.message}`, "warning", {
      account: username,
    });
    return null;
  }
}
