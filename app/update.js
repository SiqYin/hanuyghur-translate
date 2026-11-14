/* 汉维辞典 · 更新检测
 * 启动时查询 GitHub 最新 Release；比本机（LEX_META.version）新则弹窗，
 * 按当前界面语言显示；"暂不"关闭弹窗，"更新"打开 releases/latest。
 * 检测失败或版本相同/更旧时静默，什么都不显示。三端通用：
 *   网页 → 新标签；Electron → setWindowOpenHandler 转系统浏览器；
 *   Android → shouldOverrideUrlLoading 转系统浏览器（见 MainActivity）。
 */
(function () {
  "use strict";

  var REPO_API = "https://api.github.com/repos/SiqYin/hanuyghur-translate/releases/latest";

  function parseVer(s) {
    return String(s || "").replace(/^[vV]/, "").split(".").map(function (x) {
      return parseInt(x, 10) || 0;
    });
  }

  function isNewer(latest, local) {
    for (var i = 0; i < 3; i++) {
      var a = latest[i] || 0, b = local[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return false;
  }

  function t(key, vars) {
    if (window.I18N && window.I18N.t) return window.I18N.t(key, vars);
    return key;
  }

  function show(latestTag, url) {
    var overlay = document.getElementById("updOverlay");
    if (!overlay) return;
    document.getElementById("updTitle").textContent = t("update_title");
    document.getElementById("updBody").textContent = t("update_body", { v: latestTag });
    document.getElementById("updLater").textContent = t("update_later");
    var go = document.getElementById("updGo");
    go.textContent = t("update_go");
    go.href = url;
    overlay.hidden = false;
    document.getElementById("updLater").addEventListener("click", function () {
      overlay.hidden = true;
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.hidden = true;
    });
  }

  var local = parseVer((window.LEX_META && window.LEX_META.version) || "");
  fetch(REPO_API, { headers: { "Accept": "application/vnd.github+json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.tag_name) return;
      var tag = d.tag_name;
      if (!isNewer(parseVer(tag), local)) return;
      show(tag, d.html_url ||
        "https://github.com/SiqYin/hanuyghur-translate/releases/latest");
    })
    .catch(function () { /* 网络不可用：静默 */ });
})();
