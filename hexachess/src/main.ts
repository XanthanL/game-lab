// 微信小游戏入口：打包后输出 game.js
import { createWxPlatform } from './platform/wx';
import { runGame } from './game';

runGame(createWxPlatform());
