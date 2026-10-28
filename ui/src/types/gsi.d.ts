// Minimal typings for the parts of Google Identity Services File Fusion uses.
// https://developers.google.com/identity/gsi/web/reference/js-reference

declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
  }

  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
  }

  interface GsiButtonConfiguration {
    type?: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    logo_alignment?: "left" | "center";
  }

  function initialize(config: IdConfiguration): void;
  function renderButton(
    parent: HTMLElement,
    options: GsiButtonConfiguration,
  ): void;
  function prompt(): void;
  function disableAutoSelect(): void;
}

interface Window {
  google?: typeof google;
  webkitAudioContext?: typeof AudioContext;
}
