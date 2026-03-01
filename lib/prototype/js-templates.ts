/**
 * 原型交互 JS 模板库（#57）
 * 经过验证的常用交互实现，注入系统提示词后由 AI 直接复用
 * 所有模板：原生 DOM API、data-* 钩子、自包含、互不干扰
 */

export interface JSTemplate {
  name: string
  description: string
  code: string
}

export const JS_TEMPLATES: JSTemplate[] = [
  {
    name: 'modal',
    description: '弹窗打开/关闭，ESC/遮罩关闭',
    code: `// Modal 弹窗
// 用法: <button data-modal-open="myModal">打开</button>
// <div data-modal="myModal" class="hidden fixed inset-0 ...">
//   <div data-modal-content>...</div>
//   <button data-modal-close>关闭</button>
// </div>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-modal-open]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-modal-open');
      var modal = document.querySelector('[data-modal="' + id + '"]');
      if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
    });
  });
  document.querySelectorAll('[data-modal]').forEach(function(modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; }
    });
    var closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn) { closeBtn.addEventListener('click', function() { modal.classList.add('hidden'); document.body.style.overflow = ''; }); }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('[data-modal]:not(.hidden)').forEach(function(m) { m.classList.add('hidden'); document.body.style.overflow = ''; });
    }
  });
});`
  },
  {
    name: 'tabs',
    description: 'Tab 切换，active 样式联动',
    code: `// Tab 切换
// 用法: <button data-tab="tab1" data-tab-group="main">Tab1</button>
// <div data-tab-panel="tab1" data-tab-group="main">内容1</div>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-tab]').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var target = tab.getAttribute('data-tab');
      var group = tab.getAttribute('data-tab-group') || 'default';
      // 切换 tab 按钮样式
      document.querySelectorAll('[data-tab][data-tab-group="' + group + '"]').forEach(function(t) {
        t.classList.remove('active', 'border-indigo-500', 'text-indigo-600', 'bg-indigo-50');
        t.classList.add('border-transparent', 'text-gray-500');
      });
      tab.classList.add('active', 'border-indigo-500', 'text-indigo-600', 'bg-indigo-50');
      tab.classList.remove('border-transparent', 'text-gray-500');
      // 切换内容面板
      document.querySelectorAll('[data-tab-panel][data-tab-group="' + group + '"]').forEach(function(p) {
        p.classList.add('hidden');
      });
      var panel = document.querySelector('[data-tab-panel="' + target + '"][data-tab-group="' + group + '"]');
      if (panel) { panel.classList.remove('hidden'); }
    });
  });
  // 初始化：激活每组第一个 tab
  var groups = new Set();
  document.querySelectorAll('[data-tab]').forEach(function(t) { groups.add(t.getAttribute('data-tab-group') || 'default'); });
  groups.forEach(function(group) {
    var first = document.querySelector('[data-tab][data-tab-group="' + group + '"]');
    if (first) { first.click(); }
  });
});`
  },
  {
    name: 'dropdown',
    description: '下拉菜单，点击外部关闭',
    code: `// 下拉菜单
// 用法: <button data-dropdown-toggle="menu1">打开</button>
// <div data-dropdown="menu1" class="hidden absolute ...">菜单内容</div>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-dropdown-toggle]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = btn.getAttribute('data-dropdown-toggle');
      var menu = document.querySelector('[data-dropdown="' + id + '"]');
      if (!menu) return;
      var isOpen = !menu.classList.contains('hidden');
      // 先关闭所有下拉
      document.querySelectorAll('[data-dropdown]').forEach(function(m) { m.classList.add('hidden'); });
      if (!isOpen) { menu.classList.remove('hidden'); }
    });
  });
  document.addEventListener('click', function() {
    document.querySelectorAll('[data-dropdown]').forEach(function(m) { m.classList.add('hidden'); });
  });
});`
  },
  {
    name: 'form-validate',
    description: '必填校验，错误提示',
    code: `// 表单校验
// 用法: <form data-validate>
//   <input data-required data-field-name="邮箱" type="email">
//   <span data-error-for="邮箱" class="hidden text-red-500 text-xs"></span>
// </form>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('form[data-validate]').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      var valid = true;
      form.querySelectorAll('[data-required]').forEach(function(field) {
        var name = field.getAttribute('data-field-name') || field.name || 'field';
        var errEl = form.querySelector('[data-error-for="' + name + '"]');
        var value = field.value.trim();
        var isEmpty = !value;
        var isInvalidEmail = field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (isEmpty || isInvalidEmail) {
          valid = false;
          field.classList.add('border-red-500');
          if (errEl) { errEl.textContent = isEmpty ? name + '不能为空' : '请输入有效的' + name; errEl.classList.remove('hidden'); }
        } else {
          field.classList.remove('border-red-500');
          if (errEl) { errEl.classList.add('hidden'); }
        }
      });
      if (!valid) { e.preventDefault(); }
    });
    form.querySelectorAll('[data-required]').forEach(function(field) {
      field.addEventListener('input', function() {
        var name = field.getAttribute('data-field-name') || field.name || 'field';
        var errEl = form.querySelector('[data-error-for="' + name + '"]');
        if (field.value.trim()) { field.classList.remove('border-red-500'); if (errEl) errEl.classList.add('hidden'); }
      });
    });
  });
});`
  },
  {
    name: 'toast',
    description: '3秒自动消失，success/error',
    code: `// Toast 提示（全局函数）
// 用法: window.showToast('操作成功', 'success')  或  window.showToast('操作失败', 'error')
window.showToast = function(message, type) {
  var toast = document.createElement('div');
  var bgColor = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-green-500';
  toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg transform translate-y-0 transition-all duration-300 ' + bgColor;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 3000);
};`
  },
  {
    name: 'accordion',
    description: '手风琴折叠展开',
    code: `// 手风琴折叠展开
// 用法: <div data-accordion>
//   <button data-accordion-toggle>标题</button>
//   <div data-accordion-panel class="hidden">内容</div>
// </div>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-accordion]').forEach(function(accordion) {
    accordion.querySelectorAll('[data-accordion-toggle]').forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        var panel = toggle.nextElementSibling;
        if (!panel || !panel.hasAttribute('data-accordion-panel')) return;
        var isOpen = !panel.classList.contains('hidden');
        // 单开模式：关闭同级其他面板
        accordion.querySelectorAll('[data-accordion-panel]').forEach(function(p) { p.classList.add('hidden'); });
        accordion.querySelectorAll('[data-accordion-toggle]').forEach(function(t) {
          t.querySelector('[data-chevron]') && (t.querySelector('[data-chevron]').style.transform = '');
        });
        if (!isOpen) {
          panel.classList.remove('hidden');
          var chevron = toggle.querySelector('[data-chevron]');
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
      });
    });
  });
});`
  },
  {
    name: 'sidebar-toggle',
    description: '侧边栏折叠，移动端菜单',
    code: `// 侧边栏折叠 / 移动端汉堡菜单
// 用法: <button data-sidebar-toggle>☰</button>
// <aside data-sidebar class="hidden md:block ...">侧边栏</aside>
// <div data-sidebar-overlay class="hidden fixed inset-0 bg-black/50 z-10"></div>
document.addEventListener('DOMContentLoaded', function() {
  var sidebar = document.querySelector('[data-sidebar]');
  var overlay = document.querySelector('[data-sidebar-overlay]');
  if (!sidebar) return;
  document.querySelectorAll('[data-sidebar-toggle]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var isOpen = !sidebar.classList.contains('hidden') && !sidebar.classList.contains('-translate-x-full');
      if (isOpen) {
        sidebar.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
        document.body.style.overflow = '';
      } else {
        sidebar.classList.remove('hidden');
        if (overlay) overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
    });
  });
  if (overlay) {
    overlay.addEventListener('click', function() {
      sidebar.classList.add('hidden');
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    });
  }
});`
  },
  {
    name: 'table-sort',
    description: '表格列排序',
    code: `// 表格列排序
// 用法: <table data-sortable>
//   <th data-sort="name">姓名</th>
//   <tbody>
//     <tr><td data-cell="name">张三</td>...</tr>
//   </tbody>
// </table>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('table[data-sortable]').forEach(function(table) {
    var sortState = { col: null, asc: true };
    table.querySelectorAll('th[data-sort]').forEach(function(th) {
      th.style.cursor = 'pointer';
      th.addEventListener('click', function() {
        var col = th.getAttribute('data-sort');
        sortState.asc = sortState.col === col ? !sortState.asc : true;
        sortState.col = col;
        var tbody = table.querySelector('tbody');
        if (!tbody) return;
        var rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort(function(a, b) {
          var aCell = a.querySelector('[data-cell="' + col + '"]');
          var bCell = b.querySelector('[data-cell="' + col + '"]');
          var aVal = aCell ? aCell.textContent.trim() : '';
          var bVal = bCell ? bCell.textContent.trim() : '';
          var aNum = parseFloat(aVal), bNum = parseFloat(bVal);
          var cmp = (!isNaN(aNum) && !isNaN(bNum)) ? aNum - bNum : aVal.localeCompare(bVal, 'zh');
          return sortState.asc ? cmp : -cmp;
        });
        rows.forEach(function(row) { tbody.appendChild(row); });
        // 更新排序箭头
        table.querySelectorAll('th[data-sort]').forEach(function(t) { t.setAttribute('data-sort-dir', ''); });
        th.setAttribute('data-sort-dir', sortState.asc ? 'asc' : 'desc');
      });
    });
  });
});`
  },
  {
    name: 'infinite-scroll',
    description: '滚动加载更多',
    code: `// 滚动加载更多
// 用法: <div data-infinite-scroll data-load-more-url="/api/items?page=2">
//   <div data-infinite-content>列表内容</div>
//   <div data-infinite-loader class="hidden text-center py-4">加载中...</div>
//   <button data-load-more class="hidden">加载更多</button>
// </div>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-infinite-scroll]').forEach(function(container) {
    var loading = false;
    var page = 1;
    var loader = container.querySelector('[data-infinite-loader]');
    var content = container.querySelector('[data-infinite-content]');
    function checkScroll() {
      if (loading) return;
      var rect = container.getBoundingClientRect();
      var bottom = rect.bottom;
      if (bottom <= window.innerHeight + 100) {
        loading = true;
        page++;
        if (loader) loader.classList.remove('hidden');
        // 模拟加载：实际项目替换为 fetch 调用
        setTimeout(function() {
          if (loader) loader.classList.add('hidden');
          loading = false;
          // 示例：追加占位内容（实际替换为服务端数据）
          if (content && page <= 3) {
            var placeholder = document.createElement('div');
            placeholder.className = 'py-3 border-b text-gray-400 text-sm';
            placeholder.textContent = '第 ' + page + ' 页数据（请替换为真实 fetch 调用）';
            content.appendChild(placeholder);
          }
        }, 800);
      }
    }
    window.addEventListener('scroll', checkScroll);
    document.querySelector('[data-load-more]') && document.querySelector('[data-load-more]').addEventListener('click', checkScroll);
  });
});`
  },
  {
    name: 'search-filter',
    description: '输入框实时过滤列表',
    code: `// 实时搜索过滤
// 用法: <input data-search-input data-search-target="userList" placeholder="搜索...">
// <ul id="userList">
//   <li data-searchable>张三 - 管理员</li>
//   <li data-searchable>李四 - 成员</li>
// </ul>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-search-input]').forEach(function(input) {
    var targetId = input.getAttribute('data-search-target');
    var list = targetId ? document.getElementById(targetId) : null;
    if (!list) return;
    var emptyTip = list.querySelector('[data-search-empty]');
    input.addEventListener('input', function() {
      var query = input.value.trim().toLowerCase();
      var items = list.querySelectorAll('[data-searchable]');
      var visibleCount = 0;
      items.forEach(function(item) {
        var text = item.textContent.toLowerCase();
        var match = !query || text.includes(query);
        item.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      if (emptyTip) { emptyTip.style.display = visibleCount === 0 ? '' : 'none'; }
    });
  });
});`
  }
]

/**
 * 将 JS 模板库转换为注入提示词的格式
 */
export function buildJSTemplatePrompt (): string {
  return JS_TEMPLATES
    .map(t => `### ${t.name}\n// ${t.description}\n${t.code}`)
    .join('\n\n')
}
