const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");

const roots = new Map();
let localServer;
let localPort;

function createLocalUrl(localPath) {
  const absolutePath = path.resolve(String(localPath));
  const token = crypto.randomBytes(16).toString("hex");
  roots.set(token, path.dirname(absolutePath));
  return `http://127.0.0.1:${localPort}/${token}/${encodeURIComponent(path.basename(absolutePath))}`;
}

const mimeFor = (filePath) => ({
  ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".bin": "application/octet-stream",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ktx2": "image/ktx2", ".basis": "application/octet-stream",
})[path.extname(filePath).toLowerCase()] || "application/octet-stream";

function startLocalFileServer() {
  return new Promise((resolve, reject) => {
    localServer = http.createServer((request, response) => {
      try {
        const requestUrl = new URL(request.url, "http://127.0.0.1");
        const parts = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
        const token = parts.shift();
        const root = token && roots.get(token);
        if (!root || !parts.length) { response.writeHead(404).end(); return; }

        const target = path.resolve(root, ...parts);
        const allowedPrefix = root.endsWith(path.sep) ? root : root + path.sep;
        if (target !== root && !target.startsWith(allowedPrefix)) { response.writeHead(403).end(); return; }

        const stream = fs.createReadStream(target);
        stream.on("open", () => {
          response.writeHead(200, {
            "Content-Type": mimeFor(target),
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          });
          stream.pipe(response);
        });
        stream.on("error", () => { if (!response.headersSent) response.writeHead(404); response.end(); });
      } catch {
        response.writeHead(400).end();
      }
    });
    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", () => {
      localPort = localServer.address().port;
      resolve();
    });
  });
}

app.whenReady().then(async () => {
  await startLocalFileServer();

  ipcMain.on("gltf-local-url", (event, localPath) => {
    try {
      event.returnValue = createLocalUrl(localPath);
    } catch {
      event.returnValue = "";
    }
  });

  ipcMain.on("gltf-file-dropped", (event, file) => {
    try {
      event.sender.send("gltf-dropped-file", {
        url: createLocalUrl(file.localPath),
        name: String(file.name),
        size: Number(file.size) || 0,
      });
    } catch {
      event.sender.send("gltf-dropped-file", { url: "", name: String(file?.name || ""), size: 0 });
    }
  });

  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 760, minHeight: 560,
    backgroundColor: "#f4f5f7", autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
    },
  });
  window.loadFile(path.join(__dirname, "..", "desktop-dist", "index.html"));
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => localServer?.close());
