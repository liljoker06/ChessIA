import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { MobileTopbar } from "./components/MobileTopbar";
import { Sidebar } from "./components/Sidebar";
import { useGameSettings } from "./hooks/useGameSettings";
import { About } from "./pages/About";
import { Bots } from "./pages/Bots";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Puzzles } from "./pages/Puzzles";
import { Settings } from "./pages/Settings";
import { Signup } from "./pages/Signup";
import { Statistics } from "./pages/Statistics";
import { ACCENTS } from "./theme/accents";
import { Watch } from "./pages/Watch";
import { OAuthCallback } from "./pages/OAuthCallback"; 
import "./styles/ui.css";

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { settings } = useGameSettings();

  useEffect(() => {
    const accent = ACCENTS.find((a) => a.id === settings.accentId) ?? ACCENTS[0];
    const root = document.documentElement.style;
    root.setProperty("--accent", accent.accent);
    root.setProperty("--accent-strong", accent.accentStrong);
    root.setProperty("--accent-rgb", accent.accentRgb);
    root.setProperty("--accent-text", accent.accentText);
  }, [settings.accentId]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings.reduceMotion]);

  return (
    <div className="app-shell">
      <MobileTopbar onMenuClick={() => setMobileNavOpen(true)} />
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/partie" element={<Watch />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/puzzles" element={<Puzzles />} />
          <Route path="/historique" element={<History />} />
          <Route path="/statistiques" element={<Statistics />} />
          <Route path="/parametres" element={<Settings />} />
          <Route path="/apropos" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/oauth/callback" element={<OAuthCallback />} /> 
        </Routes>
      </main>
    </div>
  );
}