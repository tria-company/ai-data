// main.js
import puppeteer from "puppeteer";
import pptr from "puppeteer-core";
import { chromePath, chromeArgs, getUserDataDir } from "./utils.js";
import fs from "fs";
import path from "path";
import {
  INSTAGRAM_URL,
  INSTAGRAM_USERNAME,
  INSTAGRAM_PASSWORD,
  BTN_LOGIN,
  USERNAME_INPUT,
  PASSWORD_INPUT,
  INSTAGRAM_LOGIN_URL,
} from "./const.js";

console.log("------------------------------------------------------------");
console.log("Starting social media extraction API...");
console.log("Create by: Guedes, Hugo");
console.log("------------------------------------------------------------");

// Caminhos
const COOKIES_PATH = "./ports/cookies/instagram-cookies.json";
const ERRORS_PATH = "./ports/output/errors.json";
const SUCCESS_PATH = "./ports/output/success.json";

// Configurações
const MAX_LOGIN_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 segundos entre tentativas de login
const MAX_ACCOUNT_RETRIES = 2; // Tentativas por conta
const ACCOUNT_TIMEOUT = 60000; // 60 segundos timeout por conta
const DELAY_BETWEEN_ACCOUNTS = 3000; // 3 segundos entre contas

// Função helper para esperar
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Função para salvar cookies
async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    fs.mkdirSync(path.dirname(COOKIES_PATH), { recursive: true });
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log("COOKIES: Cookies saved successfully");
  } catch (error) {
    console.error("COOKIES: Error saving cookies", error);
  }
}

// Função para carregar cookies
async function loadCookies(page) {
  try {
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf8"));
      await page.setCookie(...cookies);
      console.log("COOKIES: Cookies loaded successfully");
      return true;
    }
    return false;
  } catch (error) {
    console.error("COOKIES: Error loading cookies", error);
    return false;
  }
}

// Função para salvar erros em arquivo
function saveError(account, error, retryCount) {
  try {
    fs.mkdirSync(path.dirname(ERRORS_PATH), { recursive: true });

    let errors = [];
    if (fs.existsSync(ERRORS_PATH)) {
      errors = JSON.parse(fs.readFileSync(ERRORS_PATH, "utf8"));
    }

    errors.push({
      account,
      error: error.message,
      stack: error.stack,
      retryCount,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2));
  } catch (err) {
    console.error("ERROR LOG: Failed to save error to file", err);
  }
}

