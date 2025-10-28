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

// Config
const MAX_LOGIN_RETRIES = 3;
const RETRY_DELAY = 5000;
const MAX_PROFILE_RETRIES = 2;
const PROFILE_TIMEOUT = 30000;
const DELAY_BETWEEN_PROFILES = 2000;
const SCROLL_DELAY = 1000;
const MAX_SCROLL_ATTEMPTS = 50;

// Global
let browser = null;
let shouldStop = false;
let progressCallback = null;
let portsPath = "./ports";

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

    const errorsPath = join(outputDir, "profile-errors.json");
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

    const successPath = join(outputDir, "profile-success.json");
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

// Extract basic profile stats
async function extractProfileStats(page, username) {
  try {
    const stats = await page.evaluate(() => {
      const followers = (() => {
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

        return null;
      })();

      const following = (() => {
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

        return null;
      })();

      const postsCount = (() => {
        const allText = document.body.innerText;
        const patterns = [
          /(\d+(?:[.,]\d+)*)\s*(?:posts?|publicaç(?:ões?|ao))/i,
          /(?:posts?|publicaç(?:ões?|ao))\s*(\d+(?:[.,]\d+)*)/i,
        ];

        for (const pattern of patterns) {
          const match = allText.match(pattern);
          if (match) return match[1].replace(/[,.]/g, "");
        }

        return null;
      })();

      return { followers, following, postsCount };
    });

    sendLog(
      `Stats for @${username}: ${stats.followers} followers, ${stats.following} following, ${stats.postsCount} posts`,
      "success",
    );
    return stats;
  } catch (error) {
    sendLog(`Error extracting stats: ${error.message}`, "error");
    return { followers: null, following: null, postsCount: null };
  }
}

// Click on followers/following link and extract usernames
async function extractUserList(page, username, type = "followers") {
  try {
    const linkSelector =
      type === "followers" ? "a[href*='/followers']" : "a[href*='/following']";

    sendLog(`Opening ${type} list for @${username}...`, "info");

    // Wait for and click the link
    await page.waitForSelector(linkSelector, { timeout: 10000 });
    await page.click(linkSelector);

    // Wait for the modal/dialog to appear
    await delay(3000);

    // Find the scrollable container in the modal
    const users = [];
    let previousHeight = 0;
    let scrollAttempts = 0;

    sendLog(`Scrolling through ${type} list...`, "info");

    while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      if (shouldStop) break;

      // Extract usernames from the current view
      const newUsers = await page.evaluate(() => {
        const userElements = document.querySelectorAll(
          'div[role="dialog"] a[href^="/"]',
        );
        const usernames = new Set();

        userElements.forEach((el) => {
          const href = el.getAttribute("href");
          if (href && href !== "/" && !href.includes("/p/")) {
            const username = href.replace(/^\//, "").replace(/\/$/, "");
            if (username && !username.includes("/")) {
              usernames.add(username);
            }
          }
        });

        return Array.from(usernames);
      });

      // Add new users to the list
      newUsers.forEach((user) => {
        if (!users.includes(user)) {
          users.push(user);
        }
      });

      sendLog(`Collected ${users.length} ${type} so far...`, "info");

      // Scroll the modal
      const currentHeight = await page.evaluate(() => {
        const modal = document.querySelector('div[role="dialog"]');
        if (modal) {
          const scrollableDiv = modal.querySelector("div > div > div");
          if (scrollableDiv) {
            scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
            return scrollableDiv.scrollHeight;
          }
        }
        return 0;
      });

      await delay(SCROLL_DELAY);

      // Check if we've reached the end
      if (currentHeight === previousHeight) {
        sendLog(`Reached end of ${type} list`, "info");
        break;
      }

      previousHeight = currentHeight;
      scrollAttempts++;
    }

    // Close the modal
    await page.evaluate(() => {
      const closeButton = document.querySelector(
        'div[role="dialog"] button svg[aria-label="Close"], div[role="dialog"] button svg[aria-label="Fechar"]',
      );
      if (closeButton && closeButton.parentElement) {
        closeButton.parentElement.click();
      }
    });

    await delay(2000);

    sendLog(`Extracted ${users.length} ${type}`, "success");
    return users;
  } catch (error) {
    sendLog(`Error extracting ${type}: ${error.message}`, "error");
    return [];
  }
}

