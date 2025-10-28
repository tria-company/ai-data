// Elementos do DOM
const selectFileBtn = document.getElementById("selectFileBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const openResultsBtn = document.getElementById("openResultsBtn");
const clearResultsBtn = document.getElementById("clearResultsBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");

const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const accountCount = document.getElementById("accountCount");

const progressFill = document.getElementById("progressFill");
const progressPercentage = document.getElementById("progressPercentage");
const progressText = document.getElementById("progressText");
const successCount = document.getElementById("successCount");
const failCount = document.getElementById("failCount");

const logs = document.getElementById("logs");

// State
let totalAccounts = 0;
let processedAccounts = 0;
let successfulAccounts = 0;
let failedAccounts = 0;
let isScrapingInProgress = false;

function updateProgress() {
  const percentage =
    totalAccounts > 0 ? (processedAccounts / totalAccounts) * 100 : 0;
  progressFill.style.width = `${percentage}%`;
  progressPercentage.textContent = `${Math.round(percentage)}%`;
  progressText.textContent = `${processedAccounts} / ${totalAccounts} accounts processed`;
  successCount.textContent = successfulAccounts;
  failCount.textContent = failedAccounts;
}

function addLog(message, type = "info", timestamp = new Date()) {
  const logEntry = document.createElement("div");
  logEntry.className = `log-entry log-${type}`;

  const time = timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  logEntry.innerHTML = `<span class="log-timestamp">[${time}]</span> ${message}`;
  logs.appendChild(logEntry);
  logs.scrollTop = logs.scrollHeight;
}

function clearLogs() {
  logs.innerHTML = "";
}

function resetProgress() {
  processedAccounts = 0;
  successfulAccounts = 0;
  failedAccounts = 0;
  updateProgress();
}

function setScrapingState(inProgress) {
  isScrapingInProgress = inProgress;

  if (inProgress) {
    startBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
    selectFileBtn.disabled = true;
  } else {
    startBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
    selectFileBtn.disabled = false;
  }
}

// Selecionar arquivo CSV
selectFileBtn.addEventListener("click", async () => {
  try {
    addLog("Opening file selector...", "info");
    const result = await window.electronAPI.selectCSVFile();

    if (result.success) {
      fileName.textContent = result.filePath;
      accountCount.textContent = result.accountCount;
      totalAccounts = result.accountCount;
      fileInfo.classList.remove("hidden");
      startBtn.disabled = false;
      resetProgress();

      addLog(`✅ CSV file loaded: ${result.filePath}`, "success");
      addLog(`📊 Total accounts to scrape: ${result.accountCount}`, "info");
    } else {
      addLog(`❌ ${result.message || "Failed to load CSV file"}`, "error");
    }
  } catch (error) {
    addLog(`❌ Error selecting file: ${error.message}`, "error");
  }
});

// Iniciar scraping
startBtn.addEventListener("click", async () => {
  try {
    if (totalAccounts === 0) {
      addLog("❌ Please upload a CSV file first", "error");
      return;
    }

    setScrapingState(true);
    resetProgress();

    addLog("🚀 Starting scraping process...", "info");
    addLog("=".repeat(60), "info");

    const result = await window.electronAPI.startScraping();

    if (result.success) {
      addLog("=".repeat(60), "info");
      addLog("✅ Scraping completed successfully!", "success");
      addLog(
        `📊 Results: ${result.result.successCount} successful, ${result.result.failCount} failed`,
        "info",
      );
      addLog(`📈 Success rate: ${result.result.successRate}%`, "info");

      if (
        result.result.failedAccounts &&
        result.result.failedAccounts.length > 0
      ) {
        addLog(
          `⚠️ Failed accounts: ${result.result.failedAccounts.join(", ")}`,
          "warning",
        );
      }
    } else {
      addLog(`❌ Scraping failed: ${result.message}`, "error");
      if (result.stack) {
        console.error(result.stack);
      }
    }

    setScrapingState(false);
  } catch (error) {
    addLog(`❌ Critical error: ${error.message}`, "error");
    console.error(error);
    setScrapingState(false);
  }
});

// Parar scraping
stopBtn.addEventListener("click", async () => {
  try {
    addLog("⏹️ Stopping scraping...", "warning");
    const result = await window.electronAPI.stopScraping();

    if (result.success) {
      addLog("✅ Scraping stopped successfully", "success");
    } else {
      addLog(`⚠️ ${result.message}`, "warning");
    }

    setScrapingState(false);
  } catch (error) {
    addLog(`❌ Error stopping scraping: ${error.message}`, "error");
    setScrapingState(false);
  }
});

// Abrir pasta de resultados
openResultsBtn.addEventListener("click", async () => {
  try {
    await window.electronAPI.openResultsFolder();
    addLog("📂 Opening results folder...", "info");
  } catch (error) {
    addLog(`❌ Error opening results folder: ${error.message}`, "error");
  }
});

// Limpar resultados
clearResultsBtn.addEventListener("click", async () => {
  try {
    if (isScrapingInProgress) {
      addLog(
        "⚠️ Cannot clear results while scraping is in progress",
        "warning",
      );
      return;
    }

    if (
      confirm(
        "Are you sure you want to clear all results? This action cannot be undone.",
      )
    ) {
      const result = await window.electronAPI.clearResults();

      if (result.success) {
        addLog("✅ Results cleared successfully", "success");
        resetProgress();
      } else {
        addLog(`❌ ${result.message}`, "error");
      }
    }
  } catch (error) {
    addLog(`❌ Error clearing results: ${error.message}`, "error");
  }
});

// Limpar logs
clearLogsBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all logs?")) {
    clearLogs();
    addLog("🗑️ Logs cleared", "info");
  }
});

// Listener real do Main Process
window.electronAPI.onScrapingProgress((data) => {
  switch (data.type) {
    case "log":
      addLog(data.message, data.logType, new Date(data.timestamp));
      break;

    case "progress":
      processedAccounts = data.processed;
      updateProgress();
      break;

    case "account-success":
      successfulAccounts++;
      updateProgress();
      break;

    case "account-error":
      failedAccounts++;
      updateProgress();
      break;

    default:
      console.log("Unknown progress type:", data);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  addLog("📸 Instagram Scraper initialized", "success");
  addLog("Created by: Guedes, Hugo", "info");
  addLog("Ready to start scraping!", "info");

  window.electronAPI.getScrapingStatus().then((status) => {
    if (status.inProgress) {
      setScrapingState(true);
      addLog("⚠️ Scraping was in progress before restart", "warning");
    }
  });
});

// Cleanup
window.addEventListener("beforeunload", () => {
  window.electronAPI.removeScrapingProgressListener();
});

console.log("Renderer script loaded successfully");
