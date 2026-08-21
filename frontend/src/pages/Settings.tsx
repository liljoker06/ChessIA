import {
  Accessibility,
  Bell,
  CreditCard,
  GraduationCap,
  Grid3x3,
  KeyRound,
  Monitor,
  Swords,
  User,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { DIFFICULTIES } from "../engine/difficulty";
import { useGameSettings, type GameSettings } from "../hooks/useGameSettings";
import { ACCENTS } from "../theme/accents";
import type { BoardTheme } from "../theme/boardThemes";
import { BOARD_THEMES } from "../theme/boardThemes";
import type { PieceStyle } from "../theme/pieceStyles";
import { PIECE_STYLES } from "../theme/pieceStyles";
import { PRESETS } from "../theme/presets";
import "../components/GameOptionsPanel.css";
import "../styles/settings.css";

type Tab =
  | "board"
  | "profile"
  | "account"
  | "gamemode"
  | "interface"
  | "social"
  | "coach"
  | "notifications"
  | "subscription"
  | "accessibility";

type BoardInnerTab = "theme" | "pieces" | "background" | "presets";

const MINI_PREVIEW_CELLS: ({ type: string; color: "w" | "b" } | null)[][] = [
  [
    { type: "n", color: "b" },
    { type: "q", color: "b" },
    { type: "p", color: "b" },
  ],
  [null, null, null],
  [
    { type: "n", color: "w" },
    { type: "k", color: "w" },
    { type: "r", color: "w" },
  ],
];

const MINI_PIECE_GLYPH: Record<string, string> = { n: "♞", q: "♛", p: "♟", k: "♚", r: "♜" };

function MiniBoardPreview({ theme, pieceStyle }: { theme: BoardTheme; pieceStyle: PieceStyle }) {
  return (
    <div className="mini-board-preview">
      {MINI_PREVIEW_CELLS.map((row, rIdx) => (
        <div className="mini-board-row" key={rIdx}>
          {row.map((cell, cIdx) => {
            const light = (rIdx + cIdx) % 2 === 0;
            return (
              <div key={cIdx} className="mini-board-cell" style={{ background: light ? theme.light : theme.dark }}>
                {cell && (
                  <span
                    style={{
                      color: cell.color === "w" ? pieceStyle.whiteFill : pieceStyle.blackFill,
                      WebkitTextStroke: `1px ${cell.color === "w" ? pieceStyle.whiteStroke : pieceStyle.blackStroke}`,
                    }}
                  >
                    {MINI_PIECE_GLYPH[cell.type]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="options-toggle-row">
      <span>{label}</span>
      <button className="toggle-switch" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
        <span className="toggle-switch-knob" />
      </button>
    </div>
  );
}

function BoardSettings() {
  const { settings, update } = useGameSettings();
  const [draft, setDraft] = useState<GameSettings>(settings);
  const [innerTab, setInnerTab] = useState<BoardInnerTab>("theme");
  const [justSaved, setJustSaved] = useState(false);
  const boardTheme = BOARD_THEMES.find((t) => t.id === draft.boardThemeId) ?? BOARD_THEMES[0];
  const pieceStyle = PIECE_STYLES.find((p) => p.id === draft.pieceStyleId) ?? PIECE_STYLES[0];

  const dirty =
    draft.boardThemeId !== settings.boardThemeId ||
    draft.pieceStyleId !== settings.pieceStyleId ||
    draft.accentId !== settings.accentId ||
    draft.showCoordinates !== settings.showCoordinates ||
    draft.highlightLastMove !== settings.highlightLastMove;

  function setDraftField<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setJustSaved(false);
  }

  function handleSave() {
    update("boardThemeId", draft.boardThemeId);
    update("pieceStyleId", draft.pieceStyleId);
    update("accentId", draft.accentId);
    update("showCoordinates", draft.showCoordinates);
    update("highlightLastMove", draft.highlightLastMove);
    setJustSaved(true);
  }

  function handleCancel() {
    setDraft(settings);
    setJustSaved(false);
  }

  return (
    <div className="settings-controls">
      <div className="card">
        <div className="settings-inner-tabs">
          <button
            type="button"
            className={`settings-inner-tab ${innerTab === "theme" ? "settings-inner-tab-active" : ""}`}
            onClick={() => setInnerTab("theme")}
          >
            Échiquiers
          </button>
          <button
            type="button"
            className={`settings-inner-tab ${innerTab === "pieces" ? "settings-inner-tab-active" : ""}`}
            onClick={() => setInnerTab("pieces")}
          >
            Pièces
          </button>
          <button
            type="button"
            className={`settings-inner-tab ${innerTab === "background" ? "settings-inner-tab-active" : ""}`}
            onClick={() => setInnerTab("background")}
          >
            Arrière-plan
          </button>
          <button
            type="button"
            className={`settings-inner-tab ${innerTab === "presets" ? "settings-inner-tab-active" : ""}`}
            onClick={() => setInnerTab("presets")}
          >
            Prédéfinis
          </button>
        </div>

        <div className="board-settings-row">
          {innerTab === "theme" && (
            <div className="board-theme-grid">
              {BOARD_THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`board-swatch ${draft.boardThemeId === t.id ? "board-swatch-active" : ""}`}
                  onClick={() => setDraftField("boardThemeId", t.id)}
                  title={t.label}
                  aria-label={t.label}
                >
                  <span className="board-swatch-square" style={{ background: t.light }} />
                  <span className="board-swatch-square" style={{ background: t.dark }} />
                  <span className="board-swatch-square" style={{ background: t.dark }} />
                  <span className="board-swatch-square" style={{ background: t.light }} />
                </button>
              ))}
            </div>
          )}

          {innerTab === "pieces" && (
            <div className="piece-style-grid">
              {PIECE_STYLES.map((p) => (
                <button
                  key={p.id}
                  className={`piece-style-swatch ${draft.pieceStyleId === p.id ? "piece-style-swatch-active" : ""}`}
                  onClick={() => setDraftField("pieceStyleId", p.id)}
                >
                  <span className="piece-style-preview">
                    <span style={{ color: p.whiteFill, WebkitTextStroke: `1px ${p.whiteStroke}` }}>♞</span>
                    <span style={{ color: p.blackFill, WebkitTextStroke: `1px ${p.blackStroke}` }}>♞</span>
                  </span>
                  <span className="piece-style-label">{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {innerTab === "background" && (
            <div className="accent-grid">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  className={`accent-swatch ${draft.accentId === a.id ? "accent-swatch-active" : ""}`}
                  onClick={() => setDraftField("accentId", a.id)}
                  title={a.label}
                >
                  <span className="accent-swatch-dot" style={{ background: a.accent }} />
                  <span className="piece-style-label">{a.label}</span>
                </button>
              ))}
            </div>
          )}

          {innerTab === "presets" && (
            <div className="piece-style-grid">
              {PRESETS.map((p) => {
                const t = BOARD_THEMES.find((bt) => bt.id === p.boardThemeId) ?? BOARD_THEMES[0];
                const ps = PIECE_STYLES.find((pst) => pst.id === p.pieceStyleId) ?? PIECE_STYLES[0];
                const active = draft.boardThemeId === p.boardThemeId && draft.pieceStyleId === p.pieceStyleId;
                return (
                  <button
                    key={p.id}
                    className={`piece-style-swatch ${active ? "piece-style-swatch-active" : ""}`}
                    onClick={() => {
                      setDraftField("boardThemeId", p.boardThemeId);
                      setDraftField("pieceStyleId", p.pieceStyleId);
                    }}
                  >
                    <span className="piece-style-preview">
                      <span style={{ color: t.dark }}>♞</span>
                      <span style={{ color: ps.blackFill, WebkitTextStroke: `1px ${ps.blackStroke}` }}>♞</span>
                    </span>
                    <span className="piece-style-label">{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <MiniBoardPreview theme={boardTheme} pieceStyle={pieceStyle} />
        </div>
      </div>

      <div className="card">
        <h3>Affichage</h3>
        <ToggleRow
          label="Afficher les coordonnées"
          checked={draft.showCoordinates}
          onChange={(v) => setDraftField("showCoordinates", v)}
        />
        <ToggleRow
          label="Surbrillance du dernier coup"
          checked={draft.highlightLastMove}
          onChange={(v) => setDraftField("highlightLastMove", v)}
        />
      </div>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={handleCancel} disabled={!dirty}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
          {justSaved ? "Enregistré" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { user, updateProfile } = useAuth();
  const [bio, setBio] = useState(user?.bio ?? "");
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileRedirectArmed, setProfileRedirectArmed] = useState(false);

  const dirty = bio !== (user?.bio ?? "");

  function handleSaveProfile() {
    if (user?.isLichess) {
      if (!profileRedirectArmed) {
        setError("Les modifications du profil Lichess se font uniquement sur le site officiel. Reclique pour ouvrir la page.");
        setJustSaved(false);
        setProfileRedirectArmed(true);
        return;
      }

      window.open("https://lichess.org/account/profile", "_blank", "noopener,noreferrer");
      setProfileRedirectArmed(false);
      return;
    }

    try {
      updateProfile(bio);
      setError(null);
      setJustSaved(true);
    } catch (err) {
      setJustSaved(false);
      setError(err instanceof Error ? err.message : "La modification doit se faire sur le site officiel.");
    }
  }

  return (
    <div className="card profile-card">
      <h3>Profil public</h3>
      <p className="settings-subtitle">Modifie ta biographie. Elle n'est stockée que sur cet appareil.</p>

      <div className="profile-row">
        <div className="profile-avatar">
          <span>♙</span>
        </div>
        <div className="profile-info">
          <span className="profile-username">{user?.username ?? "Invité"}</span>
          <textarea
            className="input profile-bio"
            maxLength={50}
            rows={2}
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setJustSaved(false);
              setError(null);
              setProfileRedirectArmed(false);
            }}
            placeholder="Ta courte biographie apparaîtra ici."
          />
          <span className="profile-bio-count">{bio.length}/50</span>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={() => setBio(user?.bio ?? "")} disabled={!dirty}>
          Annuler
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSaveProfile}
          disabled={!dirty}
        >
          {user?.isLichess && profileRedirectArmed ? "Ouvrir Lichess" : justSaved ? "Enregistré" : "Sauvegarder"}
        </button>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginTop: "16px" }}>
          {error} <a href="https://lichess.org/account/profile" target="_blank" rel="noreferrer">Ouvrir Lichess</a>
        </div>
      )}
    </div>
  );
}

function AccountSettings() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordRedirectArmed, setPasswordRedirectArmed] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (user?.isLichess) {
      if (!passwordRedirectArmed) {
        setError("Les mots de passe Lichess se modifient uniquement sur le site officiel. Reclique pour ouvrir la page.");
        setPasswordRedirectArmed(true);
        return;
      }

      window.open("https://lichess.org/account/passwd", "_blank", "noopener,noreferrer");
      setPasswordRedirectArmed(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    try {
      changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <div className="card">
      <h3>Compte</h3>

      <div className="field">
        <label>Email</label>
        <input className="input" value={user?.email ?? ""} disabled />
      </div>

      <h3 className="settings-inline-title">Changer le mot de passe</h3>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">Mot de passe mis à jour.</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Mot de passe actuel</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordRedirectArmed(false);
            }}
          />
        </div>
        <div className="field">
          <label>Nouveau mot de passe</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordRedirectArmed(false);
            }}
          />
        </div>
        <div className="field">
          <label>Confirmer le nouveau mot de passe</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordRedirectArmed(false);
            }}
          />
        </div>
        <button className="btn btn-primary" type="submit">
          {user?.isLichess && passwordRedirectArmed ? "Ouvrir Lichess" : "Mettre à jour le mot de passe"}
        </button>
      </form>
    </div>
  );
}

function GameModeSettings() {
  const { settings, update } = useGameSettings();
  const [draft, setDraft] = useState(settings.defaultDifficultyId);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = draft !== settings.defaultDifficultyId;

  return (
    <div className="card">
      <h3>Mode de jeu</h3>
      <p className="settings-subtitle">Choisis le niveau utilisé par défaut quand tu défies un bot.</p>
      <div className="field">
        <label>Difficulté par défaut</label>
        <div className="choice-row">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`btn ${draft === d.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setDraft(d.id);
                setJustSaved(false);
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button
          className="btn btn-ghost"
          onClick={() => {
            setDraft(settings.defaultDifficultyId);
            setJustSaved(false);
          }}
          disabled={!dirty}
        >
          Annuler
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            update("defaultDifficultyId", draft);
            setJustSaved(true);
          }}
          disabled={!dirty}
        >
          {justSaved ? "Enregistré" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

function InterfaceSettings() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="card">
      <h3>Interface</h3>
      <ToggleRow label="Thème sombre" checked={theme === "dark"} onChange={toggleTheme} />
      <div className="options-toggle-row">
        <span>Langue</span>
        <span className="badge">Français</span>
      </div>
    </div>
  );
}

function AccessibilitySettings() {
  const { settings, update } = useGameSettings();
  return (
    <div className="card">
      <h3>Accessibilité</h3>
      <ToggleRow
        label="Réduire les animations"
        checked={settings.reduceMotion}
        onChange={(v) => update("reduceMotion", v)}
      />
    </div>
  );
}

function SubscriptionSettings() {
  return (
    <div className="card">
      <h3>Abonnement</h3>
      <p>ChessIA est entièrement gratuit. Il n'y a aucun abonnement ni fonctionnalité payante.</p>
    </div>
  );
}

function ComingSoonPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

const SUBNAV_ITEMS: { id: Tab; label: string; icon: typeof Grid3x3 }[] = [
  { id: "board", label: "Échiquier et pièces", icon: Grid3x3 },
  { id: "gamemode", label: "Mode de jeu", icon: Swords },
  { id: "profile", label: "Profil", icon: User },
  { id: "interface", label: "Interface", icon: Monitor },
  { id: "social", label: "Social", icon: Users },
  { id: "coach", label: "Entraîneur", icon: GraduationCap },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Compte", icon: KeyRound },
  { id: "subscription", label: "Abonnement", icon: CreditCard },
  { id: "accessibility", label: "Accessibilité", icon: Accessibility },
];

export function Settings() {
  const [tab, setTab] = useState<Tab>("board");

  return (
    <div className="settings-page">
      <h1>Paramètres</h1>
      <p className="settings-subtitle">Personnalise ton expérience ChessIA.</p>

      <div className="settings-shell">
        <nav className="settings-subnav">
          {SUBNAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-subnav-item ${tab === id ? "settings-subnav-item-active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {tab === "board" && <BoardSettings />}
          {tab === "profile" && <ProfileSettings />}
          {tab === "account" && <AccountSettings />}
          {tab === "gamemode" && <GameModeSettings />}
          {tab === "interface" && <InterfaceSettings />}
          {tab === "accessibility" && <AccessibilitySettings />}
          {tab === "subscription" && <SubscriptionSettings />}
          {tab === "social" && (
            <ComingSoonPanel title="Social" text="Les amis et les clubs ne sont pas encore disponibles sur ChessIA." />
          )}
          {tab === "coach" && (
            <ComingSoonPanel
              title="Entraîneur"
              text="Un entraîneur basé sur l'IA n'est pas encore disponible sur ChessIA."
            />
          )}
          {tab === "notifications" && (
            <ComingSoonPanel title="Notifications" text="ChessIA n'envoie pas encore de notifications." />
          )}
        </div>
      </div>
    </div>
  );
}