// Função para salvar sucesso em arquivo
function saveSuccess(account, data) {
  try {
    fs.mkdirSync(path.dirname(SUCCESS_PATH), { recursive: true });

    let successes = [];
    if (fs.existsSync(SUCCESS_PATH)) {
      successes = JSON.parse(fs.readFileSync(SUCCESS_PATH, "utf8"));
    }

    successes.push({
      account,
      data,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(SUCCESS_PATH, JSON.stringify(successes, null, 2));
  } catch (err) {
    console.error("SUCCESS LOG: Failed to save success to file", err);
  }
}

// Função para verificar se está logado
async function isLoggedIn(page) {
  try {
    await delay(2000);

    const loginButton = await page.$(BTN_LOGIN);
    if (loginButton === null) {
      console.log("LOGIN CHECK: Already logged in!");
      return true;
    }

    const metaLoginPage =
      (await page.$('input[name="email"]')) ||
      (await page.$('input[type="email"]'));
    if (metaLoginPage) {
      console.log("LOGIN CHECK: Detected Meta mobile login page");
      return false;
    }

    return false;
  } catch (error) {
    console.error("LOGIN CHECK: Error checking login status", error);
    return false;
  }
}

// Função para tentar fazer login com retry
async function attemptLogin(page, retryCount = 0) {
  try {
    console.log(`\nLOGIN: Attempt ${retryCount + 1}/${MAX_LOGIN_RETRIES}`);

    console.log("LOGIN: Navigating to login page...");
    await page.goto(
      INSTAGRAM_LOGIN_URL || "https://www.instagram.com/accounts/login/",
      {
        waitUntil: "networkidle2",
        timeout: 30000,
      },
    );

    await delay(3000);

    console.log("LOGIN: Looking for login form...");
    const usernameInput = await page.$(USERNAME_INPUT);
    const passwordInput = await page.$(PASSWORD_INPUT);
    const loginButton = await page.$(BTN_LOGIN);

    if (!usernameInput || !passwordInput || !loginButton) {
      console.warn("LOGIN: Standard login form not found");

      const metaEmailInput = await page.$('input[name="email"]');
      if (metaEmailInput) {
        console.warn("LOGIN: Meta mobile authentication page detected!");
        throw new Error("Meta mobile auth page - retry needed");
      }

      throw new Error("Login form elements not found");
    }

    console.log("LOGIN: Login form found! Proceeding with login...");

    await page.waitForSelector(USERNAME_INPUT, { timeout: 10000 });
    await page.waitForSelector(PASSWORD_INPUT, { timeout: 10000 });

    await page.click(USERNAME_INPUT, { clickCount: 3 });
    await page.keyboard.press("Backspace");

    console.log("LOGIN: Typing username...");
    await page.type(USERNAME_INPUT, INSTAGRAM_USERNAME, { delay: 100 });
    await delay(500);

    console.log("LOGIN: Typing password...");
    await page.type(PASSWORD_INPUT, INSTAGRAM_PASSWORD, { delay: 100 });
    await delay(1000);

    console.log("LOGIN: Clicking login button...");
    await page.click(BTN_LOGIN);

    try {
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    } catch (navError) {
      console.warn(
        "LOGIN: Navigation timeout, checking if login succeeded anyway...",
      );
    }

    await delay(3000);

    const loginSuccessful = await isLoggedIn(page);

    if (loginSuccessful) {
      console.log("✅ LOGIN: Login successful!");
      await saveCookies(page);
      return true;
    } else {
      throw new Error("Login verification failed");
    }
  } catch (error) {
    console.error(`❌ LOGIN: Attempt ${retryCount + 1} failed:`, error.message);

    if (retryCount < MAX_LOGIN_RETRIES - 1) {
      console.log(`LOGIN: Waiting ${RETRY_DELAY / 1000}s before retry...`);
      await delay(RETRY_DELAY);

      console.log("LOGIN: Closing current page and opening a new one...");
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
      console.error("❌ LOGIN: Max retries reached. Login failed.");
      throw new Error("Failed to login after maximum retries");
    }
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
    console.log(`\n${"=".repeat(60)}`);
    console.log(
      `SCRAPING [${index + 1}/${total}]: ${account} (Attempt ${retryCount + 1}/${MAX_ACCOUNT_RETRIES})`,
    );
    console.log("=".repeat(60));

    // Criar uma Promise com timeout
    const result = await Promise.race([
      processAccount(page, account, index, total),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Account processing timeout")),
          ACCOUNT_TIMEOUT,
        ),
      ),
    ]);

    if (result.success) {
      console.log(
        `✅ SCRAPING [${index + 1}/${total}]: Completed for ${account}`,
      );
      saveSuccess(account, result.data);
      return { success: true, account };
    } else {
      throw new Error(result.error || "Unknown error");
    }
  } catch (error) {
    console.error(
      `❌ SCRAPING [${index + 1}/${total}]: Error for ${account}:`,
      error.message,
    );

    // Tentar novamente se não excedeu o número máximo de tentativas
    if (retryCount < MAX_ACCOUNT_RETRIES - 1) {
      console.log(
        `RETRY: Attempting to retry ${account} (${retryCount + 2}/${MAX_ACCOUNT_RETRIES})...`,
      );
      await delay(2000); // Aguarda 2 segundos antes de tentar novamente
      return processAccountWithRetry(
        page,
        account,
        index,
        total,
        retryCount + 1,
      );
    } else {
      console.error(
        `❌ SCRAPING [${index + 1}/${total}]: Max retries reached for ${account}`,
      );
      saveError(account, error, retryCount + 1);
      return { success: false, account, error: error.message };
    }
  }
}

