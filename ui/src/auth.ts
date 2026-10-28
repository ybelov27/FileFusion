/*
 * Google sign-in via Google Identity Services.
 * The site is static, so the ID token is decoded client-side only to show the
 * user's profile and keep their conversion history separate per account.
 */
import { config } from "./config.ts";

export interface User {
  id: string;
  name: string;
  givenName: string;
  email: string;
  picture: string;
}

type Listener = (user: User | null) => void;

const STORAGE_KEY = "ff_user";
const clientId = config.googleClientId;
const listeners: Listener[] = [];

function read(): User | null {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as User | null;
  } catch {
    return null;
  }
}

function write(u: User | null): void {
  try {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

let user = read();

interface IdTokenPayload {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  picture?: string;
}

function decodeJwt(token: string): IdTokenPayload {
  const payload = (token.split(".")[1] ?? "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as IdTokenPayload;
}

function emit(): void {
  listeners.forEach((fn) => fn(user));
}

function handleCredential(
  response: google.accounts.id.CredentialResponse,
): void {
  const p = decodeJwt(response.credential);
  user = {
    id: p.sub,
    name: p.name || p.email,
    givenName: p.given_name || "",
    email: p.email,
    picture: p.picture || "",
  };
  write(user);
  emit();
}

const ready: Promise<boolean> = new Promise((resolve) => {
  if (!clientId) return resolve(false);
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = () => {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_prompt: true,
    });
    resolve(true);
  };
  script.onerror = () => resolve(false);
  document.head.appendChild(script);
});

export const auth = {
  get user(): User | null {
    return user;
  },
  get enabled(): boolean {
    return Boolean(clientId);
  },
  ready,
  onChange(fn: Listener): void {
    listeners.push(fn);
    fn(user);
  },
  async renderButton(
    el: HTMLElement | null,
    options: google.accounts.id.GsiButtonConfiguration = {},
  ): Promise<boolean> {
    if (!el || !(await ready)) {
      if (el) el.hidden = true;
      return false;
    }
    el.hidden = Boolean(user);
    google.accounts.id.renderButton(el, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      ...options,
    });
    return true;
  },
  async promptOneTap(): Promise<void> {
    if (!user && (await ready)) google.accounts.id.prompt();
  },
  signOut(): void {
    window.google?.accounts.id.disableAutoSelect();
    user = null;
    write(null);
    emit();
  },
};
