import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Mock auth: users + sessions live in localStorage only, no server.
 * There is no backend for this project — this is a client-only account
 * system, not a stand-in for one.
 */

interface StoredUser {
  id: string;
  username: string;
  email: string;
  password: string;
  bio: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  bio: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (bio: string) => void;
  changePassword: (currentPassword: string, newPassword: string) => void;
}

const USERS_KEY = "chess-users";
const SESSION_KEY = "chess-session";

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
  return { id: u.id, username: u.username, email: u.email, bio: u.bio ?? "" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sessionId = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    const found = readUsers().find((u) => u.id === sessionId);
    if (found) setUser(toPublicUser(found));
  }, []);

  const login = async (email: string, password: string, remember = true) => {
    const normalizedEmail = email.trim().toLowerCase();
    const found = readUsers().find((u) => u.email === normalizedEmail);
    if (!found || found.password !== password) {
      throw new Error("Email ou mot de passe incorrect.");
    }
    // "Se souvenir de moi" off means the session doesn't survive closing the tab.
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
      bio: "",
    };
    writeUsers([...users, newUser]);
    localStorage.setItem(SESSION_KEY, newUser.id);
    setUser(toPublicUser(newUser));
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const updateProfile = (bio: string) => {
    setUser((current) => {
      if (!current) return current;
      const users = readUsers();
      const updated = users.map((u) => (u.id === current.id ? { ...u, bio } : u));
      writeUsers(updated);
      return { ...current, bio };
    });
  };

  const changePassword = (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error("Non connecté.");
    const users = readUsers();
    const found = users.find((u) => u.id === user.id);
    if (!found || found.password !== currentPassword) {
      throw new Error("Mot de passe actuel incorrect.");
    }
    writeUsers(users.map((u) => (u.id === user.id ? { ...u, password: newPassword } : u)));
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
