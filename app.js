(function () {
  const searchInput   = document.getElementById("searchInput");
  const clearBtn      = document.getElementById("clearBtn");
  const navList       = document.getElementById("navList");
  const navOnboarding = document.getElementById("navOnboarding");
  const searchMeta    = document.getElementById("searchMeta");
  const dropdown      = document.getElementById("searchDropdown");
  const lastUpdated   = document.getElementById("lastUpdated");

  const themeToggle   = document.getElementById("themeToggle");
  const iconMoon      = document.getElementById("iconMoon");
  const iconSun       = document.getElementById("iconSun");

  const adminBtn      = document.getElementById("adminBtn");
  const logoutBtn     = document.getElementById("logoutBtn");

  const welcomePage   = document.getElementById("welcomePage");

  rt_seedIfMissing();
  const session = rt_getSession();
  if (!session) { window.location.href = "login.html"; return; }

  // App.js is intended for the training page only.
  if (!searchInput || !clearBtn || !dropdown) return;

  // UI buttons
  if (logoutBtn) logoutBtn.addEventListener("click", () => { rt_logout(); window.location.href = "login.html"; });
  if (adminBtn) {
    adminBtn.addEventListener("click", () => window.location.href = "admin.html");
    if (session.role !== "admin") adminBtn.style.display = "none";
  }

  const sectionsAll = Array.from(document.querySelectorAll(".docSection"));

  // Determine processes available
  const allProcessIds = sectionsAll.map(sec => sec.getAttribute("data-process-id")).filter(Boolean);

  // Find current user
  const user = rt_findUserByUsername(session.username);
  if (!user) { rt_logout(); window.location.href = "login.html"; return; }

  // Read global trainee settings
  const settings = rt_getTrainingSettings();
  const traineeEnabled = settings.traineeEnabledProcesses || [];

  // Compute visible process IDs based on user role + permissions
  const visibleProcessIds = rt_getVisibleProcessIdsForUser(user, allProcessIds, traineeEnabled);
  const visibleSet = new Set(visibleProcessIds);

  // Hide non-visible sections entirely
  sectionsAll.forEach(sec => {
    const pid = sec.getAttribute("data-process-id");
    sec.classList.toggle("hidden", !visibleSet.has(pid));
  });

  // Build list of visible sections (for nav + search)
  const sections = sectionsAll.filter(sec => !sec.classList.contains("hidden"));

  // If user has no visible processes, show message
  if (!sections.length) {
    document.querySelector(".content").innerHTML = `
      <div class="card">
        <h2>No processes assigned</h2>
        <p>Your account has no approved processes yet. Please contact admin.</p>
      </div>`;
    return;
  }

  /* =========================
     THEME
  ========================= */
  function updateThemeIcons(theme) {
    if (!iconMoon || !iconSun) return;
    if (theme === "dark") {
      iconMoon.classList.add("hidden");
      iconSun.classList.remove("hidden");
    } else {
      iconSun.classList.add("hidden");
      iconMoon.classList.remove("hidden");
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    updateThemeIcons(theme);
  }

  function initTheme() {
    const saved = localStorage.getItem("theme");
    applyTheme(saved === "dark" ? "dark" : "light");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* =========================
     HELPERS: WELCOME + SECTIONS
  ========================= */
  function showWelcome() {
    if (welcomePage) welcomePage.style.display = "";
  }

  function hideWelcome() {
    if (welcomePage) welcomePage.style.display = "none";
  }

  function ensureIds() {
    sections.forEach((sec, i) => {
      if (!sec.id) sec.id = `sec-${i}`;
      const details = Array.from(sec.querySelectorAll("details.accordion"));
      details.forEach((d, j) => {
        if (!d.id) d.id = `${sec.id}-detail-${j}`;
      });
    });
  }

  /* =========================
     NAVIGATION (SHOW ONE PROCESS)
  ========================= */
  function getNavGroup(sec) {
    // Preferred: explicit grouping via HTML attribute
    const g = (sec.getAttribute("data-nav-group") || "").trim().toLowerCase();
    if (g) return g;

    // Safe fallback: treat the onboarding module as "Onboarding"
    // (keeps existing pages working even if data-nav-group is missing)
    const pid = (sec.getAttribute("data-process-id") || "").trim().toLowerCase();
    if (pid === "welcome") return "onboarding";

    const title = (sec.getAttribute("data-title") || sec.querySelector("h2")?.textContent || "").trim().toLowerCase();
    if (title.includes("onboarding")) return "onboarding";

    return "processes";
  }

  function buildNav() {
    if (navList) navList.innerHTML = "";
    if (navOnboarding) navOnboarding.innerHTML = "";

    sections.forEach((sec) => {
      const title = (sec.getAttribute("data-title") || sec.querySelector("h2")?.textContent || sec.id).trim();

      const li = document.createElement("li");
      const a  = document.createElement("a");
      a.href = "#";
      a.textContent = title;

      a.addEventListener("click", (e) => {
        e.preventDefault();
        hideWelcome();              // ✅ Welcome disappears
        showSection(sec.id, true);
        closeDropdown();
        clearSearchMeta();
      });

      li.appendChild(a);

      const group = getNavGroup(sec);
      if (group === "onboarding" && navOnboarding) {
        navOnboarding.appendChild(li);
      } else if (navList) {
        navList.appendChild(li);
      }
    });
  }

  function getAllNavLinks() {
    const links = [];
    if (navOnboarding) links.push(...Array.from(navOnboarding.querySelectorAll("a")));
    if (navList) links.push(...Array.from(navList.querySelectorAll("a")));
    return links;
  }

  function clearActiveNav() {
    getAllNavLinks().forEach((a) => a.classList.remove("active"));
  }

  function setActiveNav(sectionId) {
    const links = getAllNavLinks();
    links.forEach((a) => a.classList.remove("active"));

    const sec = document.getElementById(sectionId);
    const title = (sec?.getAttribute("data-title") || sec?.querySelector("h2")?.textContent || "").trim();
    const match = links.find((a) => a.textContent.trim() === title);
    if (match) match.classList.add("active");
  }

  function hideAllSections() {
    sections.forEach((sec) => {
      sec.classList.add("hidden");
      sec.style.display = "";
    });
    clearActiveNav();
  }

  function showSection(sectionId, scrollTop) {
    sections.forEach((sec) => {
      sec.classList.toggle("hidden", sec.id !== sectionId);
      sec.style.display = "";
    });
    setActiveNav(sectionId);
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================
     SEARCH (INTELLIGENT JUMP)
  ========================= */
  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(str) {
    const s = normalize(str);
    return s ? s.split(" ") : [];
  }

  function buildSearchEntries() {
    const entries = [];

    sections.forEach((sec) => {
      const sectionTitle = (sec.getAttribute("data-title") || sec.querySelector("h2")?.textContent || sec.id).trim();
      const sectionTags  = (sec.getAttribute("data-tags") || "").trim();
      const sectionText  = `${sectionTitle} ${sectionTags} ${sec.textContent || ""}`;

      entries.push({
        type: "section",
        label: sectionTitle,
        meta: "Process",
        sectionId: sec.id,
        targetId: sec.id,
        text: sectionText
      });

      const details = Array.from(sec.querySelectorAll("details.accordion"));
      details.forEach((d) => {
        const title = (d.getAttribute("data-title") || d.querySelector("summary")?.textContent || d.id).trim();
        const keywords = (d.getAttribute("data-keywords") || "").trim();
        const text = `${title} ${keywords} ${d.textContent || ""}`;

        entries.push({
          type: "detail",
          label: title,
          meta: `Inside: ${sectionTitle}`,
          sectionId: sec.id,
          targetId: d.id,
          text
        });
      });
    });

    return entries;
  }

  // Token match w/ light fuzzy behavior (prefix + substring), weighted.
  function score(query, entry) {
    const q = normalize(query);
    const qTokens = tokenize(q);
    if (!qTokens.length) return 0;

    const labelN = normalize(entry.label);
    const textN  = normalize(entry.text);

    // Phrase match gets a big boost.
    let s = 0;
    if (labelN.includes(q)) s += 0.55;
    else if (textN.includes(q)) s += 0.35;

    // Token-level scoring: exact > prefix > substring
    let tokenScore = 0;
    qTokens.forEach((t) => {
      if (labelN.split(" ").includes(t)) tokenScore += 1.4;
      else if (labelN.includes(t)) tokenScore += 1.0;
      else if (textN.split(" ").includes(t)) tokenScore += 0.9;
      else if (textN.includes(t)) tokenScore += 0.5;
    });

    s += tokenScore / (qTokens.length * 1.6);

    // Prefer detail jumps slightly, because they land closer to the answer.
    if (entry.type === "detail") s += 0.08;
    return s;
  }

  let SEARCH_ENTRIES = [];

  function findMatches(query) {
    return SEARCH_ENTRIES
      .map((e) => ({ e, s: score(query, e) }))
      .filter((x) => x.s > 0.18)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);
  }

  function clearSearchMeta() {
    if (searchMeta) searchMeta.textContent = "";
  }

  function closeDropdown() {
    if (!dropdown) return;
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    activeIndex = -1;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }

  let activeIndex = -1;
  let lastMatches = [];

  function setActive(index) {
    activeIndex = index;
    const items = Array.from(dropdown.querySelectorAll("[role='option']"));
    items.forEach((it, i) => {
      it.setAttribute("aria-selected", String(i === activeIndex));
    });
    const active = items[activeIndex];
    if (active) {
      searchInput.setAttribute("aria-activedescendant", active.id);
      // Ensure active item stays visible
      active.scrollIntoView({ block: "nearest" });
    } else {
      searchInput.removeAttribute("aria-activedescendant");
    }
  }

  function openDropdown(matches) {
    if (!dropdown || !matches.length) { closeDropdown(); return; }

    dropdown.innerHTML = "";
    lastMatches = matches;
    matches.forEach(({ e }, idx) => {
      const item = document.createElement("div");
      item.className = "searchItem";
      item.setAttribute("role", "option");
      item.id = `srchopt-${idx}`;
      item.setAttribute("aria-selected", "false");

      const t = document.createElement("div");
      t.className = "searchItemTitle";
      t.textContent = e.label;

      const m = document.createElement("div");
      m.className = "searchItemMeta";
      m.textContent = e.meta;

      item.appendChild(t);
      item.appendChild(m);

      item.addEventListener("click", () => jumpTo(e));
      item.addEventListener("mousemove", () => setActive(idx));
      dropdown.appendChild(item);
    });

    dropdown.classList.remove("hidden");
    searchInput.setAttribute("aria-expanded", "true");
    // Default highlight first suggestion for keyboard users
    setActive(0);
  }

  function highlight(el) {
    if (!el) return;
    el.classList.add("jumpHighlight");
    setTimeout(() => el.classList.remove("jumpHighlight"), 1600);
  }

  function jumpTo(entry) {
    hideWelcome();                 // ✅ Welcome disappears when search jumps
    showSection(entry.sectionId, false);
    closeDropdown();

    const target = document.getElementById(entry.targetId);
    if (target?.tagName?.toLowerCase() === "details") target.open = true;

    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    highlight(target);

    if (searchMeta) searchMeta.textContent = `Jumped to: ${entry.label}`;
  }

  let debounce = null;

  searchInput.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = searchInput.value.trim();

    if (!q) { closeDropdown(); clearSearchMeta(); return; }

    debounce = setTimeout(() => {
      const matches = findMatches(q);
      openDropdown(matches);
      searchMeta.textContent = matches.length
        ? `Suggestions for: "${q}" (press Enter to jump)`
        : `No matches for: "${q}"`;
    }, 120);
  });

  // ARIA combobox wiring (no visual changes)
  searchInput.setAttribute("role", "combobox");
  searchInput.setAttribute("aria-autocomplete", "list");
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.setAttribute("aria-controls", "searchDropdown");

  searchInput.addEventListener("keydown", (e) => {
    const hasDropdown = !dropdown.classList.contains("hidden") && lastMatches.length;

    if (e.key === "ArrowDown") {
      if (!hasDropdown) {
        const matches = findMatches(searchInput.value);
        openDropdown(matches);
      } else {
        e.preventDefault();
        setActive(Math.min(activeIndex + 1, lastMatches.length - 1));
      }
      return;
    }

    if (e.key === "ArrowUp") {
      if (hasDropdown) {
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const matches = hasDropdown ? lastMatches : findMatches(searchInput.value);
      const idx = hasDropdown ? Math.max(activeIndex, 0) : 0;
      if (matches.length) jumpTo(matches[idx].e);
      return;
    }

    if (e.key === "Escape") {
      closeDropdown();
      clearSearchMeta();
      return;
    }
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    closeDropdown();
    clearSearchMeta();
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== searchInput) closeDropdown();
  });

  /* =========================
     INIT
  ========================= */
  ensureIds();
  buildNav();
  initTheme();

  SEARCH_ENTRIES = buildSearchEntries();

  // ✅ On load: show Welcome, hide processes until a process is selected
  showWelcome();
  hideAllSections();

  // If there is a valid hash (deep link), show that section instead
  const hashId = (window.location.hash || "").replace("#", "").trim();
  const hashEl = hashId ? document.getElementById(hashId) : null;
  const hashIsVisibleSection = !!hashEl && sections.includes(hashEl);

  if (hashIsVisibleSection) {
    hideWelcome();
    showSection(hashEl.id, false);
  }

  if (lastUpdated) {
    lastUpdated.textContent = new Date().toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric"
    });
  }
})();
