// Elementos do DOM - Posts Mode
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

// Elementos do DOM - Profile Mode
const modePostsBtn = document.getElementById("modePostsBtn");
const modeProfileBtn = document.getElementById("modeProfileBtn");
const postsMode = document.getElementById("postsMode");
const profileMode = document.getElementById("profileMode");

const profileUsernameInput = document.getElementById("profileUsernameInput");
const startProfileBtn = document.getElementById("startProfileBtn");
const stopProfileBtn = document.getElementById("stopProfileBtn");

const profileProgressFill = document.getElementById("profileProgressFill");
const profileProgressPercentage = document.getElementById("profileProgressPercentage");
const profileProgressText = document.getElementById("profileProgressText");

// State
let totalAccounts = 0;
let processedAccounts = 0;
let successfulAccounts = 0;
let failedAccounts = 0;
let isScrapingInProgress = false;
let currentMode = "posts"; // "posts" or "profile"

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

// ============================================
// MODE SWITCHING
// ============================================
modePostsBtn.addEventListener("click", () => {
  currentMode = "posts";
  modePostsBtn.classList.add("active");
  modeProfileBtn.classList.remove("active");
  postsMode.classList.remove("hidden");
  profileMode.classList.add("hidden");
  addLog("📄 Switched to Posts Scraping mode", "info");
});

modeProfileBtn.addEventListener("click", () => {
  currentMode = "profile";
  modeProfileBtn.classList.add("active");
  modePostsBtn.classList.remove("active");
  profileMode.classList.remove("hidden");
  postsMode.classList.add("hidden");
  addLog("👥 Switched to Profile Scraping mode", "info");
});

// ============================================
// PROFILE MODE FUNCTIONS
// ============================================
function updateProfileProgress(percentage, text) {
  profileProgressFill.style.width = `${percentage}%`;
  profileProgressPercentage.textContent = `${Math.round(percentage)}%`;
  profileProgressText.textContent = text;
}

function setProfileScrapingState(inProgress) {
  isScrapingInProgress = inProgress;

  if (inProgress) {
    startProfileBtn.classList.add("hidden");
    stopProfileBtn.classList.remove("hidden");
    profileUsernameInput.disabled = true;
  } else {
    startProfileBtn.classList.remove("hidden");
    stopProfileBtn.classList.add("hidden");
    profileUsernameInput.disabled = false;
  }
}

// Enable/disable profile start button based on input
profileUsernameInput.addEventListener("input", (e) => {
  const username = e.target.value.trim();
  startProfileBtn.disabled = username.length === 0;
});

// Start profile scraping
startProfileBtn.addEventListener("click", async () => {
  try {
    const username = profileUsernameInput.value.trim();
    if (!username) {
      addLog("❌ Please enter a username", "error");
      return;
    }

    setProfileScrapingState(true);
    updateProfileProgress(0, "Starting...");

    addLog("🚀 Starting profile scraping...", "info");
    addLog(`👤 Target profile: @${username}`, "info");
    addLog("=".repeat(60), "info");

    const result = await window.electronAPI.startProfileScraping(username);

    if (result.success) {
      addLog("=".repeat(60), "info");
      addLog("✅ Profile scraping completed successfully!", "success");
      addLog(
        `📊 Collected ${result.data.followers.profiles.length} followers`,
        "success",
      );
      addLog(
        `📊 Collected ${result.data.following.profiles.length} following`,
        "success",
      );
      updateProfileProgress(100, "Completed!");
    } else {
      addLog(`❌ Profile scraping failed: ${result.message}`, "error");
      if (result.stack) {
        console.error(result.stack);
      }
      updateProfileProgress(0, "Failed");
    }

    setProfileScrapingState(false);
  } catch (error) {
    addLog(`❌ Critical error: ${error.message}`, "error");
    console.error(error);
    setProfileScrapingState(false);
    updateProfileProgress(0, "Error");
  }
});

// Stop profile scraping
stopProfileBtn.addEventListener("click", async () => {
  try {
    addLog("⏹️ Stopping profile scraping...", "warning");
    const result = await window.electronAPI.stopProfileScraping();

    if (result.success) {
      addLog("✅ Profile scraping stopped successfully", "success");
    } else {
      addLog(`⚠️ ${result.message}`, "warning");
    }

    setProfileScrapingState(false);
    updateProfileProgress(0, "Stopped");
  } catch (error) {
    addLog(`❌ Error stopping profile scraping: ${error.message}`, "error");
    setProfileScrapingState(false);
  }
});

// Listener real do Main Process
window.electronAPI.onScrapingProgress((data) => {
  switch (data.type) {
    case "log":
      addLog(data.message, data.logType, new Date(data.timestamp));
      break;

    case "progress":
      if (currentMode === "posts") {
        processedAccounts = data.processed;
        updateProgress();
      } else if (currentMode === "profile" && data.stage) {
        // Profile scraping progress
        const percentage = (data.processed / data.total) * 100;
        const stage = data.stage === "followers" ? "Followers" : "Following";
        updateProfileProgress(
          percentage / 2 + (data.stage === "following" ? 50 : 0),
          `Processing ${stage}: ${data.processed}/${data.total}`,
        );
      }
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
