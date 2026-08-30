export interface Song {
  id: string;
  title: string;
  artist: string;
  src: string;      // 对应 public/music/ 中的音频文件名
  cover: string;    // 专辑封面图片链接或本地路径
  duration: string; // 歌曲时长展示
  lyrics?: string;  // LRC 格式歌词
}

export const XANTHANL_PLAYLIST: Song[] = [
  {
    id: "1",
    title: "Electric Mirage",
    artist: "XanthanL",
    src: "music/Electric Mirage.mp3",
    cover: "images/Electric-Mirage.jpg",
    duration: "03:45",
    lyrics: "[00:00.00]Electric Mirage\n[00:04.00]作曲 : XanthanL\n[00:08.00]编曲 : XanthanL\n[00:12.00]欢迎来到我的音乐世界"
  },
  {
    id: "2",
    title: "Glass Candle",
    artist: "XanthanL",
    src: "music/Glass Candle.mp3",
    cover: "images/Electric-Mirage.jpg",
    duration: "04:12",
    lyrics: "[00:00.00]Glass Candle\n[00:05.00]制作人 : XanthanL"
  },
  {
    id: "3",
    title: "Les Nuits",
    artist: "XanthanL",
    src: "music/Les Nuits.mp3",
    cover: "images/Electric-Mirage.jpg",
    duration: "04:50"
  },
  {
    id: "4",
    title: "Midnight Chill",
    artist: "XanthanL",
    src: "music/Midnight Chill.mp3",
    cover: "images/Electric-Mirage.jpg",
    duration: "03:30"
  },
  {
    id: "5",
    title: "spring 2 summer",
    artist: "XanthanL",
    src: "music/spring 2 summer.mp3",
    cover: "images/Electric-Mirage.jpg",
    duration: "03:15"
  }
];
