(function () {
  "use strict";

  var COOKIE_DONE = "ddr_done";
  var COOKIE_PREFS = "ddr_prefs";
  var COOKIE_DAYS = 365;

  var state = {
    done: {},
    type: "all",
    group: "location",
    hideCompleted: false,
    hideUnavailable: false,
    search: ""
  };

  function padNo(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function setCookie(name, value, days) {
    var maxAge = Math.floor(days * 24 * 60 * 60);
    document.cookie =
      encodeURIComponent(name) +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
  }

  function getCookie(name) {
    var key = encodeURIComponent(name) + "=";
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(key) === 0) {
        return decodeURIComponent(part.substring(key.length));
      }
    }
    return null;
  }

  function loadState() {
    var rawDone = getCookie(COOKIE_DONE);
    if (rawDone) {
      try {
        var ids = JSON.parse(rawDone);
        if (Array.isArray(ids)) {
          state.done = {};
          for (var i = 0; i < ids.length; i++) {
            state.done[ids[i]] = true;
          }
        }
      } catch (e) {
        state.done = {};
      }
    }

    var rawPrefs = getCookie(COOKIE_PREFS);
    if (rawPrefs) {
      try {
        var prefs = JSON.parse(rawPrefs);
        if (prefs.type) state.type = prefs.type;
        if (prefs.group) state.group = prefs.group;
        if (typeof prefs.hideCompleted === "boolean") state.hideCompleted = prefs.hideCompleted;
        if (typeof prefs.hideUnavailable === "boolean") state.hideUnavailable = prefs.hideUnavailable;
      } catch (e) {
        /* ignore */
      }
    }
  }

  function saveDone() {
    var ids = Object.keys(state.done).filter(function (id) {
      return state.done[id];
    });
    setCookie(COOKIE_DONE, JSON.stringify(ids), COOKIE_DAYS);
  }

  function savePrefs() {
    setCookie(
      COOKIE_PREFS,
      JSON.stringify({
        type: state.type,
        group: state.group,
        hideCompleted: state.hideCompleted,
        hideUnavailable: state.hideUnavailable
      }),
      COOKIE_DAYS
    );
  }

  function prosperityCount() {
    // tiap entry yang selesai dihitung 1 buat cek prosperityMin
    var n = 0;
    var entries = window.GUIDE_ENTRIES;
    for (var i = 0; i < entries.length; i++) {
      if (state.done[entries[i].id]) n++;
    }
    return n;
  }

  function isAvailable(entry) {
    if (entry.prosperityMin != null && prosperityCount() < entry.prosperityMin) {
      return false;
    }
    var req = entry.requires || [];
    for (var i = 0; i < req.length; i++) {
      if (!state.done[req[i]]) return false;
    }
    return true;
  }

  function matchesType(entry) {
    if (state.type === "all") return true;
    return entry.types.indexOf(state.type) !== -1;
  }

  function matchesSearch(entry) {
    var q = state.search.trim().toLowerCase();
    if (!q) return true;
    var hay =
      entry.name +
      " " +
      entry.location +
      " " +
      entry.steps +
      " " +
      entry.conditions +
      " #" +
      entry.no;
    return hay.toLowerCase().indexOf(q) !== -1;
  }

  function filteredEntries() {
    var list = [];
    var entries = window.GUIDE_ENTRIES;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!matchesType(e)) continue;
      if (!matchesSearch(e)) continue;
      var done = !!state.done[e.id];
      var avail = isAvailable(e);
      if (state.hideCompleted && done) continue;
      if (state.hideUnavailable && !avail && !done) continue;
      list.push(e);
    }
    return list;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function typeTagsHtml(types) {
    var html = "";
    for (var i = 0; i < types.length; i++) {
      html +=
        '<span class="type-tag ' +
        escapeHtml(types[i]) +
        '">' +
        escapeHtml(types[i]) +
        "</span>";
    }
    return html;
  }

  function entryHtml(entry) {
    var done = !!state.done[entry.id];
    var avail = isAvailable(entry);
    var classes = "entry";
    if (done) classes += " done";
    if (!avail && !done) classes += " unavailable";

    return (
      '<article class="' +
      classes +
      '" data-id="' +
      escapeHtml(entry.id) +
      '">' +
      '<div class="entry-check">' +
      '<input type="checkbox" id="cb-' +
      escapeHtml(entry.id) +
      '" ' +
      (done ? "checked " : "") +
      'aria-label="Mark ' +
      escapeHtml(entry.name) +
      ' done" />' +
      "</div>" +
      '<div class="entry-main">' +
      '<div class="entry-head">' +
      '<span class="entry-id">#' +
      padNo(entry.no) +
      "</span>" +
      '<span class="entry-name">' +
      escapeHtml(entry.name) +
      "</span>" +
      typeTagsHtml(entry.types) +
      (state.group === "name"
        ? '<span class="entry-loc">' + escapeHtml(entry.location) + "</span>"
        : "") +
      "</div>" +
      "<details>" +
      "<summary>Details</summary>" +
      '<dl class="detail-block">' +
      "<dt>Conditions</dt><dd>" +
      escapeHtml(entry.conditions) +
      "</dd>" +
      "<dt>How to</dt><dd>" +
      escapeHtml(entry.steps) +
      "</dd>" +
      "<dt>Rewards</dt><dd>" +
      escapeHtml(entry.rewards) +
      "</dd>" +
      (entry.requires && entry.requires.length
        ? "<dt>Requires</dt><dd>" +
          escapeHtml(
            entry.requires
              .map(function (id) {
                return id.replace(/^e/, "#");
              })
              .join(", ")
          ) +
          (entry.prosperityMin != null
            ? " · prosperity ≥ " + entry.prosperityMin
            : "") +
          "</dd>"
        : entry.prosperityMin != null
          ? "<dt>Requires</dt><dd>prosperity ≥ " + entry.prosperityMin + "</dd>"
          : "") +
      "</dl>" +
      "</details>" +
      "</div>" +
      "</article>"
    );
  }

  function groupByLocation(list) {
    var map = {};
    var order = window.LOCATION_ORDER || [];
    for (var i = 0; i < list.length; i++) {
      var loc = list[i].location;
      if (!map[loc]) map[loc] = [];
      map[loc].push(list[i]);
    }
    var groups = [];
    for (var o = 0; o < order.length; o++) {
      if (map[order[o]]) {
        groups.push({ title: order[o], items: map[order[o]] });
        delete map[order[o]];
      }
    }
    var leftovers = Object.keys(map).sort();
    for (var l = 0; l < leftovers.length; l++) {
      groups.push({ title: leftovers[l], items: map[leftovers[l]] });
    }
    return groups;
  }

  function groupByName(list) {
    var sorted = list.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    return [{ title: "A–Z", items: sorted }];
  }

  function updateProgress(visibleList) {
    var entries = window.GUIDE_ENTRIES;
    var scoped = [];
    for (var i = 0; i < entries.length; i++) {
      if (matchesType(entries[i])) scoped.push(entries[i]);
    }
    var done = 0;
    for (var j = 0; j < scoped.length; j++) {
      if (state.done[scoped[j].id]) done++;
    }
    var label = document.getElementById("progressLabel");
    var shown = visibleList.length;
    label.textContent =
      done +
      " / " +
      scoped.length +
      " done" +
      (shown !== scoped.length ? " · showing " + shown : "");
  }

  function render() {
    var root = document.getElementById("listRoot");
    var list = filteredEntries();
    updateProgress(list);

    if (!list.length) {
      root.innerHTML = '<p class="empty">No entries match these filters.</p>';
      return;
    }

    var groups =
      state.group === "name" ? groupByName(list) : groupByLocation(list);
    var html = "";
    for (var g = 0; g < groups.length; g++) {
      html += '<section class="group">';
      html += '<h2 class="group-title">' + escapeHtml(groups[g].title) + "</h2>";
      for (var i = 0; i < groups[g].items.length; i++) {
        html += entryHtml(groups[g].items[i]);
      }
      html += "</section>";
    }
    root.innerHTML = html;
  }

  function syncControls() {
    var chips = document.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      if (chip.getAttribute("data-type") === state.type) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    }
    document.getElementById("groupSelect").value = state.group;
    document.getElementById("hideCompleted").checked = state.hideCompleted;
    document.getElementById("hideUnavailable").checked = state.hideUnavailable;
  }

  function onListClick(e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[type="checkbox"]')) {
      var article = t.closest(".entry");
      if (!article) return;
      var id = article.getAttribute("data-id");
      if (t.checked) {
        state.done[id] = true;
      } else {
        delete state.done[id];
      }
      saveDone();
      render();
    }
  }

  function bind() {
    document.getElementById("listRoot").addEventListener("change", onListClick);

    var chips = document.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener("click", function (ev) {
        state.type = ev.currentTarget.getAttribute("data-type");
        savePrefs();
        syncControls();
        render();
      });
    }

    document.getElementById("groupSelect").addEventListener("change", function (ev) {
      state.group = ev.target.value;
      savePrefs();
      render();
    });

    document.getElementById("hideCompleted").addEventListener("change", function (ev) {
      state.hideCompleted = ev.target.checked;
      savePrefs();
      render();
    });

    document.getElementById("hideUnavailable").addEventListener("change", function (ev) {
      state.hideUnavailable = ev.target.checked;
      savePrefs();
      render();
    });

    var searchTimer = null;
    document.getElementById("searchInput").addEventListener("input", function (ev) {
      var val = ev.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = val;
        render();
      }, 120);
    });

    document.getElementById("resetBtn").addEventListener("click", function () {
      if (
        !window.confirm(
          "Reset all checklist progress? This cannot be undone."
        )
      ) {
        return;
      }
      state.done = {};
      saveDone();
      render();
    });
  }

  function init() {
    if (!window.GUIDE_ENTRIES || !window.GUIDE_ENTRIES.length) {
      document.getElementById("listRoot").innerHTML =
        '<p class="empty">Checklist data failed to load.</p>';
      return;
    }
    loadState();
    syncControls();
    bind();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
