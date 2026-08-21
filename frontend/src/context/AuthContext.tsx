import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface StoredUser {
  id: string;
  username: string;
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  elo?: number; 
  isLichess?: boolean; 
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>; 
  logout: () => void;
}

const USERS_KEY = "chess-users";
const SESSION_KEY = "chess-session";
const TOKEN_KEY = "chess-api-token";

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toPublicUser(u: StoredUser): AuthUser {
  return { id: u.id, username: u.username, email: u.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const fetchProfileFromAPI = async (token: string) => {
    try {
      const res = await fetch("http://localhost:8000/api/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Token expiré ou erreur serveur");
      
      const userData = await res.json();
      setUser(userData); 
    } catch (err) {
      console.error(err);
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  };

  // ⚡️ LE SEUL ET UNIQUE useEffect POUR INITIALISER LA SESSION
  useEffect(() => {
    // Session locale classique
    const sessionId = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (sessionId) {
      const found = readUsers().find((u) => u.id === sessionId);
      if (found) setUser(toPublicUser(found));
    }

    // Session Lichess via ton API
    const apiToken = localStorage.getItem(TOKEN_KEY);
    if (apiToken) {
      fetchProfileFromAPI(apiToken);
    }
  }, []);

  const loginWithToken = async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token); 
    await fetchProfileFromAPI(token); 
  };

  const login = async (email: string, password: string, remember = true) => {
    const normalizedEmail = email.trim().toLowerCase();
    const found = readUsers().find((u) => u.email === normalizedEmail);
    if (!found || found.password !== password) {
      throw new Error("Email ou mot de passe incorrect.");
    }
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, found.id);
    setUser(toPublicUser(found));
  };

  const signup = async (username: string, email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = readUsers();
    if (users.some((u) => u.email === normalizedEmail)) {
      throw new Error("Un compte existe déjà avec cet email.");
    }
    if (users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
      throw new Error("Ce nom d'utilisateur est déjà pris.");
    }
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      username: username.trim(),
      email: normalizedEmail,
      password,
    };
    writeUsers([...users, newUser]);
    localStorage.setItem(SESSION_KEY, newUser.id);
    setUser(toPublicUser(newUser));
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY); 
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, signup, loginWithToken, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}