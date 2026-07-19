import React from "react";
import { createRoot } from "react-dom/client";
import { GLTFViewer } from "../app/viewer";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(<GLTFViewer />);
