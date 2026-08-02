# process_art.ps1 — 立绘后期处理：统一深色渐晕底 + 职业色调变体
# 背景清除采用"边缘泛洪填充"：只清除与图像边界连通的近白背景（棋盘格/白底），
# 不会误伤主体内部的白色（如宇航服）；玩家立绘额外做胸像裁剪，避开腿部封闭棋盘格区。
# 用法: powershell -File process_art.ps1 [-Stage player|enemies|all]
param([string]$Stage = 'all')
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;

public static class ArtProc
{
    // 背景基准色 #140806
    const int BR = 0x14, BG = 0x08, BB = 0x06;

    static bool IsBgLike(double r, double g, double b)
    {
        double mx = Math.Max(r, Math.Max(g, b));
        double mn = Math.Min(r, Math.Min(g, b));
        double sat = mx <= 0 ? 0 : (mx - mn) / mx;
        return mx > 185 && sat < 0.16; // 近白低饱和（含棋盘格双色）
    }

    public static void Process(string src, string dst, int size,
        double tintR, double tintG, double tintB,   // 色调乘数（1,1,1 = 不变）
        double vigStart, double vigEnd,             // 渐晕起止半径（0~1，相对半边长）
        bool floodWhite,                            // 是否泛洪清除边界连通的白背景
        int cropX, int cropY, int cropW, int cropH) // 源图裁剪区（cropW=0 表示不裁剪）
    {
        using (var full = new Bitmap(src))
        {
            Bitmap srcImg;
            if (cropW > 0 && cropH > 0)
                srcImg = full.Clone(new Rectangle(cropX, cropY, cropW, cropH), full.PixelFormat);
            else
                srcImg = (Bitmap)full.Clone();

            using (srcImg)
            using (var canvas = new Bitmap(size, size, PixelFormat.Format24bppRgb))
            {
            using (var g = Graphics.FromImage(canvas))
            {
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.Clear(Color.FromArgb(BR, BG, BB));
                // 等比覆盖裁剪（cover）
                double scale = Math.Max((double)size / srcImg.Width, (double)size / srcImg.Height);
                int w = (int)Math.Round(srcImg.Width * scale);
                int h = (int)Math.Round(srcImg.Height * scale);
                g.DrawImage(srcImg, (size - w) / 2, (size - h) / 2, w, h);
            }

            var rect = new Rectangle(0, 0, size, size);
            var data = canvas.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
            int stride = data.Stride;
            byte[] buf = new byte[stride * size];
            System.Runtime.InteropServices.Marshal.Copy(data.Scan0, buf, 0, buf.Length);

            // ---------- 1) 边缘泛洪：标记与边界连通的近白背景 ----------
            bool[] isBg = new bool[size * size];
            if (floodWhite)
            {
                var queue = new Queue<int>();
                Action<int, int> tryPush = (x, y) =>
                {
                    if (x < 0 || y < 0 || x >= size || y >= size) return;
                    int idx = y * size + x;
                    if (isBg[idx]) return;
                    int i = y * stride + x * 3;
                    if (IsBgLike(buf[i + 2], buf[i + 1], buf[i]))
                    {
                        isBg[idx] = true;
                        queue.Enqueue(idx);
                    }
                };
                for (int x = 0; x < size; x++) { tryPush(x, 0); tryPush(x, size - 1); }
                for (int y = 0; y < size; y++) { tryPush(0, y); tryPush(size - 1, y); }
                while (queue.Count > 0)
                {
                    int idx = queue.Dequeue();
                    int x = idx % size, y = idx / size;
                    tryPush(x + 1, y); tryPush(x - 1, y); tryPush(x, y + 1); tryPush(x, y - 1);
                }
            }

            // ---------- 2) 逐像素：替换背景 → 色调 → 渐晕 ----------
            double cx = size / 2.0, cy = size / 2.0, maxR = size / 2.0;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    int i = y * stride + x * 3;
                    double b = buf[i], gg = buf[i + 1], r = buf[i + 2];

                    if (floodWhite)
                    {
                        if (isBg[y * size + x])
                        {
                            r = BR; gg = BG; b = BB;
                        }
                        else
                        {
                            // 邻接背景的前景像素做半程羽化，消除白边
                            bool nearBg = false;
                            for (int dy = -1; dy <= 1 && !nearBg; dy++)
                                for (int dx2 = -1; dx2 <= 1 && !nearBg; dx2++)
                                {
                                    int nx = x + dx2, ny = y + dy;
                                    if (nx >= 0 && ny >= 0 && nx < size && ny < size && isBg[ny * size + nx])
                                        nearBg = true;
                                }
                            if (nearBg)
                            {
                                r = r * 0.5 + BR * 0.5; gg = gg * 0.5 + BG * 0.5; b = b * 0.5 + BB * 0.5;
                            }
                        }
                    }

                    // 职业色调
                    r *= tintR; gg *= tintG; b *= tintB;
                    if (r > 255) r = 255; if (gg > 255) gg = 255; if (b > 255) b = 255;

                    // 径向渐晕 → 边缘融入背景色
                    double ddx = (x - cx) / maxR, ddy = (y - cy) / maxR;
                    double dist = Math.Sqrt(ddx * ddx + ddy * ddy);
                    if (dist > vigStart)
                    {
                        double t = Math.Min(1.0, (dist - vigStart) / (vigEnd - vigStart));
                        t = t * t * (3 - 2 * t); // smoothstep
                        r = r * (1 - t) + BR * t;
                        gg = gg * (1 - t) + BG * t;
                        b = b * (1 - t) + BB * t;
                    }

                    buf[i] = (byte)b; buf[i + 1] = (byte)gg; buf[i + 2] = (byte)r;
                }
            }

            System.Runtime.InteropServices.Marshal.Copy(buf, 0, data.Scan0, buf.Length);
            canvas.UnlockBits(data);
            canvas.Save(dst, ImageFormat.Png);
            }
        }
    }
}
"@

