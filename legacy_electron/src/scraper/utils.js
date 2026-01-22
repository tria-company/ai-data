import os from "os";
import { join } from "path";

// Função para obter o caminho do Chrome
export function chromePath() {
  const platform = process.platform;

  if (platform === "linux") {
    return "/usr/bin/google-chrome";
  } else if (platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else if (platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Função para obter argumentos do Chrome
export function chromeArgs() {
  return [
    "--profile-directory=Default",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-features=IsolateOrigins,site-per-process",
    "--window-size=1920,1080",
  ];
}

// Função para obter o diretório de dados do usuário
export function getUserDataDir() {
  const platform = process.platform;
  const homeDir = os.homedir();

  if (platform === "linux") {
    return join(homeDir, ".config", "puppeteer-instagram");
  } else if (platform === "darwin") {
    return join(
      homeDir,
      "Library",
      "Application Support",
      "puppeteer-instagram",
    );
  } else if (platform === "win32") {
    return join(homeDir, "AppData", "Local", "puppeteer-instagram");
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}
