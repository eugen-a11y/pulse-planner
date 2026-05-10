import { createRoot } from "react-dom/client";

const App = () => (
  <div className="h-full flex items-center justify-center text-2xl text-pulse">Pulse · loading…</div>
);

createRoot(document.getElementById("root")!).render(<App />);
