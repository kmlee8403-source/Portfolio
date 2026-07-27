(function () {
  'use strict';

  if (!window.PORTFOLIO_EDITOR || !window.google || !google.script) return;

  var selectedText = null;
  var selectedItem = null;
  var originalText = '';
  var dirty = false;
  var revisions = [];
  var pageKey = window.PORTFOLIO_PAGE_KEY || 'index';

  function serverCall(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
      var runner = google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(function (error) {
          reject(new Error(error && error.message
            ? error.message
            : '서버 요청을 완료하지 못했습니다.'));
        });
      runner[method].apply(runner, args);
    });
  }

  function createEditorUi() {
    var style = document.createElement('style');
    style.textContent = [
      '[data-portfolio-text-key]{border-radius:4px;transition:outline-color .15s,background .15s;}',
      '[data-portfolio-text-key]:hover{outline:1px dashed rgba(56,189,248,.8);background:rgba(14,165,233,.08);cursor:text;}',
      '[data-portfolio-text-key][contenteditable="true"]{outline:2px solid #38bdf8;background:#0f172a;color:#fff;cursor:text;}',
      '[data-portfolio-selected="true"]{outline:2px solid #f59e0b!important;outline-offset:4px!important;}',
      '[data-portfolio-collection]{position:relative;}',
      '[data-portfolio-collection]:hover{box-shadow:inset 0 0 0 1px rgba(14,165,233,.18);}',
      '#portfolio-editor-ui{position:fixed;right:18px;top:82px;z-index:10000;width:310px;color:#e2e8f0;font-family:SUITE,sans-serif;}',
      '#portfolio-editor-ui *{box-sizing:border-box;}',
      '.pe-panel{background:rgba(2,6,23,.96);border:1px solid #334155;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.5);overflow:hidden;backdrop-filter:blur(16px);}',
      '.pe-head{padding:16px 18px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;}',
      '.pe-title{font-size:15px;font-weight:800;color:white}.pe-sub{font-size:10px;color:#64748b;margin-top:3px;}',
      '.pe-body{padding:14px;display:grid;gap:12px;max-height:calc(100vh - 180px);overflow:auto;}',
      '.pe-group{padding:12px;border:1px solid #1e293b;border-radius:14px;background:#0f172a;}',
      '.pe-label{font-size:10px;font-weight:800;color:#94a3b8;margin-bottom:8px;letter-spacing:.08em;}',
      '.pe-row{display:flex;gap:7px;flex-wrap:wrap;}',
      '.pe-btn{border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;}',
      '.pe-btn:hover{border-color:#38bdf8;color:white}.pe-btn:disabled{opacity:.35;cursor:not-allowed;}',
      '.pe-primary{background:#0284c7;border-color:#0ea5e9;color:white;}',
      '.pe-publish{background:#059669;border-color:#10b981;color:white;}',
      '.pe-danger:hover{border-color:#fb7185;color:#fecdd3;}',
      '.pe-select{width:100%;background:#020617;color:#cbd5e1;border:1px solid #334155;border-radius:10px;padding:9px;font-size:11px;}',
      '.pe-input{width:100%;background:#020617;color:#e2e8f0;border:1px solid #334155;border-radius:9px;padding:8px 9px;font-size:11px;margin-top:6px;resize:vertical;}',
      '.pe-meta-label{display:block;margin-top:7px;font-size:9px;font-weight:700;color:#64748b;}',
      '.pe-status{font-size:10px;line-height:1.5;color:#94a3b8;min-height:15px;}',
      '.pe-status.ok{color:#6ee7b7}.pe-status.error{color:#fda4af}.pe-dirty{color:#fbbf24;font-size:10px;font-weight:800;}',
      '.pe-hint{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;background:rgba(2,6,23,.92);border:1px solid #334155;color:#cbd5e1;border-radius:999px;padding:10px 16px;font-size:11px;box-shadow:0 12px 30px rgba(0,0,0,.35);}',
      '@media(max-width:760px){#portfolio-editor-ui{left:10px;right:10px;top:auto;bottom:10px;width:auto}.pe-body{max-height:45vh}.pe-hint{display:none;}}'
    ].join('');
    document.head.appendChild(style);

    var ui = document.createElement('aside');
    ui.id = 'portfolio-editor-ui';
    ui.setAttribute('data-portfolio-ignore', 'true');
    ui.innerHTML = [
      '<div class="pe-panel">',
      '  <div class="pe-head">',
      '    <div><div class="pe-title">포트폴리오 편집기</div><div class="pe-sub">텍스트를 더블클릭해 바로 수정하세요</div></div>',
      '    <span id="pe-dirty" class="pe-dirty">저장됨</span>',
      '  </div>',
      '  <div class="pe-body">',
      '    <div class="pe-group">',
      '      <div class="pe-label">저장 및 게시</div>',
      '      <div class="pe-row">',
      '        <button id="pe-save" class="pe-btn pe-primary">임시 저장</button>',
      '        <button id="pe-publish" class="pe-btn pe-publish">사이트에 게시</button>',
      '      </div>',
      '    </div>',
      '    <div class="pe-group">',
      '      <div class="pe-label">GEMINI 문구 다듬기</div>',
      '      <select id="pe-ai-style" class="pe-select">',
      '        <option value="전문적이고 신뢰감 있는 포트폴리오 문구로 다듬기">전문적으로</option>',
      '        <option value="핵심 의미를 유지하면서 더 짧고 명확하게 다듬기">간결하게</option>',
      '        <option value="맞춤법과 띄어쓰기만 교정하고 표현은 최대한 유지하기">맞춤법 교정</option>',
      '        <option value="교육 담당자가 이해하기 쉬운 친근하고 자연스러운 문구로 다듬기">친근하게</option>',
      '      </select>',
      '      <div class="pe-row" style="margin-top:8px">',
      '        <button id="pe-ai" class="pe-btn">선택 문구 AI 수정</button>',
      '        <button id="pe-undo-text" class="pe-btn">문구 되돌리기</button>',
      '      </div>',
      '    </div>',
      '    <div class="pe-group">',
      '      <div class="pe-label">선택한 항목</div>',
      '      <div class="pe-row">',
      '        <button id="pe-add" class="pe-btn">+ 새 항목</button>',
      '        <button id="pe-copy" class="pe-btn">복제</button>',
      '        <button id="pe-up" class="pe-btn">위로</button>',
      '        <button id="pe-down" class="pe-btn">아래로</button>',
      '        <button id="pe-delete" class="pe-btn pe-danger">삭제</button>',
      '      </div>',
      '      <div class="pe-row" style="margin-top:8px">',
      '        <button id="pe-section" class="pe-btn">+ 새 자유 섹션</button>',
      '      </div>',
      '    </div>',
      '    <div id="pe-meta-group" class="pe-group" hidden>',
      '      <div class="pe-label">선택 항목의 상세 정보</div>',
      '      <label class="pe-meta-label">교육 대상<input id="pe-meta-target" class="pe-input" data-meta-field="target"></label>',
      '      <label class="pe-meta-label">기관 및 장소<input id="pe-meta-location" class="pe-input" data-meta-field="location"></label>',
      '      <label class="pe-meta-label">기간 및 시간<input id="pe-meta-time" class="pe-input" data-meta-field="time"></label>',
      '      <label class="pe-meta-label">상세 설명<textarea id="pe-meta-description" class="pe-input" rows="4" data-meta-field="description"></textarea></label>',
      '      <label class="pe-meta-label">검색 키워드<textarea id="pe-meta-keywords" class="pe-input" rows="2" data-meta-field="keywords"></textarea></label>',
      '    </div>',
      '    <div class="pe-group">',
      '      <div class="pe-label">이전 게시 버전</div>',
      '      <select id="pe-revisions" class="pe-select"><option value="">버전을 선택하세요</option></select>',
      '      <button id="pe-restore" class="pe-btn" style="margin-top:8px">선택 버전 복원</button>',
      '    </div>',
      '    <div id="pe-status" class="pe-status">편집 데이터를 불러오는 중입니다.</div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(ui);

    var hint = document.createElement('div');
    hint.className = 'pe-hint';
    hint.id = 'pe-hint';
    hint.setAttribute('data-portfolio-ignore', 'true');
    hint.textContent = '문구 더블클릭 · 항목 클릭 후 추가/복제/이동 · 게시 전 임시 저장';
    document.body.appendChild(hint);
  }

  function setStatus(message, type) {
    var status = document.getElementById('pe-status');
    status.textContent = message;
    status.className = 'pe-status' + (type ? ' ' + type : '');
  }

  function setDirty(value) {
    dirty = value;
    var badge = document.getElementById('pe-dirty');
    badge.textContent = value ? '변경됨' : '저장됨';
    badge.style.color = value ? '#fbbf24' : '#6ee7b7';
  }

  function refreshRevisionOptions() {
    var select = document.getElementById('pe-revisions');
    select.innerHTML = '<option value="">버전을 선택하세요</option>';
    revisions.forEach(function (revision) {
      var option = document.createElement('option');
      option.value = revision.id;
      option.textContent = new Date(revision.createdAt).toLocaleString('ko-KR');
      select.appendChild(option);
    });
  }

  function finishTextEditing(element) {
    if (!element) return;
    element.removeAttribute('contenteditable');
    if (element.textContent !== originalText) setDirty(true);
  }

  function directCollectionItem(element, collection) {
    var current = element;
    while (current && current.parentElement !== collection) {
      current = current.parentElement;
    }
    return current && current.parentElement === collection ? current : null;
  }

  function selectElement(element) {
    if (selectedItem) selectedItem.removeAttribute('data-portfolio-selected');
    selectedText = element.closest('[data-portfolio-text-key]');
    var collection = element.closest('[data-portfolio-collection]');
    selectedItem = collection ? directCollectionItem(element, collection) : null;
    if (selectedItem) selectedItem.setAttribute('data-portfolio-selected', 'true');
    updateItemMetaPanel();
  }

  function updateItemMetaPanel() {
    var group = document.getElementById('pe-meta-group');
    if (!group) return;

    var supportsMetadata = selectedItem &&
      (selectedItem.matches('.lecture-card') ||
       selectedItem.matches('.woodwork-card'));
    group.hidden = !supportsMetadata;
    if (!supportsMetadata) return;

    group.querySelectorAll('[data-meta-field]').forEach(function (input) {
      input.value = selectedItem.getAttribute(
        'data-' + input.getAttribute('data-meta-field')
      ) || '';
    });
  }

  function beginTextEditing(element) {
    if (selectedText && selectedText !== element) finishTextEditing(selectedText);
    selectElement(element);
    selectedText = element;
    originalText = element.textContent;
    element.setAttribute('contenteditable', 'true');
    element.focus();

    var range = document.createRange();
    range.selectNodeContents(element);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function cloneSelectedItem(resetText) {
    if (!selectedItem) {
      setStatus('먼저 추가할 목록의 항목을 클릭해 주세요.', 'error');
      return;
    }

    var collection = selectedItem.parentElement;
    var clone = selectedItem.cloneNode(true);
    clone.removeAttribute('data-portfolio-selected');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(function (element) {
      element.removeAttribute('id');
    });
    window.PortfolioContent.ensureUniqueKeys(clone);

    if (resetText) {
      clone.querySelectorAll('[data-portfolio-text-key]').forEach(function (element) {
        element.textContent = '새 항목';
      });
      if (clone.matches('.lecture-card')) {
        clone.setAttribute('data-id', String(Date.now()));
        clone.setAttribute('data-target', '교육 대상');
        clone.setAttribute('data-location', '기관 및 장소');
        clone.setAttribute('data-time', '교육 시간');
        clone.setAttribute('data-description', '새 강의의 상세 설명을 입력하세요.');
      }
    }

    collection.insertBefore(clone, selectedItem.nextSibling);
    selectedItem.removeAttribute('data-portfolio-selected');
    selectedItem = clone;
    selectedItem.setAttribute('data-portfolio-selected', 'true');
    updateItemMetaPanel();
    setDirty(true);
    setStatus(resetText ? '새 항목을 추가했습니다.' : '항목을 복제했습니다.', 'ok');
  }

  function deleteSelectedItem() {
    if (!selectedItem) {
      setStatus('삭제할 항목을 먼저 클릭해 주세요.', 'error');
      return;
    }
    var next = selectedItem.nextElementSibling || selectedItem.previousElementSibling;
    selectedItem.remove();
    selectedItem = next;
    if (selectedItem) selectedItem.setAttribute('data-portfolio-selected', 'true');
    updateItemMetaPanel();
    setDirty(true);
    setStatus('항목을 삭제했습니다. 게시 전까지는 임시 변경입니다.', 'ok');
  }

  function moveSelectedItem(direction) {
    if (!selectedItem) {
      setStatus('이동할 항목을 먼저 클릭해 주세요.', 'error');
      return;
    }
    var sibling = direction < 0
      ? selectedItem.previousElementSibling
      : selectedItem.nextElementSibling;
    if (!sibling) return;
    if (direction < 0) {
      selectedItem.parentElement.insertBefore(selectedItem, sibling);
    } else {
      selectedItem.parentElement.insertBefore(sibling, selectedItem);
    }
    setDirty(true);
    setStatus('항목 순서를 변경했습니다.', 'ok');
  }

  function addCustomSection() {
    var collection = document.querySelector(
      '[data-portfolio-collection="custom-sections"]'
    );
    if (!collection) {
      setStatus('새 섹션을 넣을 위치를 찾지 못했습니다.', 'error');
      return;
    }

    var section = document.createElement('section');
    section.className = 'py-20 bg-darkbg-900/30 border-y border-slate-900';
    section.innerHTML = [
      '<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">',
      '  <div class="max-w-3xl">',
      '    <h2 class="text-3xl sm:text-4xl font-bold text-white">새 섹션 제목</h2>',
      '    <p class="mt-5 text-base leading-relaxed text-slate-400">새로운 소개 문구를 입력하세요.</p>',
      '  </div>',
      '</div>'
    ].join('');
    window.PortfolioContent.wrapTextNodes(section);
    window.PortfolioContent.ensureUniqueKeys(section);
    collection.appendChild(section);
    selectedItem = section;
    selectedItem.setAttribute('data-portfolio-selected', 'true');
    updateItemMetaPanel();
    setDirty(true);
    setStatus('새 자유 섹션을 추가했습니다.', 'ok');
  }

  function saveDraft() {
    setStatus('임시 저장 중입니다.');
    return serverCall('savePortfolioDraft', {
      page: pageKey,
      content: window.PortfolioContent.captureState()
    }).then(function (result) {
      setDirty(false);
      setStatus('임시 저장 완료 · ' + new Date(result.savedAt).toLocaleString('ko-KR'), 'ok');
    }).catch(function (error) {
      setStatus(error.message, 'error');
    });
  }

  function publish() {
    setStatus('사이트에 게시 중입니다.');
    return serverCall('publishPortfolioContent', {
      page: pageKey,
      content: window.PortfolioContent.captureState()
    }).then(function (result) {
      revisions = result.revisions || [];
      refreshRevisionOptions();
      setDirty(false);
      setStatus('게시 완료 · 방문자 화면에 곧 반영됩니다.', 'ok');
    }).catch(function (error) {
      setStatus(error.message, 'error');
    });
  }

  function improveSelectedText() {
    if (!selectedText) {
      setStatus('AI로 다듬을 문구를 먼저 클릭해 주세요.', 'error');
      return;
    }
    finishTextEditing(selectedText);
    var instruction = document.getElementById('pe-ai-style').value;
    var context = selectedText.parentElement
      ? selectedText.parentElement.innerText.slice(0, 1200)
      : '';
    var button = document.getElementById('pe-ai');
    button.disabled = true;
    setStatus('Gemini가 문구를 다듬고 있습니다.');

    serverCall('improvePortfolioText', {
      text: selectedText.textContent,
      instruction: instruction,
      context: context
    }).then(function (result) {
      selectedText.textContent = result.text;
      setDirty(true);
      setStatus('Gemini 수정안을 적용했습니다. 게시 전에 확인해 주세요.', 'ok');
    }).catch(function (error) {
      setStatus(error.message, 'error');
    }).finally(function () {
      button.disabled = false;
    });
  }

  function restoreRevision() {
    var select = document.getElementById('pe-revisions');
    if (!select.value) {
      setStatus('복원할 버전을 선택해 주세요.', 'error');
      return;
    }
    setStatus('선택한 버전을 복원하고 있습니다.');
    serverCall('restorePortfolioRevision', select.value, pageKey)
      .then(function (result) {
        window.PortfolioContent.applyState(result.content || {});
        revisions = result.revisions || revisions;
        setDirty(false);
        setStatus('이전 버전을 복원했습니다.', 'ok');
      })
      .catch(function (error) {
        setStatus(error.message, 'error');
      });
  }

  function bindEditorEvents() {
    document.addEventListener('click', function (event) {
      if (event.target.closest('#portfolio-editor-ui')) return;
      var editable = event.target.closest('[data-portfolio-text-key]');
      if (editable) selectElement(editable);
    }, true);

    document.addEventListener('dblclick', function (event) {
      if (event.target.closest('#portfolio-editor-ui')) return;
      var editable = event.target.closest('[data-portfolio-text-key]');
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();
      beginTextEditing(editable);
    }, true);

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a');
      if (link && !event.target.closest('#portfolio-editor-ui')) {
        event.preventDefault();
      }
    }, true);

    document.addEventListener('focusout', function (event) {
      if (event.target.matches('[data-portfolio-text-key][contenteditable="true"]')) {
        finishTextEditing(event.target);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!event.target.matches('[data-portfolio-text-key][contenteditable="true"]')) return;
      if (event.key === 'Escape') {
        event.target.textContent = originalText;
        finishTextEditing(event.target);
        event.target.blur();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        finishTextEditing(event.target);
        event.target.blur();
      }
    });

    document.getElementById('pe-save').addEventListener('click', saveDraft);
    document.getElementById('pe-publish').addEventListener('click', publish);
    document.getElementById('pe-ai').addEventListener('click', improveSelectedText);
    document.getElementById('pe-undo-text').addEventListener('click', function () {
      if (!selectedText) return;
      selectedText.textContent = originalText;
      setDirty(true);
      setStatus('선택 문구를 편집 전 상태로 되돌렸습니다.', 'ok');
    });
    document.getElementById('pe-add').addEventListener('click', function () {
      cloneSelectedItem(true);
    });
    document.getElementById('pe-copy').addEventListener('click', function () {
      cloneSelectedItem(false);
    });
    document.getElementById('pe-delete').addEventListener('click', deleteSelectedItem);
    document.getElementById('pe-up').addEventListener('click', function () {
      moveSelectedItem(-1);
    });
    document.getElementById('pe-down').addEventListener('click', function () {
      moveSelectedItem(1);
    });
    document.getElementById('pe-section').addEventListener('click', addCustomSection);
    document.getElementById('pe-restore').addEventListener('click', restoreRevision);
    document.getElementById('pe-meta-group').addEventListener('input', function (event) {
      var field = event.target.getAttribute('data-meta-field');
      if (!field || !selectedItem) return;
      selectedItem.setAttribute('data-' + field, event.target.value);
      setDirty(true);
    });

    window.addEventListener('beforeunload', function (event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  createEditorUi();
  bindEditorEvents();

  serverCall('getPortfolioEditorBootstrap', pageKey)
    .then(function (result) {
      window.PortfolioContent.applyState(result.content || {});
      revisions = result.revisions || [];
      refreshRevisionOptions();
      setDirty(false);
      setStatus(
        result.isDraft
          ? '저장된 임시 편집본을 불러왔습니다.'
          : '현재 게시된 내용을 불러왔습니다.',
        'ok'
      );
    })
    .catch(function (error) {
      setStatus(error.message, 'error');
    });
})();
