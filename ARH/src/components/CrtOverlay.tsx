import React from 'react';

// CRT 扫描线 + 暗角装饰层：固定在视口、不响应点击。
// 抽成组件后只挂载在首页 / 答题页，报告页不渲染，避免污染鉴定报告截图，
// 也避免移动端暗角影响长文档可读性。定位在 GOD MODE 面板（z-50）之下。
export const CrtOverlay: React.FC = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.025) 50%), linear-gradient(90deg, rgba(255,0,0,0.012), rgba(0,255,0,0.012), rgba(0,0,255,0.012))',
        backgroundSize: '100% 3px, 2px 100%',
      }}
    />
    <div
      className="absolute inset-0"
      style={{ background: 'radial-gradient(circle, transparent 68%, rgba(0,0,0,0.06) 100%)' }}
    />
  </div>
);
