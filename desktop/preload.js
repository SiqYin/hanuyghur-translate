const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("HanUyghurDesktop", {
  version: "1.0.0",
  platform: process.platform,
  translate: (opts) => ipcRenderer.invoke("translate", opts),
});
