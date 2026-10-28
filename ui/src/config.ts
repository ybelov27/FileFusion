/*
 * Site configuration.
 *
 * googleClientId: an OAuth 2.0 "Web application" client ID from
 * https://console.cloud.google.com/apis/credentials. Its "Authorized JavaScript
 * origins" must include https://ybelov27.github.io (and http://localhost:8000,
 * the `npm run dev` address). Leave empty to hide Google sign-in.
 */
export const config = {
  googleClientId:
    "966174453185-nfn9ns4ri5cej1i2epho6e9mljhqqpfu.apps.googleusercontent.com",
  repo: "ybelov27/FileFusion",
  siteUrl: "https://ybelov27.github.io/FileFusion/",
};
