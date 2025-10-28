import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use userData path for writable files (works in both dev and production)
const userDataPath = app.getPath("userData");
const portsPath = join(userDataPath, "ports");
const inputPath = join(portsPath, "input");
const outputPath = join(portsPath, "output");

// Ensure directories exist
if (!fs.existsSync(portsPath)) {
  fs.mkdirSync(portsPath, { recursive: true });
}
if (!fs.existsSync(inputPath)) {
  fs.mkdirSync(inputPath, { recursive: true });
}
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

import {
  startScraping,
  stopScraping,
  setPortsPath,
} from "./src/scraper/instagram.js";

import {
  startProfileScraping,
  stopProfileScraping,
  setPortsPath as setProfilePortsPath,
} from "./src/scraper/instagram-profile-scraper.js";

// Pass the ports path to the scraper modules
setPortsPath(portsPath);
setProfilePortsPath(portsPath);

let mainWindow;
let scrapingInProgress = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#1a1a1a",
    titleBarStyle: "default",
    show: false,
  });

  mainWindow.loadFile("src/renderer/index.html");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Descomentar para debug
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (scrapingInProgress) {
    await stopScraping();
  }
});

// IPC
ipcMain.handle("select-csv-file", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        { name: "CSV Files", extensions: ["csv"] },
        { name: "Text Files", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
      title: "Select Instagram Accounts CSV File",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: "File selection cancelled" };
    }

    const sourceFilePath = result.filePaths[0];

    const destPath = join(inputPath, "input.csv");
    fs.copyFileSync(sourceFilePath, destPath);

    const content = fs.readFileSync(destPath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim());
    const accountCount = lines.length;

    if (accountCount === 0) {
      return {
        success: false,
        message:
          "CSV file is empty. Please select a file with Instagram accounts.",
      };
    }

    return {
      success: true,
      filePath: sourceFilePath.split("/").pop(),
      accountCount: accountCount,
    };
  } catch (error) {
    console.error("Error selecting CSV file:", error);
    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  }
});

ipcMain.handle("start-scraping", async () => {
  if (scrapingInProgress) {
    return {
      success: false,
      message: "Scraping is already in progress",
    };
  }

  try {
    const csvPath = join(inputPath, "input.csv");
    if (!fs.existsSync(csvPath)) {
      return {
        success: false,
        message: "No CSV file found. Please upload a CSV file first.",
      };
    }

    scrapingInProgress = true;

    const progressCallback = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("scraping-progress", data);
      }
    };

    const result = await startScraping(progressCallback);

    scrapingInProgress = false;

    return {
      success: true,
      result: result,
    };
  } catch (error) {
    console.error("Error starting scraping:", error);
    scrapingInProgress = false;

    return {
      success: false,
      message: error.message,
      stack: error.stack,
    };
  }
});

ipcMain.handle("stop-scraping", async () => {
  if (!scrapingInProgress) {
    return {
      success: false,
      message: "No scraping process is currently running",
    };
  }

  try {
    await stopScraping();
    scrapingInProgress = false;

    return {
      success: true,
      message: "Scraping stopped successfully",
    };
  } catch (error) {
    console.error("Error stopping scraping:", error);
    return {
      success: false,
      message: `Error stopping scraping: ${error.message}`,
    };
  }
});

ipcMain.handle("open-results-folder", async () => {
  try {
    await shell.openPath(outputPath);
    return { success: true };
  } catch (error) {
    console.error("Error opening results folder:", error);
    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  }
});

ipcMain.handle("get-scraping-status", async () => {
  return {
    inProgress: scrapingInProgress,
  };
});

ipcMain.handle("clear-results", async () => {
  try {
    const successPath = join(outputPath, "success.json");
    const errorsPath = join(outputPath, "errors.json");
    const profileSuccessPath = join(outputPath, "profile-success.json");
    const profileErrorsPath = join(outputPath, "profile-errors.json");

    if (fs.existsSync(successPath)) {
      fs.unlinkSync(successPath);
    }

    if (fs.existsSync(errorsPath)) {
      fs.unlinkSync(errorsPath);
    }

    if (fs.existsSync(profileSuccessPath)) {
      fs.unlinkSync(profileSuccessPath);
    }

    if (fs.existsSync(profileErrorsPath)) {
      fs.unlinkSync(profileErrorsPath);
    }

    return {
      success: true,
      message: "Results cleared successfully",
    };
  } catch (error) {
    console.error("Error clearing results:", error);
    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  }
});

// Profile Scraping IPC Handlers
ipcMain.handle("start-profile-scraping", async (event, username) => {
  if (scrapingInProgress) {
    return {
      success: false,
      message: "Scraping is already in progress",
    };
  }

  try {
    scrapingInProgress = true;

    const progressCallback = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("scraping-progress", data);
      }
    };

    const result = await startProfileScraping(username, progressCallback);

    scrapingInProgress = false;

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("Error starting profile scraping:", error);
    scrapingInProgress = false;

    return {
      success: false,
      message: error.message,
      stack: error.stack,
    };
  }
});

ipcMain.handle("stop-profile-scraping", async () => {
  if (!scrapingInProgress) {
    return {
      success: false,
      message: "No scraping process is currently running",
    };
  }

  try {
    await stopProfileScraping();
    scrapingInProgress = false;

    return {
      success: true,
      message: "Profile scraping stopped successfully",
    };
  } catch (error) {
    console.error("Error stopping profile scraping:", error);
    return {
      success: false,
      message: `Error stopping profile scraping: ${error.message}`,
    };
  }
});

console.log("------------------------------------------------------------");
console.log("Instagram Scraper - Electron Application");
console.log("Created by: Guedes, Hugo");
console.log("------------------------------------------------------------");
