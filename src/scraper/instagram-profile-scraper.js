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
const SCROLL_DELAY = 1500; // Increased for better loading
const MAX_SCROLL_ATTEMPTS = 200; // Increased to handle large lists

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
async function extractUserList(page, username, type = "followers", totalCount = 0) {
  try {
    const linkSelector =
      type === "followers" ? "a[href*='/followers']" : "a[href*='/following']";

    sendLog(`Opening ${type} list for @${username}...`, "info");

    // Wait for and click the link
    await page.waitForSelector(linkSelector, { timeout: 10000 });
    await page.click(linkSelector);

    // Wait for the modal/dialog to appear
    sendLog(`Waiting for ${type} modal to load...`, "info");
    await delay(4000);

    // Calculate dynamic scroll limit based on total count
    // Instagram loads approximately 12 users per scroll
    const USERS_PER_SCROLL = 12;
    const calculatedScrolls = totalCount > 0
      ? Math.ceil(totalCount / USERS_PER_SCROLL) + 10 // Add 10 extra scrolls as buffer
      : MAX_SCROLL_ATTEMPTS;

    const dynamicMaxScrolls = Math.min(calculatedScrolls, MAX_SCROLL_ATTEMPTS);

    sendLog(
      `Target: ${totalCount} ${type} | Estimated scrolls needed: ${calculatedScrolls} | Using: ${dynamicMaxScrolls}`,
      "info"
    );

    // Find the scrollable container in the modal
    const users = [];
    let scrollAttempts = 0;
    let noNewUsersCount = 0;
    const MAX_NO_NEW_USERS = 3; // Stop if no new users after 3 attempts

    sendLog(`Starting to scroll through ${type} list...`, "info");

    while (scrollAttempts < dynamicMaxScrolls) {
      if (shouldStop) break;

      const previousCount = users.length;

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

      const currentCount = users.length;
      const newUsersAdded = currentCount - previousCount;

      if (newUsersAdded === 0) {
        noNewUsersCount++;
        sendLog(
          `No new ${type} found (${noNewUsersCount}/${MAX_NO_NEW_USERS})`,
          "warning",
        );
      } else {
        noNewUsersCount = 0;
        sendLog(
          `Collected ${currentCount} ${type} (+${newUsersAdded} new)`,
          "info",
        );
      }

      // Stop if no new users for several attempts
      if (noNewUsersCount >= MAX_NO_NEW_USERS) {
        sendLog(`No new ${type} detected after ${MAX_NO_NEW_USERS} attempts`, "info");
        break;
      }

      // Scroll the modal - try multiple selectors
      const scrollSuccess = await page.evaluate(() => {
        const modal = document.querySelector('div[role="dialog"]');
        if (!modal) return false;

        // Try multiple selectors for the scrollable container
        const selectors = [
          "div._aano", // Common Instagram class for scrollable list
          "div > div > div:nth-child(2)", // Generic selector
          "div[style*='overflow']", // Any div with overflow style
        ];

        let scrollableDiv = null;

        // Try to find the scrollable element
        for (const selector of selectors) {
          const elements = modal.querySelectorAll(selector);
          for (const el of elements) {
            if (el.scrollHeight > el.clientHeight) {
              scrollableDiv = el;
              break;
            }
          }
          if (scrollableDiv) break;
        }

        // If still not found, search all divs in modal
        if (!scrollableDiv) {
          const allDivs = modal.querySelectorAll("div");
          for (const div of allDivs) {
            if (div.scrollHeight > div.clientHeight) {
              scrollableDiv = div;
              break;
            }
          }
        }

        if (scrollableDiv) {
          // Scroll incrementally instead of jumping to bottom
          // This helps trigger lazy loading better
          const currentScroll = scrollableDiv.scrollTop;
          const scrollStep = 300; // Scroll 300px at a time
          scrollableDiv.scrollTop = currentScroll + scrollStep;

          // Also scroll to the last element to ensure visibility
          const lastElement = scrollableDiv.querySelector("div:last-child");
          if (lastElement) {
            lastElement.scrollIntoView({ behavior: "smooth", block: "end" });
          }

          return true;
        }

        return false;
      });

      if (!scrollSuccess) {
        sendLog(`Could not find scrollable element in ${type} modal`, "warning");
      }

      // Wait for content to load after scroll
      await delay(SCROLL_DELAY * 1.5);
      scrollAttempts++;

      // Log progress every 5 attempts
      if (scrollAttempts % 5 === 0) {
        const progress = totalCount > 0
          ? `${users.length}/${totalCount} (${Math.round((users.length/totalCount)*100)}%)`
          : `${users.length}`;
        sendLog(
          `Scroll progress: ${scrollAttempts}/${dynamicMaxScrolls} attempts, ${progress} ${type} collected`,
          "info",
        );
      }
    }

    sendLog(`Finished scrolling after ${scrollAttempts} attempts`, "info");

    // Log completion summary
    if (totalCount > 0) {
      const percentage = Math.round((users.length / totalCount) * 100);
      const status = percentage >= 95 ? "✅" : percentage >= 80 ? "⚠️" : "❌";
      sendLog(
        `${status} Collected ${users.length}/${totalCount} ${type} (${percentage}%)`,
        percentage >= 95 ? "success" : percentage >= 80 ? "warning" : "error"
      );
    }

    // Close the modal
    sendLog(`Closing ${type} modal...`, "info");
    await page.evaluate(() => {
      const closeButton = document.querySelector(
        'div[role="dialog"] button svg[aria-label="Close"], div[role="dialog"] button svg[aria-label="Fechar"]',
      );
      if (closeButton && closeButton.parentElement) {
        closeButton.parentElement.click();
      }
    });

    await delay(2000);

    sendLog(`✅ Successfully extracted ${users.length} ${type}`, "success");
    return users;
  } catch (error) {
    sendLog(`❌ Error extracting ${type}: ${error.message}`, "error");
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

    // Convert followers/following counts to numbers for calculation
    const followersCount = profileStats.followers
      ? parseInt(profileStats.followers.replace(/[,.\s]/g, ""))
      : 0;
    const followingCount = profileStats.following
      ? parseInt(profileStats.following.replace(/[,.\s]/g, ""))
      : 0;

    sendLog(
      `Profile stats: ${followersCount} followers, ${followingCount} following`,
      "info"
    );

    // Extract followers
    sendLog("Extracting followers list...", "info");
    const followersList = await extractUserList(
      page,
      username,
      "followers",
      followersCount
    );

    if (shouldStop) {
      sendLog("Scraping stopped by user", "warning");
      await browser.close();
      return;
    }

    // Extract following
    sendLog("Extracting following list...", "info");
    await page.goto(profileUrl, { waitUntil: "networkidle2" });
    await delay(2000);
    const followingList = await extractUserList(
      page,
      username,
      "following",
      followingCount
    );

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
