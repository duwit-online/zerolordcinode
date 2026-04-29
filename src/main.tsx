import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

navigator.serviceWorker?.getRegistrations().then((regs) => {
  regs.forEach((r) => r.unregister());
});

createRoot(document.getElementById("root")!).render(<App />);
