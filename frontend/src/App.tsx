import { Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Game } from "./pages/Game";
import { Landing } from "./pages/Landing";
import { Lobby } from "./pages/Lobby";
import { Login } from "./pages/Login";
import { PlayComputer } from "./pages/PlayComputer";
import { Signup } from "./pages/Signup";
import "./styles/ui.css";

// Routes are open for now (no ProtectedRoute) — auth gating comes back later.
export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/play/computer" element={<PlayComputer />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </>
  );
}
