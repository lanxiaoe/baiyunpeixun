/**
 * 智能台账系统 - 共享工具函数
 */

const App = {
  // API基础路径
  API_BASE: '',

  /**
   * 初始化应用
   */
  init() {
    this.detectEnvironment();
  },

  /**
   * 检测微信/QQ内置浏览器环境
   */
  detectEnvironment() {
    const ua = navigator.userAgent.toLowerCase();
    const isWeChat = ua.match(/MicroMessenger/i) == "micromessenger";
    const isQQ = ua.match(/QQ/i) == "qq";

    if (isWeChat || isQQ) {
      const warning = document.getElementById('env-warning');
      if (warning) {
        warning.style.display = 'block';
      }
    }
  },

  /**
   * 检测是否为移动设备
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  /**
   * API请求封装
   */
  async request(url, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // 处理401未授权
    if (response.status === 401) {
      if (confirm('密码验证失败，是否重新登录？')) {
        window.location.reload();
      }
      throw new Error('Unauthorized');
    }

    return response;
  },

  /**
   * GET请求
   */
  async get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return this.request(fullUrl);
  },

  /**
   * POST请求
   */
  async post(url, data) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * DELETE请求
   */
  async delete(url) {
    return this.request(url, {
      method: 'DELETE'
    });
  },

  /**
   * 显示提示消息
   */
  showMessage(msg, type = 'info', duration = 3000) {
    // 移除已存在的消息
    const existing = document.querySelector('.app-message');
    if (existing) existing.remove();

    const message = document.createElement('div');
    message.className = `app-message app-message-${type}`;
    message.textContent = msg;
    
    // 样式
    Object.assign(message.style, {
      position: 'fixed',
      top: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 24px',
      borderRadius: '8px',
      zIndex: '100000',
      fontSize: '14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'fadeIn 0.3s ease'
    });

    // 根据类型设置颜色
    const colors = {
      success: { bg: '#f0fff4', color: '#38a169' },
      error: { bg: '#fff5f5', color: '#e53e3e' },
      warning: { bg: '#fffaf0', color: '#dd6b20' },
      info: { bg: '#ebf8ff', color: '#3182ce' }
    };
    const color = colors[type] || colors.info;
    message.style.backgroundColor = color.bg;
    message.style.color = color.color;

    document.body.appendChild(message);

    // 添加动画样式
    if (!document.getElementById('message-animation-style')) {
      const style = document.createElement('style');
      style.id = 'message-animation-style';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `;
      document.head.appendChild(style);
    }

    // 自动移除
    setTimeout(() => {
      message.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => message.remove(), 300);
    }, duration);
  },

  /**
   * 确认对话框
   */
  confirm(message, title = '确认') {
    return new Promise((resolve) => {
      resolve(window.confirm(`${title}\n\n${message}`));
    });
  },

  /**
   * 格式化日期
   */
  formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  /**
   * 生成唯一ID
   */
  generateId(prefix = '') {
    return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showMessage('已复制到剪贴板', 'success');
      return true;
    } catch (err) {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showMessage('已复制到剪贴板', 'success');
      return true;
    }
  },

  /**
   * 下载文件
   */
  downloadFile(content, filename, mimeType = 'application/octet-stream') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 文件大小格式化
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// 签名相关工具
const Signature = {
  /**
   * 初始化签名画布
   */
  initCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    const initResolution = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.resetTransform();
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
    };

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cX = e.touches ? e.touches[0].clientX : e.clientX;
      const cY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: cX - rect.left, y: cY - rect.top };
    };

    const startDraw = (e) => { isDrawing = true; draw(e); };
    const stopDraw = () => { isDrawing = false; ctx.beginPath(); };
    const draw = (e) => {
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', stopDraw);

    window.addEventListener('resize', initResolution);
    setTimeout(initResolution, 100);

    return {
      canvas,
      ctx,
      clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
      getImageData: () => getOptimizedSignatureData(canvas, ctx)
    };
  },

  /**
   * 验证模板是否存在
   */
  async validateTemplate(templateId) {
    if (!templateId) {
      throw new Error('缺少模板ID');
    }

    const response = await fetch(`/api/template?templateId=${templateId}&type=exists`);
    const data = await response.json();

    if (!data.exists) {
      throw new Error('该签署链接已失效或不存在');
    }

    return true;
  },

  /**
   * 提交签名
   */
  async submitSignature(templateId, userName, signatureImage) {
    const response = await fetch(`/api/signatures?templateId=${templateId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, signatureImage })
    });

    if (response.status === 404) {
      throw new Error('该签署链接已失效或不存在');
    }

    if (!response.ok) {
      throw new Error('提交失败，请重试');
    }

    return true;
  }
};

/**
 * 获取优化后的签名数据
 */
function getOptimizedSignatureData(canvas, ctx) {
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h).data;

  let minX = w, maxX = 0, minY = h, maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = imgData[(y * w + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
  }

  if (!hasPixels) return null;

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w, maxX + pad);
  maxY = Math.min(h, maxY + pad);

  let cropW = maxX - minX;
  let cropH = maxY - minY;

  const MAX_SIDE = 400;
  let scale = 1;
  if (cropW > MAX_SIDE || cropH > MAX_SIDE) {
    scale = Math.min(MAX_SIDE / cropW, MAX_SIDE / cropH);
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropW * scale;
  tempCanvas.height = cropH * scale;
  const tempCtx = tempCanvas.getContext('2d');

  tempCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, tempCanvas.width, tempCanvas.height);
  return tempCanvas.toDataURL('image/png');
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 导出到全局
window.App = App;
window.Signature = Signature;
window.getOptimizedSignatureData = getOptimizedSignatureData;
