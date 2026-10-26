(function () {
  const drop = document.getElementById("hero-drop");
  const input = document.getElementById("hero-input");
  // Conversion pages (e.g. png-to-jpg.html) preselect their target format in the converter.
  const target = drop && drop.dataset.target;
  const converterUrl = target
    ? `app.html?to=${encodeURIComponent(target)}`
    : "app.html";

  async function start(files) {
    if (!files || !files.length) return;
    try {
      await window.FFHandoff.put(files);
    } catch {
      /* fall through: the converter opens empty */
    }
    location.href = converterUrl;
  }

  if (drop) {
    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => start(input.files));

    ["dragenter", "dragover"].forEach((t) =>
      document.addEventListener(t, (e) => {
        e.preventDefault();
        drop.classList.add("dragging");
      }),
    );
    document.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget) drop.classList.remove("dragging");
    });
    document.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("dragging");
      if (e.dataTransfer) start(e.dataTransfer.files);
    });
    document.addEventListener("paste", (e) => {
      if (e.clipboardData && e.clipboardData.files.length)
        start(e.clipboardData.files);
    });
  }

  window.FFShare && window.FFShare.wire(document);

  fetch("https://api.github.com/repos/ybelov27/FileFusion")
    .then((r) => (r.ok ? r.json() : null))
    .then((repo) => {
      if (!repo || !repo.stargazers_count) return;
      document.querySelectorAll("[data-gh-stars]").forEach((el) => {
        el.textContent = repo.stargazers_count.toLocaleString();
        el.hidden = false;
        const count = el.closest(".gh-count");
        if (count) count.hidden = false;
      });
    })
    .catch(() => {
      /* count is optional */
    });

  if (!window.FFAuth) return;
  const navUser = document.getElementById("nav-user");
  const gsiNav = document.getElementById("gsi-nav");
  const gsiHero = document.getElementById("gsi-hero");
  window.FFAuth.onChange((user) => {
    if (gsiNav) gsiNav.hidden = Boolean(user) || !window.FFAuth.enabled;
    if (gsiHero) gsiHero.hidden = Boolean(user) || !window.FFAuth.enabled;
    if (!navUser) return;
    navUser.hidden = !user;
    if (user) {
      navUser.replaceChildren();
      if (user.picture) {
        const img = document.createElement("img");
        img.src = user.picture;
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        navUser.append(img);
      }
      navUser.append(`Hi, ${user.givenName || user.name}`);
    }
  });
  window.FFAuth.renderButton(gsiNav, { size: "medium", text: "signin" });
  window.FFAuth.renderButton(gsiHero, { size: "large", text: "continue_with" });
  window.FFAuth.promptOneTap();
})();
