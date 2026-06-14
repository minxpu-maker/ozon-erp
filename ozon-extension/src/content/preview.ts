/**
 * 采集预览面板组件
 * 采集前预览数据，确认后推送
 */

interface PreviewData {
  productId: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  salesVolume?: number;
  rating?: number;
  reviewCount?: number;
  sellerName?: string;
  deliveryType?: string;
  collectableCount: number;
  totalFields: number;
}

type ConfirmCallback = (confirmed: boolean, overwrite: boolean) => void;

/**
 * 显示采集预览面板
 */
export function showCollectPreview(
  data: PreviewData,
  isAlreadyCollected: boolean,
  onConfirm: ConfirmCallback
): void {
  // 移除已存在的预览面板
  const existing = document.querySelector('.ozon-ext-preview-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'ozon-ext-preview-modal';
  
  // 根据是否已采集显示不同内容
  const title = isAlreadyCollected 
    ? '数据已存在，是否覆盖更新？' 
    : '确认采集以下商品';
  
  const collectablePercent = Math.round((data.collectableCount / data.totalFields) * 100);

  overlay.innerHTML = `
    <div class="ozon-ext-preview-content">
      <div class="ozon-ext-preview-header">
        <span class="ozon-ext-preview-title">${title}</span>
        <button class="ozon-ext-preview-close">&times;</button>
      </div>
      
      <div class="ozon-ext-preview-body">
        <div class="ozon-ext-preview-product">
          ${data.imageUrl ? `<img src="${data.imageUrl}" class="ozon-ext-preview-img" alt="" />` : ''}
          <div class="ozon-ext-preview-info">
            <div class="ozon-ext-preview-product-title">${data.title || '商品标题'}</div>
            <div class="ozon-ext-preview-product-id">SKU: ${data.productId}</div>
          </div>
        </div>
        
        <div class="ozon-ext-preview-stats">
          <div class="ozon-ext-preview-stat-row">
            <span class="ozon-ext-preview-stat-label">售价</span>
            <span class="ozon-ext-preview-stat-value">${data.price ? data.price.toFixed(2) : '-'}</span>
          </div>
          ${data.originalPrice ? `
          <div class="ozon-ext-preview-stat-row">
            <span class="ozon-ext-preview-stat-label">原价</span>
            <span class="ozon-ext-preview-stat-value">${data.originalPrice.toFixed(2)}</span>
          </div>
          ` : ''}
          ${data.salesVolume ? `
          <div class="ozon-ext-preview-stat-row">
            <span class="ozon-ext-preview-stat-label">销量(估算)</span>
            <span class="ozon-ext-preview-stat-value">${data.salesVolume.toLocaleString()}</span>
          </div>
          ` : ''}
          ${data.rating ? `
          <div class="ozon-ext-preview-stat-row">
            <span class="ozon-ext-preview-stat-label">评分</span>
            <span class="ozon-ext-preview-stat-value">${data.rating} ⭐</span>
          </div>
          ` : ''}
          ${data.reviewCount ? `
          <div class="ozon-ext-preview-stat-row">
            <span class="ozon-ext-preview-stat-label">评论数</span>
            <span class="ozon-ext-preview-stat-value">${data.reviewCount.toLocaleString()}</span>
          </div>
          ` : ''}
          ${data.sellerName ? `
          <div class="ozon-ext-preview-stat-row">
            <span class="ozon-ext-preview-stat-label">卖家</span>
            <span class="ozon-ext-preview-stat-value">${data.sellerName}</span>
          </div>
          ` : ''}
          ${data.deliveryType ? `
          <div class="ozon-ext-preview-stat-row">
            <span class="ozon-ext-preview-stat-label">配送</span>
            <span class="ozon-ext-preview-stat-value">${data.deliveryType}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="ozon-ext-preview-progress">
          <div class="ozon-ext-preview-progress-label">
            可采集字段：${data.collectableCount}/${data.totalFields}
            <span class="ozon-ext-preview-progress-percent">(${collectablePercent}%)</span>
          </div>
          <div class="ozon-ext-preview-progress-bar">
            <div class="ozon-ext-preview-progress-fill" style="width: ${collectablePercent}%"></div>
          </div>
        </div>
      </div>
      
      <div class="ozon-ext-preview-footer">
        ${isAlreadyCollected ? `
          <button class="ozon-ext-preview-btn ozon-ext-preview-btn-warning ozon-ext-preview-btn-confirm">覆盖更新</button>
          <button class="ozon-ext-preview-btn ozon-ext-preview-btn-cancel">取消</button>
        ` : `
          <button class="ozon-ext-preview-btn ozon-ext-preview-btn-primary ozon-ext-preview-btn-confirm">确认采集</button>
          <button class="ozon-ext-preview-btn ozon-ext-preview-btn-cancel">取消</button>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 事件绑定
  const closeBtn = overlay.querySelector('.ozon-ext-preview-close');
  const cancelBtn = overlay.querySelector('.ozon-ext-preview-btn-cancel');
  const confirmBtn = overlay.querySelector('.ozon-ext-preview-btn-confirm');

  const close = () => {
    overlay.classList.add('ozon-ext-preview-fade-out');
    setTimeout(() => overlay.remove(), 200);
  };

  closeBtn?.addEventListener('click', () => {
    onConfirm(false, false);
    close();
  });

  cancelBtn?.addEventListener('click', () => {
    onConfirm(false, false);
    close();
  });

  confirmBtn?.addEventListener('click', () => {
    onConfirm(true, isAlreadyCollected);
    close();
  });

  // 点击背景关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      onConfirm(false, false);
      close();
    }
  });

  // ESC关闭
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onConfirm(false, false);
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * 显示采集结果
 */
export function showCollectResult(success: number, failed: number, onClose?: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'ozon-ext-preview-modal';
  
  const allSuccess = failed === 0;
  const icon = allSuccess ? '✅' : (success > 0 ? '⚠️' : '❌');
  const title = allSuccess ? '采集完成' : '采集完成（部分失败）';
  const message = allSuccess 
    ? `成功采集 ${success} 件商品`
    : `成功 ${success} 件，失败 ${failed} 件`;

  overlay.innerHTML = `
    <div class="ozon-ext-preview-content ozon-ext-preview-result">
      <div class="ozon-ext-preview-result-icon">${icon}</div>
      <div class="ozon-ext-preview-result-title">${title}</div>
      <div class="ozon-ext-preview-result-message">${message}</div>
      <button class="ozon-ext-preview-btn ozon-ext-preview-btn-primary ozon-ext-preview-btn-confirm">确定</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector('.ozon-ext-preview-btn-confirm');
  const close = () => {
    overlay.classList.add('ozon-ext-preview-fade-out');
    setTimeout(() => {
      overlay.remove();
      onClose?.();
    }, 200);
  };

  closeBtn?.addEventListener('click', close);
}

/**
 * 添加已采集标记到元素
 */
export function addCollectedBadge(element: Element | null, position: 'top-right' | 'top-left' = 'top-right'): void {
  if (!element) return;
  
  // 检查是否已有标记
  const existing = element.querySelector('.ozon-ext-collected-badge');
  if (existing) return;

  const badge = document.createElement('span');
  badge.className = `ozon-ext-collected-badge ozon-ext-collected-badge-${position}`;
  badge.textContent = '✅ 已采集';
  
  const container = element as HTMLElement;
  container.style.position = 'relative';
  container.appendChild(badge);
}

/**
 * 添加详情页已采集标签
 */
export function addDetailCollectedBadge(container: Element | null): void {
  if (!container) return;

  const existing = container.querySelector('.ozon-ext-collected-tag');
  if (existing) return;

  const tag = document.createElement('span');
  tag.className = 'ozon-ext-collected-tag';
  tag.textContent = '✅ 已采集';
  
  container.appendChild(tag);
}