// Função para processar uma conta (AQUI VOCÊ IMPLEMENTA SEU SCRAPING)
async function processAccount(page, account, index, total) {
  try {
    const username = account.replace("@", "").trim();
    const profileUrl = `${INSTAGRAM_URL}${username}`;

    console.log(`SCRAPING: Navigating to ${profileUrl}`);

    // Navegar para o perfil com timeout
    await page.goto(profileUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await delay(3000);

    // Verificar se a página carregou
    const pageLoaded = await page.evaluate(() => {
      return document.readyState === "complete";
    });

    if (!pageLoaded) {
      throw new Error("Page did not load completely");
    }

    console.log("SCRAPING: Page loaded successfully!");

    // ========================================
    // AQUI VOCÊ IMPLEMENTA O SCRAPING
    // ========================================

    // Exemplo com try-catch individual para cada extração
    let scrapedData = {
      username,
      url: profileUrl,
    };

    try {
      // Exemplo: extrair número de seguidores
      // const followers = await page.$eval('selector_seguidores', el => el.textContent);
      // scrapedData.followers = followers;
      console.log("SCRAPING: TODO - Extract followers");
    } catch (err) {
      console.warn("SCRAPING: Failed to extract followers:", err.message);
      scrapedData.followers = null;
    }

    try {
      // Exemplo: extrair número de seguindo
      // const following = await page.$eval('selector_seguindo', el => el.textContent);
      // scrapedData.following = following;
      console.log("SCRAPING: TODO - Extract following");
    } catch (err) {
      console.warn("SCRAPING: Failed to extract following:", err.message);
      scrapedData.following = null;
    }

    try {
      // Exemplo: extrair número de posts
      // const posts = await page.$eval('selector_posts', el => el.textContent);
      // scrapedData.posts = posts;
      console.log("SCRAPING: TODO - Extract posts");
    } catch (err) {
      console.warn("SCRAPING: Failed to extract posts:", err.message);
      scrapedData.posts = null;
    }

    // ========================================

    // Aguardar aleatoriamente entre 2-5 segundos (anti-detecção)
    const randomDelay = DELAY_BETWEEN_ACCOUNTS + Math.random() * 2000;
    await delay(randomDelay);

    return {
      success: true,
      data: scrapedData,
    };
  } catch (error) {
    console.error("SCRAPING: Error in processAccount:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Função principal
async function main() {
  let browser = null;
  let page = null;

  try {
    // Ler arquivo CSV
    const input = fs.readFileSync("./ports/input/input.csv", "utf8");
    const accountsToScraping = input
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.trim());

    if (accountsToScraping.length === 0) {
      console.error("CSV: file is empty");
      process.exit(1);
    }

    console.log("SCRAPING: Starting scraping process...");
    console.log(
      `SCRAPING: Total accounts to scrape: ${accountsToScraping.length}`,
    );

    // Criar o userDataDir se não existir
    const userDataDir = getUserDataDir();
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
      console.log(`USER DATA: Created directory at ${userDataDir}`);
    }

    // Iniciar o browser
    console.log("\nBROWSER: Launching browser...");
    browser = await pptr.launch({
      headless: false,
      userDataDir: userDataDir,
      args: chromeArgs(),
      executablePath: chromePath(),
      ignoreDefaultArgs: ["--enable-automation"],
    });

    console.log("BROWSER: Browser launched successfully!");

    // Criar nova página
    page = await browser.newPage();

    // Aplicar anti-detecção
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

    // Tentar carregar cookies salvos
    await loadCookies(page);

    // Navegar para o Instagram para verificar login
    console.log("\nLOGIN: Checking login status...");
    await page.goto(INSTAGRAM_URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Verificar se está logado
    const loggedIn = await isLoggedIn(page);

    if (!loggedIn) {
      console.log("LOGIN: Not logged in, attempting to login...");
      await attemptLogin(page);
    } else {
      console.log("✅ LOGIN: Already logged in!");
    }

    // Salvar cookies após verificação
    await saveCookies(page);

    console.log("\n" + "=".repeat(60));
    console.log("STARTING ACCOUNT PROCESSING");
    console.log("=".repeat(60));

    // Estatísticas
    let successCount = 0;
    let failCount = 0;
    const failedAccounts = [];

    // Loop para processar todas as contas
    for (let i = 0; i < accountsToScraping.length; i++) {
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
        // Erro crítico que não foi tratado - ainda assim continua
        console.error(
          `❌ CRITICAL ERROR processing ${account}:`,
          error.message,
        );
        failCount++;
        failedAccounts.push(account);
        saveError(account, error, MAX_ACCOUNT_RETRIES);

        // Aguarda um pouco e continua com a próxima conta
        await delay(3000);
      }
    }

    // Resumo final
    console.log("\n" + "=".repeat(60));
    console.log("SCRAPING COMPLETED!");
    console.log("=".repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Total: ${accountsToScraping.length}`);
    console.log(
      `📈 Success Rate: ${((successCount / accountsToScraping.length) * 100).toFixed(2)}%`,
    );

    if (failedAccounts.length > 0) {
      console.log(`\n❌ Failed Accounts:`);
      failedAccounts.forEach((acc, idx) => {
        console.log(`   ${idx + 1}. ${acc}`);
      });
    }

    console.log("=".repeat(60));
    console.log(`\n📁 Results saved to:`);
    console.log(`   ✅ Success: ${SUCCESS_PATH}`);
    console.log(`   ❌ Errors: ${ERRORS_PATH}`);

    // Salvar cookies uma última vez
    await saveCookies(page);
  } catch (error) {
    console.error("\n❌ FATAL ERROR:");
    console.error(error);
  } finally {
    // Fechar o browser se estiver aberto
    if (browser) {
      console.log("\nBROWSER: Closing browser...");
      // await browser.close();
      console.log("BROWSER: Browser closed (commented out for debugging)");
    }
  }
}

// Executar a função principal
main();
