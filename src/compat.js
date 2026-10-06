(function () {
  "use strict";
  var startupFinished = false;
  var moduleLoaded = false;

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
    markModuleLoaded: function () {
      moduleLoaded = true;
    },
    showStartupLoading: function () {
      var app = document.getElementById("app");
      if (!app || startupFinished) return;
      app.innerHTML =
        '<main class="startup-error startup-loading">' +
          '<section><strong>Flowline을 준비하고 있습니다.</strong>' +
          '<p>저장된 Workflow 상태를 불러오는 중입니다. 폐쇄망 환경에서는 처음 시작할 때 잠시 걸릴 수 있습니다.</p>' +
          '<p class="startup-help">계속 표시되면 <b>http://127.0.0.1:5050/api/state</b>를 열어 상태 응답을 확인해 주세요.</p>' +
          '</section>' +
        '</main>';
    },
    markStartupComplete: function () {
      startupFinished = true;
    },
    showStartupError: function (error) {
      var app = document.getElementById("app");
      if (!app) return;
      startupFinished = true;
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
    if (!startupFinished) {
      window.FlowlineCompatibility.showStartupError(event.error || event.message);
    }
  });

  window.addEventListener("unhandledrejection", function (event) {
    if (!startupFinished) {
      window.FlowlineCompatibility.showStartupError(event.reason);
    }
  });

  window.setTimeout(function () {
    if (!moduleLoaded && !startupFinished) {
      window.FlowlineCompatibility.showStartupError(
        "src/app.js 모듈이 실행되지 않았습니다. 서버 실행 폴더에 src 하위 파일이 모두 있는지 확인하고, 브라우저 개발자 도구의 Console 오류를 확인해 주세요."
      );
    }
  }, 15000);
})();
