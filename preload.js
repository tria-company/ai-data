const { contextBridge, ipcRenderer } = require("electron");

// Export
contextBridge.exposeInMainWorld("electronAPI", {
  // Gerenciamento de arquivos
  selectCSVFile: () => ipcRenderer.invoke("select-csv-file"),

  // Controle de scraping
  startScraping: () => ipcRenderer.invoke("start-scraping"),
  stopScraping: () => ipcRenderer.invoke("stop-scraping"),
  getScrapingStatus: () => ipcRenderer.invoke("get-scraping-status"),

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
