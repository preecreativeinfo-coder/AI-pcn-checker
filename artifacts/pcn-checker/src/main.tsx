import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// In dev, default to the local Express server. In production (Vercel) the API
// runs as same-origin serverless functions, so default to a relative base ("").
setBaseUrl(
  import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? "http://localhost:3001" : ""),
);

createRoot(document.getElementById("root")!).render(<App />);
