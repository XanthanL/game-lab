// 海域命名 / 地形区域 / 海峡 —— 坐标都是经纬度（度）。
// 大陆轮廓本身已换成真实地理数据：js/coastdata.js（tools/build-coastdata.mjs 生成）。

/* 海域命名 */
export const SEAS = [
  /* 欧洲周边 */
  { id: 'atlantic', name: '大西洋', en: 'Atlantic Ocean', c: [-30.0, 30.0] },
  { id: 'bay_biscay', name: '比斯开湾', en: 'Bay of Biscay', c: [-4.0, 45.5] },
  { id: 'channel', name: '英吉利海峡', en: 'English Channel', c: [0.0, 50.0] },
  { id: 'north_sea', name: '北海', en: 'North Sea', c: [3.5, 56.0] },
  { id: 'irish_sea', name: '爱尔兰海', en: 'Irish Sea', c: [-5.2, 53.4] },
  { id: 'norwegian', name: '挪威海', en: 'Norwegian Sea', c: [2.0, 66.0] },
  { id: 'baltic', name: '波罗的海', en: 'Baltic Sea', c: [19.0, 57.0] },
  { id: 'gulf_bothnia', name: '波的尼亚湾', en: 'Gulf of Bothnia', c: [21.0, 63.5] },
  { id: 'gulf_finland', name: '芬兰湾', en: 'Gulf of Finland', c: [26.0, 60.0] },
  { id: 'w_med', name: '西地中海', en: 'Western Mediterranean', c: [4.0, 39.5] },
  { id: 'e_med', name: '东地中海', en: 'Eastern Mediterranean', c: [22.0, 34.5] },
  { id: 'adriatic', name: '亚得里亚海', en: 'Adriatic Sea', c: [16.5, 42.5] },
  { id: 'aegean', name: '爱琴海', en: 'Aegean Sea', c: [25.0, 38.0] },
  { id: 'tyrrhenian', name: '第勒尼安海', en: 'Tyrrhenian Sea', c: [12.0, 40.5] },
  { id: 'ionian', name: '爱奥尼亚海', en: 'Ionian Sea', c: [18.0, 37.5] },
  { id: 'black_sea', name: '黑海', en: 'Black Sea', c: [34.0, 43.5] },
  { id: 'azov', name: '亚速海', en: 'Sea of Azov', c: [36.5, 46.3] },
  { id: 'caspian', name: '里海', en: 'Caspian Sea', c: [50.0, 44.0] },
  { id: 'white_sea', name: '白海', en: 'White Sea', c: [37.0, 65.5] },
  { id: 'barents', name: '巴伦支海', en: 'Barents Sea', c: [42.0, 71.0] },
  
  /* 美洲周边 */
  { id: 'atlantic_north', name: '北大西洋', en: 'North Atlantic', c: [-40.0, 50.0] },
  { id: 'atlantic_south', name: '南大西洋', en: 'South Atlantic', c: [-20.0, -20.0] },
  { id: 'pacific_east', name: '东太平洋', en: 'Eastern Pacific', c: [-120.0, 30.0] },
  { id: 'arctic_pacific', name: '北冰洋', en: 'Arctic Ocean', c: [-30.0, 78.0] },
  { id: 'caribbean', name: '加勒比海', en: 'Caribbean Sea', c: [-75.0, 20.0] },
  { id: 'golfof mexico', name: '墨西哥湾', en: 'Gulf of Mexico', c: [-92.0, 25.0] },
  { id: 'hudson', name: '哈德逊湾', en: 'Hudson Bay', c: [-80.0, 56.0] },
  { id: 'labrador', name: '拉布拉多海', en: 'Labrador Sea', c: [-55.0, 58.0] },
  { id: 'beaufort', name: '波弗特海', en: 'Beaufort Sea', c: [-135.0, 72.0] },
  { id: 'greenland', name: '格陵兰海', en: 'Greenland Sea', c: [-10.0, 72.0] },
  
  /* 亚洲周边 */
  { id: 'pacific_west', name: '西太平洋', en: 'Western Pacific', c: [140.0, 30.0] },
  { id: 'indian', name: '印度洋', en: 'Indian Ocean', c: [70.0, -10.0] },
  { id: 'south_china', name: '南海', en: 'South China Sea', c: [115.0, 18.0] },
  { id: 'east_china', name: '东海', en: 'East China Sea', c: [125.0, 30.0] },
  { id: 'yellow_sea', name: '黄海', en: 'Yellow Sea', c: [122.0, 35.0] },
  { id: 'japan_sea', name: '日本海', en: 'Sea of Japan', c: [132.0, 37.0] },
  { id: 'philippine', name: '菲律宾海', en: 'Philippine Sea', c: [130.0, 15.0] },
  { id: 'coral', name: '珊瑚海', en: 'Coral Sea', c: [155.0, -20.0] },
  { id: 'tasman', name: '塔斯曼海', en: 'Tasman Sea', c: [157.0, -42.0] },
  { id: 'red', name: '红海', en: 'Red Sea', c: [38.0, 18.0] },
  { id: 'persian', name: '波斯湾', en: 'Persian Gulf', c: [51.0, 28.0] },
  { id: 'andaman', name: '安达曼海', en: 'Andaman Sea', c: [94.0, 10.0] },
  { id: 'bay_bengal', name: '孟加拉湾', en: 'Bay of Bengal', c: [92.0, 18.0] },
  { id: 'arabia', name: '阿拉伯海', en: 'Arabian Sea', c: [62.0, 15.0] },
];

