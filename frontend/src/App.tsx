import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { MobileTopbar } from "./components/MobileTopbar";
import { Sidebar } from "./components/Sidebar";
import { About } from "./pages/About";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Watch } from "./pages/Watch";
import { OAuthCallback } from "./pages/OAuthCallback"; 
import "./styles/ui.css";

export default function App() {
  const [showOptions, setShowOptions] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <MobileTopbar onMenuClick={() => setMobileNavOpen(true)} />
      <Sidebar
        showOptions={showOptions}
        onToggleOptions={() => setShowOptions((v) => !v)}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/partie" element={<Watch showOptions={showOptions} />} />
          <Route path="/apropos" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/oauth/callback" element={<OAuthCallback />} /> 
        </Routes>
      </main>
    </div>
  );
}