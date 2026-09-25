(function () {
  "use strict";

  if (typeof window.structuredClone !== "function") {
    window.structuredClone = function (value) {
      if (value === undefined) return undefined;
      return JSON.parse(JSON.stringify(value));
    };
  }

  if (typeof String.prototype.replaceAll !== "function") {
    Object.defineProperty(String.prototype, "replaceAll", {
      configurable: true,
      writable: true,
      value: function (search, replacement) {
        if (search instanceof RegExp) {
          if (!search.global) throw new TypeError("replaceAll 정규식에는 global 플래그가 필요합니다.");
          return this.replace(search, replacement);
        }
        return this.split(String(search)).join(String(replacement));
      }
    });
  }

  if (typeof Array.prototype.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      configurable: true,
      writable: true,
      value: function (index) {
        var normalized = Number(index) || 0;
        if (normalized < 0) normalized += this.length;
        return this[normalized];
      }
    });
  }

  window.FlowlineCompatibility = {
    showStartupError: function (error) {
      var app = document.getElementById("app");
      if (!app) return;
      var message = error && error.message ? error.message : String(error || "알 수 없는 오류");
      app.innerHTML =
        '<main class="startup-error">' +
          '<section><strong>Flowline을 시작하지 못했습니다.</strong>' +
          '<p>브라우저가 너무 오래되었거나 정적 파일/API를 불러오지 못했습니다.</p>' +
          '<code></code>' +
          '<p class="startup-help">주소창에서 <b>http://127.0.0.1:5050/api/health</b>를 열어 상태를 확인해 주세요.</p>' +
          '</section>' +
        '</main>';
      app.querySelector("code").textContent = message;
    }
  };

  window.addEventListener("error", function (event) {
    if (!document.querySelector("#app > *")) {
      window.FlowlineCompatibility.showStartupError(event.error || event.message);
    }
  });

  window.addEventListener("unhandledrejection", function (event) {
    if (!document.querySelector("#app > *")) {
      window.FlowlineCompatibility.showStartupError(event.reason);
    }
  });

  window.setTimeout(function () {
    if (!document.querySelector("#app > *")) {
      window.FlowlineCompatibility.showStartupError("화면 모듈이 실행되지 않았습니다. Edge/Chrome 일반 모드에서 접속해 주세요.");
    }
  }, 5000);
})();
