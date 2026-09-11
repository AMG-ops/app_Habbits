import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, token } from "./api";
import type { Accent, User } from "./api";

interface AuthValue {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: {
    email: string;
    password: string;
    display_name: string;
    accent: Accent;
  }) => Promise<void>;
  signOut: () => void;
  refresh: (user: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token.read()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => token.clear())
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.signIn({ email, password });
    token.write(result.access_token);
    setUser(result.user);
  }, []);

  const signUp = useCallback<AuthValue["signUp"]>(async (payload) => {
    const result = await api.signUp(payload);
    token.write(result.access_token);
    setUser(result.user);
  }, []);

  const signOut = useCallback(() => {
    token.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, refresh: setUser }),
    [user, ready, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
