// 变现与留存模块：广告 / 分享 / 云排行榜。
// 设计原则：所有能力在「未配置真实 ID / 非微信环境」下安全降级为 no-op，
// 游戏逻辑与 UI 不感知差异——到流量主开通、拿到广告位 ID、配好云环境后，
// 只需在这里填入 ID 即可启用，无需改动任何业务代码。
import { AdManager, ShareManager, CloudLeaderboard, ShareCard } from './types';

// ===== 待填：流量主开通（UV≥500）后填入真实广告位 ID =====
// 个人主体 + 纯广告(IAA) 免版号；但广告位需先成为流量主才能创建。
export const AD_UNIT = {
  banner: '', // 例如 'adunit-xxxxxxxxxxxx'
  interstitial: '',
  rewarded: '',
};

// 分享卡片默认文案（品牌 + 品类词，蹭搜索流量，遵守广告法不写功效）
export const SHARE_CARD: ShareCard = {
  title: '六边智将 · 益智解谜，来挑战你的脑力！',
  query: 'from=share',
};

function wxReady(): boolean {
  return typeof wx !== 'undefined';
}

// ---------- 广告 ----------
function wxAds(): AdManager {
  let banner: any = null;
  return {
    showBanner() {
      if (!AD_UNIT.banner || !wxReady()) return;
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const screenH = info.screenHeight || info.windowHeight;
        const screenW = info.screenWidth || info.windowWidth;
        // 置于底部，避开工具栏（H-122）与托盘（H-56）：给 90px 高区域
        banner = wx.createBannerAd({
          adUnitId: AD_UNIT.banner,
          style: { left: 0, top: Math.max(0, screenH - 90), width: screenW },
        });
        banner.show().catch(() => {});
      } catch {
        /* no-op */
      }
    },
    hideBanner() {
      try {
        banner?.destroy();
      } catch {
        /* no-op */
      }
      banner = null;
    },
    showInterstitial() {
      if (!AD_UNIT.interstitial || !wxReady()) return;
      try {
        const ad = wx.createInterstitialAd({ adUnitId: AD_UNIT.interstitial });
        ad.show().catch(() => {});
      } catch {
        /* no-op */
      }
    },
    showRewarded(): Promise<boolean> {
      return new Promise((resolve) => {
        if (!AD_UNIT.rewarded || !wxReady()) {
          resolve(false);
          return;
        }
        try {
          const ad = wx.createRewardedVideoAd({ adUnitId: AD_UNIT.rewarded });
          ad.onClose((res: any) => resolve(!!(res && res.isEnded)));
          ad.show()
            .catch(() => ad.load().then(() => ad.show()).catch(() => resolve(false)));
        } catch {
          resolve(false);
        }
      });
    },
  };
}

function domAds(): AdManager {
  return {
    showBanner() {},
    hideBanner() {},
    showInterstitial() {},
    showRewarded: async () => false,
  };
}

// ---------- 分享（裂变拉新，小游戏增长第一引擎） ----------
function wxShare(): ShareManager {
  return {
    enableShare(card: ShareCard) {
      if (!wxReady()) return;
      try {
        wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
        wx.onShareAppMessage(() => ({
          title: card.title,
          imageUrl: card.imageUrl,
          query: card.query || '',
        }));
      } catch {
        /* no-op */
      }
    },
    share(card?: Partial<ShareCard>) {
      if (!wxReady()) return;
      try {
        wx.shareAppMessage({
          title: card?.title || SHARE_CARD.title,
          imageUrl: card?.imageUrl,
          query: card?.query || SHARE_CARD.query,
        });
      } catch {
        /* no-op */
      }
    },
  };
}

function domShare(): ShareManager {
  return {
    enableShare() {},
    share(card?: Partial<ShareCard>) {
      try {
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
          (navigator as any).share({ title: card?.title || SHARE_CARD.title, url: location.href }).catch(() => {});
        }
      } catch {
        /* no-op */
      }
    },
  };
}

// ---------- 云排行榜（本地兜底；配好云环境后切换为真实云端） ----------
function wxCloud(): CloudLeaderboard {
  const KEY = 'lbzj_lb';
  return {
    enabled: false, // 配好 wx.cloud 环境后改为 true
    submitScore(score: number) {
      if (!wxReady()) return;
      try {
        const arr: number[] = JSON.parse(wx.getStorageSync(KEY) || '[]');
        arr.push(score);
        wx.setStorageSync(KEY, JSON.stringify(arr.slice(-50)));
      } catch {
        /* no-op */
      }
    },
    async getRank() {
      try {
        const arr: number[] = JSON.parse(wx.getStorageSync(KEY) || '[]');
        arr.sort((a, b) => b - a);
        return {
          rank: 0,
          top: arr.slice(0, 10).map((s, i) => ({ name: '玩家' + (i + 1), score: s })),
        };
      } catch {
        return { rank: 0, top: [] };
      }
    },
  };
}

function domCloud(): CloudLeaderboard {
  const KEY = 'lbzj_lb';
  return {
    enabled: false,
    submitScore(score: number) {
      try {
        const arr: number[] = JSON.parse(localStorage.getItem(KEY) || '[]');
        arr.push(score);
        localStorage.setItem(KEY, JSON.stringify(arr.slice(-50)));
      } catch {
        /* no-op */
      }
    },
    async getRank() {
      try {
        const arr: number[] = JSON.parse(localStorage.getItem(KEY) || '[]');
        arr.sort((a, b) => b - a);
        return {
          rank: 0,
          top: arr.slice(0, 10).map((s, i) => ({ name: '玩家' + (i + 1), score: s })),
        };
      } catch {
        return { rank: 0, top: [] };
      }
    },
  };
}

export interface Monetization {
  ads: AdManager;
  share: ShareManager;
  cloud: CloudLeaderboard;
}

// 根据运行环境返回对应实现；微信环境用 wx.*，其余（浏览器/测试）用 no-op/本地兜底。
export function createMonetization(): Monetization {
  if (wxReady()) {
    return { ads: wxAds(), share: wxShare(), cloud: wxCloud() };
  }
  return { ads: domAds(), share: domShare(), cloud: domCloud() };
}
