(function () {
  'use strict';

  if (!window.PORTFOLIO_EDITOR || !window.google || !google.script) return;

  var selectedText = null;
  var selectedTextRoot = null;
  var selectedGroupId = '';
  var selectedItem = null;
  var originalText = '';
  var originalPrefix = '';
  var originalSuffix = '';
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
      '[data-portfolio-edit-group-root]{border-radius:5px;transition:outline-color .15s,background .15s;cursor:pointer;}',
      '[data-portfolio-edit-group-root]:hover{outline:2px dashed rgba(56,189,248,.82);outline-offset:3px;background:rgba(14,165,233,.1);}',
      '[data-portfolio-edit-group-root][data-portfolio-text-selected="true"]{outline:2px solid #38bdf8;outline-offset:3px;background:rgba(14,165,233,.12);}',
      '[data-portfolio-selected="true"]{outline:3px solid #f59e0b!important;outline-offset:5px!important;}',
      '[data-portfolio-collection]{position:relative;}',
      '[data-portfolio-collection]:hover{box-shadow:inset 0 0 0 1px rgba(14,165,233,.18);}',
      '#portfolio-editor-ui{position:fixed;right:20px;top:82px;z-index:10000;width:400px;color:#e2e8f0;font-family:SUITE,sans-serif;}',
      '#portfolio-editor-ui *,.pe-text-modal *{box-sizing:border-box;}',
      '#portfolio-editor-ui.pe-collapsed{width:62px;}',
      '#portfolio-editor-ui.pe-collapsed .pe-head-copy,#portfolio-editor-ui.pe-collapsed .pe-dirty,#portfolio-editor-ui.pe-collapsed .pe-body{display:none;}',
      '#portfolio-editor-ui.pe-collapsed .pe-head{justify-content:center;padding:12px;}',
      '.pe-panel{background:rgba(2,6,23,.97);border:1px solid #334155;border-radius:22px;box-shadow:0 28px 80px rgba(0,0,0,.58);overflow:hidden;backdrop-filter:blur(18px);}',
      '.pe-head{padding:18px 20px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:12px;}',
      '.pe-head-copy{min-width:0;flex:1}.pe-title{font-size:17px;font-weight:900;color:white}.pe-sub{font-size:11px;color:#94a3b8;margin-top:4px;}',
      '.pe-head-actions{display:flex;align-items:center;gap:9px}.pe-collapse{width:34px;height:34px;padding:0!important;font-size:16px!important;}',
      '.pe-body{padding:16px;display:grid;gap:14px;max-height:calc(100vh - 190px);overflow:auto;}',
      '.pe-guide{padding:13px 14px;border-radius:14px;background:linear-gradient(135deg,rgba(14,165,233,.15),rgba(37,99,235,.08));border:1px solid rgba(56,189,248,.28);font-size:11px;line-height:1.7;color:#bae6fd;}',
      '.pe-group{padding:15px;border:1px solid #1e293b;border-radius:16px;background:#0f172a;}',
      '.pe-label{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:900;color:#cbd5e1;margin-bottom:11px;letter-spacing:.04em;}',
      '.pe-step{display:inline-grid;place-items:center;width:21px;height:21px;border-radius:7px;background:#1e40af;color:#dbeafe;font-size:10px;}',
      '.pe-selection{padding:12px;border-radius:12px;background:#020617;border:1px solid #334155;margin-bottom:10px;}',
      '.pe-selection-title{font-size:10px;color:#64748b;margin-bottom:5px}.pe-selection-copy{font-size:12px;line-height:1.5;color:#e2e8f0;word-break:break-word;}',
      '.pe-row{display:flex;gap:8px;flex-wrap:wrap;}',
      '.pe-btn{border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:11px;padding:10px 12px;font-size:11px;font-weight:800;cursor:pointer;transition:.15s;}',
      '.pe-btn:hover{border-color:#38bdf8;color:white;transform:translateY(-1px)}.pe-btn:disabled{opacity:.35;cursor:not-allowed;transform:none;}',
      '.pe-btn-wide{flex:1;min-width:120px}.pe-primary{background:#0369a1;border-color:#0ea5e9;color:white;}',
      '.pe-publish{background:#047857;border-color:#10b981;color:white;}.pe-danger:hover{border-color:#fb7185;color:#fecdd3;}',
      '.pe-select{width:100%;background:#020617;color:#e2e8f0;border:1px solid #334155;border-radius:11px;padding:11px;font-size:12px;}',
      '.pe-input{width:100%;background:#020617;color:#f1f5f9;border:1px solid #334155;border-radius:11px;padding:10px 11px;font-size:12px;line-height:1.55;margin-top:6px;resize:vertical;}',
      '.pe-input:focus,.pe-select:focus{outline:2px solid rgba(56,189,248,.55);border-color:#38bdf8;}',
      '.pe-meta-label{display:block;margin-top:10px;font-size:10px;font-weight:800;color:#94a3b8;}',
      '.pe-status{position:sticky;bottom:-16px;margin:-2px -16px -16px;padding:13px 16px;background:rgba(2,6,23,.97);border-top:1px solid #1e293b;font-size:11px;line-height:1.5;color:#94a3b8;min-height:42px;}',
      '.pe-status.ok{color:#6ee7b7}.pe-status.error{color:#fda4af}.pe-dirty{color:#6ee7b7;font-size:10px;font-weight:900;white-space:nowrap;}',
      '.pe-hint{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;background:rgba(2,6,23,.94);border:1px solid #334155;color:#cbd5e1;border-radius:999px;padding:11px 18px;font-size:11px;box-shadow:0 12px 30px rgba(0,0,0,.35);}',
      '.pe-text-modal[hidden]{display:none!important}.pe-text-modal{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:24px;background:rgba(2,6,23,.78);backdrop-filter:blur(8px);font-family:SUITE,sans-serif;color:#e2e8f0;}',
      '.pe-modal-card{width:min(820px,100%);max-height:calc(100vh - 48px);overflow:auto;background:#0b1120;border:1px solid #475569;border-radius:24px;box-shadow:0 35px 100px rgba(0,0,0,.7);}',
      '.pe-modal-head{padding:22px 24px 18px;border-bottom:1px solid #1e293b;display:flex;align-items:flex-start;gap:16px;}',
      '.pe-modal-head-copy{flex:1}.pe-modal-kicker{font-size:10px;font-weight:900;color:#38bdf8;letter-spacing:.12em}.pe-modal-title{margin:5px 0 0;font-size:22px;font-weight:900;color:white;}',
      '.pe-modal-help{margin:6px 0 0;font-size:12px;color:#94a3b8;line-height:1.5}.pe-modal-close{width:38px;height:38px;padding:0!important;font-size:18px!important;}',
      '.pe-modal-body{padding:22px 24px;display:grid;gap:17px}.pe-field-label{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:11px;font-weight:800;color:#cbd5e1;}',
      '.pe-original{padding:13px 14px;border:1px solid #1e293b;border-radius:12px;background:#020617;color:#94a3b8;font-size:12px;line-height:1.65;max-height:110px;overflow:auto;white-space:pre-wrap;}',
      '.pe-textarea{width:100%;min-height:230px;padding:16px;background:#020617;border:1px solid #475569;border-radius:14px;color:#f8fafc;font:500 15px/1.75 SUITE,sans-serif;resize:vertical;}',
      '.pe-textarea:focus{outline:3px solid rgba(56,189,248,.28);border-color:#38bdf8;}',
      '.pe-ai-box{padding:15px;border:1px solid rgba(99,102,241,.35);border-radius:14px;background:rgba(49,46,129,.12);}',
      '.pe-ai-grid{display:grid;grid-template-columns:1fr auto;gap:10px}.pe-ai-status{margin-top:8px;min-height:16px;font-size:10px;color:#a5b4fc;}',
      '.pe-modal-actions{padding:17px 24px;border-top:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#080e1b;}',
      '.pe-shortcut{font-size:10px;color:#64748b}.pe-actions-right{display:flex;gap:9px;}',
      '@media(max-width:900px){#portfolio-editor-ui{right:12px;width:360px}.pe-hint{display:none;}}',
      '@media(max-width:680px){#portfolio-editor-ui{left:8px;right:8px;top:auto;bottom:8px;width:auto}#portfolio-editor-ui.pe-collapsed{left:auto;width:62px}.pe-body{max-height:56vh}.pe-text-modal{padding:8px}.pe-modal-card{max-height:calc(100vh - 16px);border-radius:18px}.pe-modal-head,.pe-modal-body,.pe-modal-actions{padding-left:16px;padding-right:16px}.pe-ai-grid{grid-template-columns:1fr}.pe-modal-actions{align-items:stretch;flex-direction:column}.pe-actions-right{display:grid;grid-template-columns:1fr 1fr}.pe-shortcut{text-align:center;}}'
    ].join('');
    document.head.appendChild(style);

    var ui = document.createElement('aside');
    ui.id = 'portfolio-editor-ui';
    ui.setAttribute('data-portfolio-ignore', 'true');
    ui.innerHTML = [
      '<div class="pe-panel">',
      '  <div class="pe-head">',
      '    <div class="pe-head-copy"><div class="pe-title">포트폴리오 편집 모드</div><div class="pe-sub">문구를 더블클릭하면 큰 편집창이 열립니다</div></div>',
      '    <div class="pe-head-actions"><span id="pe-dirty" class="pe-dirty">저장됨</span><button id="pe-collapse" class="pe-btn pe-collapse" title="패널 접기" aria-label="패널 접기">›</button></div>',
      '  </div>',
      '  <div class="pe-body">',
      '    <div class="pe-guide"><strong>빠른 사용법</strong><br>① 문구 더블클릭 → 편집창에서 수정<br>② 목록 카드를 클릭 → 항목 관리<br>③ 확인 후 임시 저장 또는 게시</div>',
      '    <div class="pe-group">',
      '      <div class="pe-label"><span class="pe-step">1</span>문구 편집</div>',
      '      <div class="pe-selection"><div class="pe-selection-title">현재 선택한 문구</div><div id="pe-selection-copy" class="pe-selection-copy">문구를 클릭하거나 더블클릭해 주세요.</div></div>',
      '      <button id="pe-open-text" class="pe-btn pe-primary pe-btn-wide" disabled>큰 편집창 열기</button>',
      '    </div>',
      '    <div class="pe-group">',
      '      <div class="pe-label"><span class="pe-step">2</span>선택한 목록 항목 관리</div>',
      '      <div id="pe-item-state" class="pe-selection-copy" style="margin-bottom:10px;color:#94a3b8">목록 카드를 클릭하면 관리할 수 있습니다.</div>',
      '      <div class="pe-row">',
      '        <button id="pe-add" class="pe-btn" disabled>+ 새 항목</button>',
      '        <button id="pe-copy" class="pe-btn" disabled>복제</button>',
      '        <button id="pe-up" class="pe-btn" disabled>위로</button>',
      '        <button id="pe-down" class="pe-btn" disabled>아래로</button>',
      '        <button id="pe-delete" class="pe-btn pe-danger" disabled>삭제</button>',
      '      </div>',
      '      <div class="pe-row" style="margin-top:9px"><button id="pe-section" class="pe-btn pe-btn-wide">+ 새 자유 섹션</button></div>',
      '    </div>',
      '    <div id="pe-meta-group" class="pe-group" hidden>',
      '      <div class="pe-label">선택 항목의 상세 정보</div>',
      '      <label class="pe-meta-label">교육 대상<input id="pe-meta-target" class="pe-input" data-meta-field="target"></label>',
      '      <label class="pe-meta-label">기관 및 장소<input id="pe-meta-location" class="pe-input" data-meta-field="location"></label>',
      '      <label class="pe-meta-label">기간 및 시간<input id="pe-meta-time" class="pe-input" data-meta-field="time"></label>',
      '      <label class="pe-meta-label">상세 설명<textarea id="pe-meta-description" class="pe-input" rows="5" data-meta-field="description"></textarea></label>',
      '      <label class="pe-meta-label">검색 키워드<textarea id="pe-meta-keywords" class="pe-input" rows="3" data-meta-field="keywords"></textarea></label>',
      '    </div>',
      '    <div class="pe-group">',
      '      <div class="pe-label"><span class="pe-step">3</span>저장 및 공개</div>',
      '      <div class="pe-row">',
      '        <button id="pe-save" class="pe-btn pe-primary pe-btn-wide">임시 저장</button>',
      '        <button id="pe-publish" class="pe-btn pe-publish pe-btn-wide">사이트에 게시</button>',
      '      </div>',
      '    </div>',
      '    <div class="pe-group">',
      '      <div class="pe-label"><span class="pe-step">4</span>이전 게시 버전</div>',
      '      <select id="pe-revisions" class="pe-select"><option value="">버전을 선택하세요</option></select>',
      '      <button id="pe-restore" class="pe-btn pe-btn-wide" style="margin-top:9px">선택 버전 복원</button>',
      '    </div>',
      '    <div id="pe-status" class="pe-status">편집 데이터를 불러오는 중입니다.</div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(ui);

    var modal = document.createElement('div');
    modal.id = 'pe-text-modal';
    modal.className = 'pe-text-modal';
    modal.hidden = true;
    modal.setAttribute('data-portfolio-ignore', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pe-modal-title');
    modal.innerHTML = [
      '<div class="pe-modal-card">',
      '  <div class="pe-modal-head">',
      '    <div class="pe-modal-head-copy"><div class="pe-modal-kicker">TEXT EDITOR</div><h2 id="pe-modal-title" class="pe-modal-title">문구 편집</h2><p class="pe-modal-help">수정문을 충분히 검토한 뒤 적용하세요. 적용 후에도 게시 전까지는 방문자에게 보이지 않습니다.</p></div>',
      '    <button id="pe-modal-close" class="pe-btn pe-modal-close" aria-label="편집창 닫기">×</button>',
      '  </div>',
      '  <div class="pe-modal-body">',
      '    <div><div class="pe-field-label"><span>원문</span></div><div id="pe-text-original" class="pe-original"></div></div>',
      '    <div><div class="pe-field-label"><span>수정문</span><span id="pe-char-count">0자</span></div><textarea id="pe-text-draft" class="pe-textarea" aria-label="수정할 문구"></textarea></div>',
      '    <div class="pe-ai-box">',
      '      <div class="pe-field-label"><span>Gemini 문구 다듬기</span><span>결과는 수정문 칸에만 반영됩니다</span></div>',
      '      <div class="pe-ai-grid">',
      '        <select id="pe-ai-style" class="pe-select">',
      '          <option value="전문적이고 신뢰감 있는 포트폴리오 문구로 다듬기">전문적이고 신뢰감 있게</option>',
      '          <option value="핵심 의미를 유지하면서 더 짧고 명확하게 다듬기">짧고 명확하게</option>',
      '          <option value="맞춤법과 띄어쓰기만 교정하고 표현은 최대한 유지하기">맞춤법과 띄어쓰기만 교정</option>',
      '          <option value="교육 담당자가 이해하기 쉬운 친근하고 자연스러운 문구로 다듬기">친근하고 자연스럽게</option>',
      '        </select>',
      '        <button id="pe-ai" class="pe-btn">Gemini로 수정안 만들기</button>',
      '      </div>',
      '      <div id="pe-ai-status" class="pe-ai-status"></div>',
      '    </div>',
      '  </div>',
      '  <div class="pe-modal-actions">',
      '    <span class="pe-shortcut">Esc 취소 · Ctrl/⌘ + Enter 적용</span>',
      '    <div class="pe-actions-right"><button id="pe-reset-text" class="pe-btn">원문으로 되돌리기</button><button id="pe-cancel-text" class="pe-btn">취소</button><button id="pe-apply-text" class="pe-btn pe-primary">이 문구 적용</button></div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var hint = document.createElement('div');
    hint.className = 'pe-hint';
    hint.id = 'pe-hint';
    hint.setAttribute('data-portfolio-ignore', 'true');
    hint.textContent = '문구 더블클릭 → 큰 편집창 · 목록 클릭 → 항목 관리';
    document.body.appendChild(hint);
  }

  function setStatus(message, type) {
    var status = document.getElementById('pe-status');
    status.textContent = message;
    status.className = 'pe-status' + (type ? ' ' + type : '');
  }

  function setModalStatus(message, type) {
    var status = document.getElementById('pe-ai-status');
    status.textContent = message || '';
    status.style.color = type === 'error' ? '#fda4af' : '#a5b4fc';
  }

  function setDirty(value) {
    dirty = value;
    var badge = document.getElementById('pe-dirty');
    badge.textContent = value ? '변경됨 · 저장 필요' : '저장됨';
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

  function getLogicalTextRoot(textElement) {
    var current = textElement.parentElement;
    var semanticSelector = [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li',
      'button',
      'label',
      'dt',
      'dd',
      'figcaption'
    ].join(',');

    while (current && current !== document.body) {
      if (current.matches(semanticSelector)) return current;
      if (current.matches('span.block')) return current;
      if (current.matches('a')) return current;
      if (current.hasAttribute('data-portfolio-collection')) break;
      current = current.parentElement;
    }
    return textElement;
  }

  function prepareEditGroups() {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-portfolio-edit-group]'),
      function (element) {
        element.removeAttribute('data-portfolio-edit-group');
      }
    );
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-portfolio-edit-group-root]'),
      function (element) {
        element.removeAttribute('data-portfolio-edit-group-root');
        element.removeAttribute('data-portfolio-text-selected');
      }
    );

    var groups = [];
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-portfolio-text-key]'),
      function (textElement) {
        if (textElement.closest('#portfolio-editor-ui,#pe-text-modal')) return;
        var root = getLogicalTextRoot(textElement);
        var group = groups.find(function (candidate) {
          return candidate.root === root;
        });
        if (!group) {
          group = {
            root: root,
            id: pageKey + ':group:' + groups.length
          };
          groups.push(group);
          root.setAttribute('data-portfolio-edit-group-root', group.id);
        }
        textElement.setAttribute('data-portfolio-edit-group', group.id);
      }
    );

    selectedText = null;
    selectedTextRoot = null;
    selectedGroupId = '';
    selectedItem = null;
    refreshSelectionUi();
    updateItemMetaPanel();
  }

  function getSelectedTextElements() {
    if (!selectedGroupId) return [];
    return Array.prototype.slice.call(
      document.querySelectorAll(
        '[data-portfolio-edit-group="' + CSS.escape(selectedGroupId) + '"]'
      )
    );
  }

  function getSelectedGroupText() {
    return getSelectedTextElements().map(function (element) {
      return element.textContent;
    }).join('');
  }

  function getBestGroupAnchor(elements) {
    var best = elements[0] || null;
    var bestScore = -Infinity;
    elements.forEach(function (element) {
      var score = element.textContent.trim().length;
      if (element.closest('strong,b,em')) score -= 10000;
      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    });
    return best;
  }

  function directCollectionItem(element, collection) {
    var current = element;
    while (current && current.parentElement !== collection) {
      current = current.parentElement;
    }
    return current && current.parentElement === collection ? current : null;
  }

  function getItemName(item) {
    if (!item) return '';
    var heading = item.querySelector('h1,h2,h3,h4,strong,[data-portfolio-text-key]');
    var name = heading ? heading.textContent.trim() : '';
    return name ? name.slice(0, 55) : '선택한 목록 항목';
  }

  function refreshSelectionUi() {
    var copy = document.getElementById('pe-selection-copy');
    var openButton = document.getElementById('pe-open-text');
    var itemState = document.getElementById('pe-item-state');
    var itemButtons = ['pe-add', 'pe-copy', 'pe-up', 'pe-down', 'pe-delete'];

    if (selectedGroupId) {
      var preview = getSelectedGroupText().trim().replace(/\s+/g, ' ');
      copy.textContent = preview ? preview.slice(0, 120) : '(빈 문구)';
      openButton.disabled = false;
    } else {
      copy.textContent = '문구를 클릭하거나 더블클릭해 주세요.';
      openButton.disabled = true;
    }

    itemState.textContent = selectedItem
      ? '선택됨: ' + getItemName(selectedItem)
      : '목록 카드를 클릭하면 관리할 수 있습니다.';
    itemButtons.forEach(function (id) {
      document.getElementById(id).disabled = !selectedItem;
    });
  }

  function selectElement(element) {
    if (selectedTextRoot) {
      selectedTextRoot.removeAttribute('data-portfolio-text-selected');
    }
    if (selectedItem) {
      selectedItem.removeAttribute('data-portfolio-selected');
    }

    selectedText = element.closest('[data-portfolio-text-key]');
    selectedGroupId = selectedText
      ? selectedText.getAttribute('data-portfolio-edit-group') || ''
      : '';
    selectedTextRoot = selectedGroupId
      ? document.querySelector(
        '[data-portfolio-edit-group-root="' + CSS.escape(selectedGroupId) + '"]'
      )
      : null;
    var collection = element.closest('[data-portfolio-collection]');
    selectedItem = collection ? directCollectionItem(element, collection) : null;

    if (selectedTextRoot) {
      selectedTextRoot.setAttribute('data-portfolio-text-selected', 'true');
    }
    if (selectedItem) {
      selectedItem.setAttribute('data-portfolio-selected', 'true');
    }
    updateItemMetaPanel();
    refreshSelectionUi();
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

  function updateCharacterCount() {
    var value = document.getElementById('pe-text-draft').value;
    document.getElementById('pe-char-count').textContent = value.length + '자';
  }

  function openTextEditor(element) {
    if (element) selectElement(element);
    if (!selectedGroupId) {
      setStatus('편집할 문구를 먼저 클릭해 주세요.', 'error');
      return;
    }

    var rawText = getSelectedGroupText();
    originalPrefix = (rawText.match(/^\s*/) || [''])[0];
    originalSuffix = (rawText.match(/\s*$/) || [''])[0];
    originalText = rawText.slice(
      originalPrefix.length,
      rawText.length - originalSuffix.length
    );
    document.getElementById('pe-text-original').textContent =
      originalText || '(빈 문구)';
    document.getElementById('pe-text-draft').value = originalText;
    setModalStatus('');
    updateCharacterCount();

    var modal = document.getElementById('pe-text-modal');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(function () {
      var textarea = document.getElementById('pe-text-draft');
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 30);
  }

  function closeTextEditor() {
    document.getElementById('pe-text-modal').hidden = true;
    document.body.style.overflow = '';
    setModalStatus('');
  }

  function applyTextEditor() {
    if (!selectedGroupId) return;
    var groupElements = getSelectedTextElements();
    var anchor = getBestGroupAnchor(groupElements);
    if (!anchor) return;
    var nextText = document.getElementById('pe-text-draft').value.trim();
    var nextRawText = originalPrefix + nextText + originalSuffix;
    if (nextRawText !== getSelectedGroupText()) {
      groupElements.forEach(function (element) {
        element.textContent = '';
      });
      anchor.textContent = nextRawText;
      selectedText = anchor;
      setDirty(true);
      setStatus('문구를 적용했습니다. 방문자에게 보이려면 사이트에 게시하세요.', 'ok');
    }
    closeTextEditor();
    refreshSelectionUi();
  }

  function improveModalText() {
    if (!selectedGroupId) return;
    var textarea = document.getElementById('pe-text-draft');
    var instruction = document.getElementById('pe-ai-style').value;
    var context = selectedTextRoot
      ? selectedTextRoot.innerText.slice(0, 1200)
      : '';
    var button = document.getElementById('pe-ai');
    var text = textarea.value.trim();

    if (!text) {
      setModalStatus('다듬을 문구를 입력해 주세요.', 'error');
      return;
    }

    button.disabled = true;
    setModalStatus('Gemini가 수정안을 만들고 있습니다.');
    serverCall('improvePortfolioText', {
      text: text,
      instruction: instruction,
      context: context
    }).then(function (result) {
      textarea.value = result.text;
      updateCharacterCount();
      setModalStatus('수정안을 만들었습니다. 내용을 확인한 뒤 적용하세요.');
    }).catch(function (error) {
      setModalStatus(error.message, 'error');
    }).finally(function () {
      button.disabled = false;
    });
  }

  function cloneSelectedItem(resetText) {
    if (!selectedItem) {
      setStatus('먼저 추가할 목록의 항목을 클릭해 주세요.', 'error');
      return;
    }

    var collection = selectedItem.parentElement;
    var clone = selectedItem.cloneNode(true);
    clone.removeAttribute('data-portfolio-selected');
    clone.querySelectorAll('[data-portfolio-text-selected]').forEach(function (element) {
      element.removeAttribute('data-portfolio-text-selected');
    });
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(function (element) {
      element.removeAttribute('id');
    });
    window.PortfolioContent.ensureUniqueKeys(clone);

    if (resetText) {
      var resetGroups = {};
      clone.querySelectorAll('[data-portfolio-text-key]').forEach(function (element) {
        var groupId = element.getAttribute('data-portfolio-edit-group') ||
          element.getAttribute('data-portfolio-text-key');
        element.textContent = resetGroups[groupId] ? '' : '새 항목';
        resetGroups[groupId] = true;
      });
      if (clone.matches('.lecture-card')) {
        clone.setAttribute('data-id', String(Date.now()));
        clone.setAttribute('data-target', '교육 대상');
        clone.setAttribute('data-location', '기관 및 장소');
        clone.setAttribute('data-time', '교육 시간');
        clone.setAttribute('data-description', '새 강의의 상세 설명을 입력하세요.');
        clone.setAttribute('data-keywords', '새 강의');
      }
    }

    collection.insertBefore(clone, selectedItem.nextSibling);
    prepareEditGroups();
    var firstCloneText = clone.querySelector('[data-portfolio-text-key]');
    if (firstCloneText) selectElement(firstCloneText);
    setDirty(true);
    setStatus(resetText ? '새 항목을 추가했습니다. 첫 문구를 편집해 주세요.' : '항목을 복제했습니다.', 'ok');
    if (resetText && firstCloneText) openTextEditor(firstCloneText);
  }

  function deleteSelectedItem() {
    if (!selectedItem) {
      setStatus('삭제할 항목을 먼저 클릭해 주세요.', 'error');
      return;
    }
    var next = selectedItem.nextElementSibling || selectedItem.previousElementSibling;
    selectedItem.remove();
    prepareEditGroups();
    var nextText = next ? next.querySelector('[data-portfolio-text-key]') : null;
    if (nextText) selectElement(nextText);
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
    if (!sibling) {
      setStatus(direction < 0 ? '이미 첫 번째 항목입니다.' : '이미 마지막 항목입니다.');
      return;
    }
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
    prepareEditGroups();
    var sectionText = section.querySelector('[data-portfolio-text-key]');
    if (sectionText) selectElement(sectionText);
    setDirty(true);
    setStatus('새 자유 섹션을 추가했습니다. 제목부터 편집해 주세요.', 'ok');
    if (sectionText) openTextEditor(sectionText);
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
        selectedText = null;
        selectedTextRoot = null;
        selectedGroupId = '';
        selectedItem = null;
        refreshSelectionUi();
        updateItemMetaPanel();
        setDirty(false);
        setStatus('이전 버전을 복원했습니다.', 'ok');
      })
      .catch(function (error) {
        setStatus(error.message, 'error');
      });
  }

  function bindEditorEvents() {
    document.addEventListener('click', function (event) {
      if (event.target.closest('#portfolio-editor-ui,#pe-text-modal')) return;
      var editable = event.target.closest('[data-portfolio-text-key]');
      if (editable) selectElement(editable);
    }, true);

    document.addEventListener('dblclick', function (event) {
      if (event.target.closest('#portfolio-editor-ui,#pe-text-modal')) return;
      var editable = event.target.closest('[data-portfolio-text-key]');
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();
      openTextEditor(editable);
    }, true);

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a');
      if (link && !event.target.closest('#portfolio-editor-ui,#pe-text-modal')) {
        event.preventDefault();
        setStatus('편집 모드에서는 링크 이동을 막았습니다. 공개 사이트에서 확인해 주세요.');
      }
    }, true);

    document.addEventListener('keydown', function (event) {
      var modal = document.getElementById('pe-text-modal');
      if (modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTextEditor();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        applyTextEditor();
      }
    });

    document.getElementById('pe-collapse').addEventListener('click', function () {
      var ui = document.getElementById('portfolio-editor-ui');
      var collapsed = ui.classList.toggle('pe-collapsed');
      this.textContent = collapsed ? '‹' : '›';
      this.title = collapsed ? '패널 펼치기' : '패널 접기';
      this.setAttribute('aria-label', this.title);
    });
    document.getElementById('pe-open-text').addEventListener('click', function () {
      openTextEditor();
    });
    document.getElementById('pe-modal-close').addEventListener('click', closeTextEditor);
    document.getElementById('pe-cancel-text').addEventListener('click', closeTextEditor);
    document.getElementById('pe-apply-text').addEventListener('click', applyTextEditor);
    document.getElementById('pe-reset-text').addEventListener('click', function () {
      document.getElementById('pe-text-draft').value = originalText;
      updateCharacterCount();
      setModalStatus('원문으로 되돌렸습니다.');
    });
    document.getElementById('pe-text-draft').addEventListener('input', updateCharacterCount);
    document.getElementById('pe-ai').addEventListener('click', improveModalText);
    document.getElementById('pe-text-modal').addEventListener('click', function (event) {
      if (event.target === this) closeTextEditor();
    });

    document.getElementById('pe-save').addEventListener('click', saveDraft);
    document.getElementById('pe-publish').addEventListener('click', publish);
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
  window.addEventListener('portfolio-content-applied', prepareEditGroups);
  prepareEditGroups();

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
