(function () {
  'use strict';

  var DEFAULT_API_URL =
    'https://script.google.com/macros/s/AKfycbxWEja_FmFJUHUKmKXWkffFzfufs8wZyC2bh4UobGlZalkDkMtJCNIqxWJMDRW9btjh2w/exec';
  var pageKey = window.PORTFOLIO_PAGE_KEY ||
    (location.pathname.toLowerCase().indexOf('woodwork') !== -1 ? 'woodwork' : 'index');
  var ignoredSelector = [
    'script',
    'style',
    'noscript',
    'textarea',
    'input',
    'select',
    'option',
    '[data-portfolio-ignore]',
    '#lecture-modal',
    '#woodwork-modal',
    '#detail-modal',
    '#toast-notification',
    '#analysis-result',
    '#analyzer-loader',
    '#placeholder-result'
  ].join(',');
  var state = {};
  var nextKey = 0;

  function shouldWrapTextNode(node) {
    if (!node || !node.parentElement || !node.nodeValue.trim()) return false;
    if (node.parentElement.closest(ignoredSelector)) return false;
    if (node.parentElement.closest('[data-portfolio-text-key]')) return false;
    if (node.parentElement.closest('#portfolio-editor-ui')) return false;
    return true;
  }

  function wrapTextNodes(root) {
    var scope = root || document.body;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;

    while ((node = walker.nextNode())) {
      if (shouldWrapTextNode(node)) nodes.push(node);
    }

    nodes.forEach(function (textNode) {
      var span = document.createElement('span');
      span.setAttribute(
        'data-portfolio-text-key',
        pageKey + ':text:' + String(nextKey++)
      );
      span.textContent = textNode.nodeValue;
      textNode.parentNode.replaceChild(span, textNode);
    });
  }

  function ensureUniqueKeys(root) {
    var stamp = Date.now().toString(36);
    Array.prototype.forEach.call(
      root.querySelectorAll('[data-portfolio-text-key]'),
      function (element, index) {
        element.setAttribute(
          'data-portfolio-text-key',
          pageKey + ':custom:' + stamp + ':' + index
        );
      }
    );
  }

  function cleanEditorArtifacts(root) {
    Array.prototype.forEach.call(
      root.querySelectorAll([
        '[contenteditable]',
        '[data-portfolio-selected]',
        '[data-portfolio-text-selected]',
        '[data-portfolio-edit-group]',
        '[data-portfolio-edit-group-root]'
      ].join(',')),
      function (element) {
        element.removeAttribute('contenteditable');
        element.removeAttribute('data-portfolio-selected');
        element.removeAttribute('data-portfolio-text-selected');
        element.removeAttribute('data-portfolio-edit-group');
        element.removeAttribute('data-portfolio-edit-group-root');
      }
    );
  }

  function applyState(nextState) {
    state = nextState && typeof nextState === 'object' ? nextState : {};

    if (state.collections) {
      Object.keys(state.collections).forEach(function (collectionId) {
        var collection = document.querySelector(
          '[data-portfolio-collection="' + CSS.escape(collectionId) + '"]'
        );
        if (collection && typeof state.collections[collectionId] === 'string') {
          collection.innerHTML = state.collections[collectionId];
        }
      });
    }

    wrapTextNodes(document.body);

    if (state.texts) {
      Object.keys(state.texts).forEach(function (textKey) {
        var element = document.querySelector(
          '[data-portfolio-text-key="' + CSS.escape(textKey) + '"]'
        );
        if (element && typeof state.texts[textKey] === 'string') {
          element.textContent = state.texts[textKey];
        }
      });
    }

    document.documentElement.classList.add('portfolio-content-ready');
    window.dispatchEvent(new CustomEvent('portfolio-content-applied', {
      detail: { page: pageKey }
    }));
  }

  function captureState() {
    var texts = {};
    var collections = {};

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-portfolio-text-key]'),
      function (element) {
        if (element.closest('#portfolio-editor-ui')) return;
        texts[element.getAttribute('data-portfolio-text-key')] =
          element.textContent;
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-portfolio-collection]'),
      function (collection) {
        var clone = collection.cloneNode(true);
        cleanEditorArtifacts(clone);
        collections[collection.getAttribute('data-portfolio-collection')] =
          clone.innerHTML;
      }
    );

    return {
      version: 1,
      texts: texts,
      collections: collections
    };
  }

  function loadPublishedState() {
    if (window.PORTFOLIO_EDITOR) return Promise.resolve({});

    var controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    var timer = controller
      ? window.setTimeout(function () { controller.abort(); }, 4500)
      : null;
    var url = (window.PORTFOLIO_API_URL || DEFAULT_API_URL) +
      '?action=content&page=' + encodeURIComponent(pageKey) +
      '&v=' + Date.now();

    return fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) throw new Error('콘텐츠 응답 오류');
        return response.json();
      })
      .then(function (result) {
        applyState(result && result.success ? result.content : {});
        return result;
      })
      .catch(function (error) {
        console.warn('게시된 편집 콘텐츠를 불러오지 못해 기본 내용을 표시합니다.', error);
        applyState({});
        return {};
      })
      .finally(function () {
        if (timer) window.clearTimeout(timer);
      });
  }

  wrapTextNodes(document.body);

  window.PortfolioContent = {
    pageKey: pageKey,
    applyState: applyState,
    captureState: captureState,
    ensureUniqueKeys: ensureUniqueKeys,
    wrapTextNodes: wrapTextNodes,
    getState: function () { return state; },
    ready: loadPublishedState()
  };
})();
