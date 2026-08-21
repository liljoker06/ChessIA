import { Menu } from "lucide-react";
import { Link } from "react-router-dom";

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export function MobileTopbar({ onMenuClick }: MobileTopbarProps) {
  return (
    <header className="mobile-topbar">
      <button
        type="button"
        className="mobile-menu-button"
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>
      <Link to="/" className="mobile-topbar-brand">
        <span className="piece">♞</span>
        ChessIA
      </Link>
    </header>
  );
}