$root = 'e:\Code\game\forcing-mars\assets'
$tmp  = "$root\_tmp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# ---------- 玩家四职业：宇航员原图 → 胸像裁剪 + 泛洪清底 + 渐晕 + 职业色调 ----------
if ($Stage -eq 'all' -or $Stage -eq 'player') {
    Copy-Item "$root\player\player_astronaut.png" "$tmp\astro_src.png" -Force
    # 裁剪胸像区（512×512 原图的上半身：头盔+胸甲，避开腰腿部封闭棋盘格）
    $cx = 96; $cy = 20; $cw = 340; $ch = 340
    # 宇航员（蓝调微冷）
    [ArtProc]::Process("$tmp\astro_src.png", "$root\player\player_astronaut.png", 512, 0.95, 1.0, 1.12, 0.55, 0.98, $true, $cx, $cy, $cw, $ch)
    # 工程兵（绿调）
    [ArtProc]::Process("$tmp\astro_src.png", "$root\player\player_engineer.png", 512, 0.82, 1.12, 0.85, 0.55, 0.98, $true, $cx, $cy, $cw, $ch)
    # 异变者（紫调）
    [ArtProc]::Process("$tmp\astro_src.png", "$root\player\player_mutant.png", 512, 1.05, 0.80, 1.18, 0.55, 0.98, $true, $cx, $cy, $cw, $ch)
    # 突击兵（红调）
    [ArtProc]::Process("$tmp\astro_src.png", "$root\player\player_assault.png", 512, 1.18, 0.82, 0.78, 0.55, 0.98, $true, $cx, $cy, $cw, $ch)
}

# ---------- 敌人六图：统一渐晕；白底图开泛洪清底 ----------
if ($Stage -eq 'all' -or $Stage -eq 'enemies') {
    $enemies = @(
        @{ f = 'enemy_mars_leech.png';        key = $false },  # 棕色底，渐晕即可
        @{ f = 'enemy_dune_stalker.png';      key = $false },  # 沙色底接近生物色，仅渐晕
        @{ f = 'enemy_red_crawler.png';       key = $false },
        @{ f = 'enemy_crystal_parasite.png';  key = $false },
        @{ f = 'enemy_deep_lurker.png';       key = $false },
        @{ f = 'enemy_mars_devourer.png';     key = $true  }   # 纯白底，必须清除
    )
    foreach ($e in $enemies) {
        $p = "$root\enemies\$($e.f)"
        Copy-Item $p "$tmp\e_src.png" -Force
        [ArtProc]::Process("$tmp\e_src.png", $p, 512, 1.0, 1.0, 1.0, 0.60, 1.0, $e.key, 0, 0, 0, 0)
    }
}

Remove-Item -Recurse -Force $tmp
Write-Host 'DONE'