// Process individual profile to get stats
async function processProfile(page, username, index, total) {
  try {
    const profileUrl = `${INSTAGRAM_URL}${username}`;

    sendLog(
      `[${index + 1}/${total}] Processing @${username}...`,
      "info",
    );

    await page.goto(profileUrl, {
      waitUntil: "networkidle2",
      timeout: PROFILE_TIMEOUT,
    });

    await delay(2000);

    const pageLoaded = await page.evaluate(() => {
      return document.readyState === "complete";
    });

    if (!pageLoaded) {
      throw new Error("Page did not load completely");
    }

    // Check if profile exists
    const profileExists = await page.evaluate(() => {
      const notFoundText = document.body.innerText;
      return (
        !notFoundText.includes("Sorry, this page") &&
        !notFoundText.includes("Desculpe, esta página")
      );
    });

    if (!profileExists) {
      sendLog(`Profile @${username} not found`, "warning");
      return null;
    }

    const stats = await extractProfileStats(page, username);

    return {
      username: username,
      url: profileUrl,
      followers: stats.followers,
      following: stats.following,
      postsCount: stats.postsCount,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    sendLog(`Error processing @${username}: ${error.message}`, "error");
    return null;
  }
}

// Main scraping function for profile with followers/following
export async function startProfileScraping(targetUsername, callback) {
  try {
    shouldStop = false;
    progressCallback = callback;

    sendLog("Starting profile scraping process...", "info");

    const username = targetUsername.replace("@", "").trim();
    const profileUrl = `${INSTAGRAM_URL}${username}`;

    const userDataDir = getUserDataDir();
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
      sendLog(`Created directory at ${userDataDir}`, "info");
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

    // Navigate to target profile
    sendLog(`Navigating to @${username}...`, "info");
    await page.goto(profileUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await delay(3000);

    // Extract profile stats
    const profileStats = await extractProfileStats(page, username);

    // Extract followers
    sendLog("Extracting followers list...", "info");
    const followersList = await extractUserList(page, username, "followers");

    if (shouldStop) {
      sendLog("Scraping stopped by user", "warning");
      await browser.close();
      return;
    }

    // Extract following
    sendLog("Extracting following list...", "info");
    await page.goto(profileUrl, { waitUntil: "networkidle2" });
    await delay(2000);
    const followingList = await extractUserList(page, username, "following");

    if (shouldStop) {
      sendLog("Scraping stopped by user", "warning");
      await browser.close();
      return;
    }

    // Process all followers
    sendLog(
      `Processing ${followersList.length} followers...`,
      "info",
    );
    const followersData = [];
    for (let i = 0; i < followersList.length; i++) {
      if (shouldStop) break;

      const followerUsername = followersList[i];
      const profileData = await processProfile(
        page,
        followerUsername,
        i,
        followersList.length,
      );

      if (profileData) {
        followersData.push(profileData);
      }

      if (progressCallback) {
        progressCallback({
          type: "progress",
          stage: "followers",
          processed: i + 1,
          total: followersList.length,
        });
      }

      await delay(DELAY_BETWEEN_PROFILES);
    }

    if (shouldStop) {
      sendLog("Scraping stopped by user", "warning");
      await browser.close();
      return;
    }

    // Process all following
    sendLog(
      `Processing ${followingList.length} following...`,
      "info",
    );
    const followingData = [];
    for (let i = 0; i < followingList.length; i++) {
      if (shouldStop) break;

      const followingUsername = followingList[i];
      const profileData = await processProfile(
        page,
        followingUsername,
        i,
        followingList.length,
      );

      if (profileData) {
        followingData.push(profileData);
      }

      if (progressCallback) {
        progressCallback({
          type: "progress",
          stage: "following",
          processed: i + 1,
          total: followingList.length,
        });
      }

      await delay(DELAY_BETWEEN_PROFILES);
    }

    // Prepare final data
    const finalData = {
      targetProfile: {
        username: username,
        url: profileUrl,
        ...profileStats,
      },
      followers: {
        total: followersList.length,
        profiles: followersData,
      },
      following: {
        total: followingList.length,
        profiles: followingData,
      },
    };

    sendLog("Scraping completed!", "success");
    sendLog(
      `✅ Collected ${followersData.length}/${followersList.length} followers`,
      "success",
    );
    sendLog(
      `✅ Collected ${followingData.length}/${followingList.length} following`,
      "success",
    );

    saveSuccess(`@${username}`, finalData);

    await saveCookies(page);

    if (browser) {
      await browser.close();
      browser = null;
      sendLog("Browser closed", "info");
    }

    return {
      success: true,
      data: finalData,
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

// Stop scraping function
export async function stopProfileScraping() {
  shouldStop = true;
  sendLog("Stopping profile scraping...", "warning");

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