/* 地形区域定义 */
export const TERRAIN_BOXES = [
  ['alpine', 5.5, 45.2, 15.5, 47.6],      // 阿尔卑斯
  ['alpine', -1.5, 42.3, 3.2, 43.6],      // 比利牛斯
  ['alpine', 18.0, 44.8, 27.5, 49.2],     // 喀尔巴阡
  ['alpine', 39.5, 41.0, 50.5, 44.2],     // 高加索
  ['alpine', 18.8, 40.8, 23.4, 44.0],     // 巴尔干山地
  ['alpine', 24.0, 37.5, 27.6, 41.0],     // 希腊山地
  ['alpine', 8.0, 60.5, 22.0, 69.0],      // 斯堪的纳维亚山脉
  ['alpine', 19.0, 42.0, 21.5, 44.5],     // 迪纳拉
  ['alpine', -120.0, 35.0, -115.0, 40.0], // 落基山脉南段
  ['alpine', -125.0, 40.0, -120.0, 50.0], // 海岸山脉
  ['desert', -17.0, 16.0, 35.0, 32.0],    // 撒哈拉
  ['desert', 33.0, 29.4, 50.5, 33.5],     // 叙利亚 - 两河沙漠
  ['desert', -105.0, 23.0, -100.0, 32.0], // 墨西哥北部沙漠
  ['steppe', 30.0, 45.5, 50.5, 55.0],     // 南俄草原
  ['steppe', 46.0, 44.0, 50.5, 53.0],     // 钦察草原
  ['steppe', 25.0, 45.0, 34.0, 48.5],     // 黑海草原
  ['steppe', 85.0, 45.0, 110.0, 55.0],    // 蒙古高原
  ['forest', 20.0, 52.0, 40.0, 62.0],     // 罗斯林海
  ['forest', 15.0, 60.0, 32.0, 68.0],     // 芬兰 - 卡累利阿
  ['forest', 5.0, 48.0, 18.0, 55.5],      // 中欧林
  ['forest', -100.0, 25.0, -80.0, 45.0],  // 北美东部森林
  ['forest', -125.0, 45.0, -115.0, 60.0], // 加拿大Shield
  ['tundra', -180.0, 68.0, -60.0, 70.0],  // 北极苔原 (北美)
  ['tundra', 60.0, 68.0, 180.0, 70.0],    // 西伯利亚苔原

  /* 全球补充：气候模型之外的硬覆盖（先命中者胜，山地放在雨林前） */
  ['alpine', 72.0, 27.5, 96.0, 36.5],     // 喜马拉雅 - 青藏高原
  ['alpine', -76.0, -46.0, -67.0, -14.0], // 安第斯山脉
  ['alpine', 35.5, 7.0, 41.0, 12.5],      // 埃塞俄比亚高原
  ['alpine', 50.0, 30.0, 58.0, 35.0],     // 扎格罗斯 - 厄尔布尔士
  ['desert', 44.0, 27.0, 60.0, 31.0],     // 伊朗高原荒漠
  ['steppe', 27.0, 37.0, 45.0, 40.5],     // 安纳托利亚高原
  ['desert', 36.0, 15.0, 60.0, 29.0],     // 阿拉伯沙漠
  ['desert', 88.0, 36.5, 112.0, 46.0],    // 塔克拉玛干 - 戈壁
  ['desert', 117.0, -33.0, 148.0, -18.0], // 澳大利亚内陆
  ['desert', 12.0, -30.0, 26.0, -16.0],   // 卡拉哈里 - 纳米布
  ['desert', -72.0, -29.0, -66.0, -16.0], // 阿塔卡马 - 高原干旱带
  ['steppe', -72.0, -52.0, -63.0, -38.0], // 巴塔哥尼亚
  ['forest', -75.0, -10.0, -50.0, 5.0],   // 亚马逊雨林
  ['forest', 8.0, -8.0, 32.0, 5.0],       // 刚果雨林
];

/* 海峡连接 */
export const STRAITS = [
  { a: [-5.6, 36.0], b: [-5.35, 35.9], name: '直布罗陀海峡' },
  { a: [28.98, 41.02], b: [29.05, 41.05], name: '博斯普鲁斯海峡' },
  { a: [15.6, 38.05], b: [15.1, 38.2], name: '墨西拿海峡' },
  { a: [12.7, 55.9], b: [13.1, 55.5], name: '厄勒海峡' },
  { a: [9.5, 54.9], b: [11.0, 54.4], name: '丹麦海峡' },
  { a: [4.3, 51.95], b: [1.4, 51.1], name: '多佛海峡' },
  { a: [-0.8, 50.8], b: [-1.6, 48.7], name: '英吉利海峡' },
  { a: [18.1, 40.3], b: [18.5, 40.15], name: '奥特朗托海峡' },
  { a: [-80.0, 20.5], b: [-82.5, 25.0], name: '佛罗里达海峡' },  // 加勒比→大西洋
  { a: [-90.0, 27.0], b: [-89.0, 29.0], name: '密西西比河口' },  // 墨西哥湾通道
  { a: [120.0, 14.0], b: [121.0, 16.0], name: '吕宋海峡' },     // 南海→菲律宾海
  { a: [105.0, 1.0], b: [107.0, 3.0], name: '马六甲海峡' },     // 安达曼→马六甲
  { a: [-65.0, 18.0], b: [-64.0, 19.0], name: '向风海峡' },     // 加勒比岛屿间
];
