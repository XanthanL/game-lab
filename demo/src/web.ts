// 浏览器试玩入口：免 AppID，本地起静态服务器即可验证手感。
// 画布尺寸由共享启动逻辑（game.ts）按窗口大小一次性设定，
// 与微信小游戏"窗口固定"的行为保持一致。
import { createDomPlatform } from './platform/dom';
import { runGame } from './game';

const canvas = document.getElementById('game') as any;
runGame(createDomPlatform(canvas));
