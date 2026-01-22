const { contextBridge, ipcRenderer } = require("electron");

// Export
contextBridge.exposeInMainWorld("electronAPI", {
  // Gerenciamento de arquivos
  selectCSVFile: () => ipcRenderer.invoke("select-csv-file"),

  // Controle de scraping (Posts mode)
  startScraping: () => ipcRenderer.invoke("start-scraping"),
  stopScraping: () => ipcRenderer.invoke("stop-scraping"),
  getScrapingStatus: () => ipcRenderer.invoke("get-scraping-status"),

  // Controle de scraping (Profile mode)
  startProfileScraping: (username) =>
    ipcRenderer.invoke("start-profile-scraping", username),
  stopProfileScraping: () => ipcRenderer.invoke("stop-profile-scraping"),

  // Resultados
  openResultsFolder: () => ipcRenderer.invoke("open-results-folder"),
  clearResults: () => ipcRenderer.invoke("clear-results"),

  // Listener para receber progresso em tempo real
  onScrapingProgress: (callback) => {
    ipcRenderer.on("scraping-progress", (event, data) => {
      callback(data);
    });
  },

  // Remover listener (cleanup)
  removeScrapingProgressListener: () => {
    ipcRenderer.removeAllListeners("scraping-progress");
  },
});

console.log("Preload script loaded successfully");
