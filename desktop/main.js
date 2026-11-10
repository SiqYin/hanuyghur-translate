const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");
const https = require("https");

const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "app")
  : path.join(__dirname, "..", "app");

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 380,
    minHeight: 520,
    backgroundColor: "#f7f5f0",
    title: "汉维辞典",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(APP_ROOT, "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function buildMenu() {
  const template = [
    {
      label: "文件",
      submenu: [
        { label: "重新载入", accelerator: "CmdOrCtrl+R", click: () => win && win.reload() },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
        { role: "toggleDevTools", label: "开发者工具" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "项目主页",
          click: () => shell.openExternal("https://github.com/SiqYin/hanuyghur-translate"),
        },
        {
          label: "反馈问题",
          click: () => shell.openExternal("https://github.com/SiqYin/hanuyghur-translate/issues"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// AI 翻译走主进程，避开 file:// 的 CORS 限制；可指向任意 OpenAI 兼容端点
ipcMain.handle("translate", (_evt, opts) => {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(opts && opts.url ? opts.url : "https://index-translate.bilibili.com/v1/chat/completions");
    } catch (e) {
      reject(new Error("bad endpoint"));
      return;
    }
    const lib = target.protocol === "http:" ? require("http") : https;
    const data = Buffer.from(String((opts && opts.body) || ""), "utf8");
    const req = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: target.pathname + (target.search || ""),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + ((opts && opts.key) || "EMPTY"),
          "Content-Length": data.length,
          "User-Agent": "HanUyghurDict/1.0 (+https://github.com/SiqYin/hanuyghur-translate)",
        },
        timeout: 90000,
      },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error("HTTP " + res.statusCode));
            return;
          }
          try {
            const j = JSON.parse(buf);
            const text =
              (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
            if (!text.trim()) reject(new Error("empty translation"));
            else resolve(text.trim());
          } catch (e) {
            reject(new Error("bad response"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => reject(e));
    req.write(data);
    req.end();
  });
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
