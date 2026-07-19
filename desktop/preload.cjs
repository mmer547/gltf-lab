const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("gltfDesktop", {
  localUrlForFile(file) {
    const localPath = webUtils.getPathForFile(file);
    return ipcRenderer.sendSync("gltf-local-url", localPath);
  },
  onDroppedFile(callback) {
    ipcRenderer.on("gltf-dropped-file", (_event, file) => callback(file));
  },
});

window.addEventListener("dragover", (event) => {
  event.preventDefault();
}, true);

window.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const localPath = webUtils.getPathForFile(file);
  ipcRenderer.send("gltf-file-dropped", { localPath, name: file.name, size: file.size });
}, true);
