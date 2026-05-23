import React from "react";
import ReactDOM from "react-dom/client";
import { CopilotKit } from "@copilotkit/react-core";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <CopilotKit runtimeUrl="http://localhost:5000/api/copilotkit/">
      <App />
    </CopilotKit>
  </React.StrictMode>
);