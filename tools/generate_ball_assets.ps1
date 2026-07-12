Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "..\miniprogram\assets\balls"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$balls = @(
  @{id="B01_SPIKE"; color="#3f6f55"; accent="#b8ffd0"; icon="spike"; material="toxicMetal"},
  @{id="B02_SWORD"; color="#4fb8ff"; accent="#f6fbff"; icon="sword"; material="energy"},
  @{id="B03_ARCHER"; color="#21cbbd"; accent="#d8fff9"; icon="bow"; material="aero"},
  @{id="B04_THREAD"; color="#43df72"; accent="#e2ffbf"; icon="thread"; material="venomGlass"},
  @{id="B05_LANCE"; color="#f0c64b"; accent="#fff7b8"; icon="lance"; material="goldArmor"},
  @{id="B06_CHAIN"; color="#a83c46"; accent="#ffe0d5"; icon="hammer"; material="heavyArmor"},
  @{id="B07_SAW"; color="#24476f"; accent="#bde8ff"; icon="saw"; material="sawSteel"},
  @{id="B08_FLAME"; color="#ff6b25"; accent="#ffe0aa"; icon="flame"; material="magma"},
  @{id="B09_FROST"; color="#8fdcff"; accent="#f1fbff"; icon="frost"; material="ice"},
  @{id="B10_ARC"; color="#fff05c"; accent="#ffffff"; icon="arc"; material="electric"},
  @{id="B11_CANNON"; color="#395dcc"; accent="#ffc36b"; icon="cannon"; material="gunmetal"},
  @{id="B12_RICOCHET"; color="#aa92ff"; accent="#ffffff"; icon="dagger"; material="polished"},
  @{id="B13_MINE"; color="#ffd536"; accent="#27221a"; icon="mine"; material="warning"},
  @{id="B14_SHIELD"; color="#63d7ff"; accent="#f2fdff"; icon="shield"; material="barrier"},
  @{id="B15_DRILL"; color="#34b9b4"; accent="#fff1a6"; icon="drill"; material="machine"},
  @{id="B16_BOOMERANG"; color="#55d976"; accent="#e4ffe8"; icon="boomerang"; material="wind"},
  @{id="B17_LASER"; color="#d8ffff"; accent="#ffffff"; icon="laser"; material="lens"},
  @{id="B18_VENOM"; color="#67ff5c"; accent="#eaffea"; icon="venom"; material="bubbles"},
  @{id="B19_STAR"; color="#9c75ff"; accent="#f0e7ff"; icon="star"; material="cosmic"},
  @{id="B20_SHRAPNEL"; color="#ffad3d"; accent="#fff0c8"; icon="shrapnel"; material="fracture"},
  @{id="B21_HARPOON"; color="#9aa6ae"; accent="#eff5f8"; icon="harpoon"; material="cable"},
  @{id="B22_PRISM"; color="#d7b8ff"; accent="#eaffff"; icon="prism"; material="crystal"},
  @{id="B23_PULSE"; color="#6f7cff"; accent="#f0edff"; icon="pulse"; material="force"},
  @{id="B24_ANCHOR"; color="#8db7c8"; accent="#e9fbff"; icon="anchor"; material="anchorSteel"}
)

function ColorFromHex($hex, $alpha = 255) {
  $h = $hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb($alpha, [Convert]::ToInt32($h.Substring(0,2),16), [Convert]::ToInt32($h.Substring(2,2),16), [Convert]::ToInt32($h.Substring(4,2),16))
}

function Darken($color, [double]$amount) {
  return [System.Drawing.Color]::FromArgb($color.A, [Math]::Max(0, [int]($color.R * $amount)), [Math]::Max(0, [int]($color.G * $amount)), [Math]::Max(0, [int]($color.B * $amount)))
}

function Lighten($color, [int]$amount) {
  return [System.Drawing.Color]::FromArgb($color.A, [Math]::Min(255, $color.R + $amount), [Math]::Min(255, $color.G + $amount), [Math]::Min(255, $color.B + $amount))
}

function Draw-Star($g, $cx, $cy, $outer, $inner, $points, $pen, $fill = $null) {
  $pts = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
  for ($i=0; $i -lt $points*2; $i++) {
    $r = if ($i % 2 -eq 0) { $outer } else { $inner }
    $a = -[Math]::PI/2 + $i * [Math]::PI / $points
    $pts.Add([System.Drawing.PointF]::new($cx + [Math]::Cos($a)*$r, $cy + [Math]::Sin($a)*$r))
  }
  if ($fill -ne $null) { $g.FillPolygon($fill, $pts.ToArray()) }
  $g.DrawPolygon($pen, $pts.ToArray())
}

function Draw-Material($g, $material, $base, $accent) {
  $softPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, $accent), 4)
  $hardPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(125, $accent), 5)
  $softBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(80, $accent))
  switch ($material) {
    "heavyArmor" { for ($i=0; $i -lt 4; $i++) { $g.DrawArc($hardPen, 44, 62 + $i*26, 168, 44, 190, 160) } }
    "sawSteel" { for ($i=0; $i -lt 22; $i++) { $a=$i*[Math]::PI*2/22; $g.DrawLine($hardPen,128+[Math]::Cos($a)*83,128+[Math]::Sin($a)*83,128+[Math]::Cos($a)*103,128+[Math]::Sin($a)*103) } }
    "magma" { for ($i=0; $i -lt 5; $i++) { $g.DrawBezier($hardPen, 58+$i*25, 190, 72+$i*20, 134, 102+$i*12, 116, 92+$i*20, 58) } }
    "ice" { for ($i=0; $i -lt 7; $i++) { $a=$i*[Math]::PI*2/7; $g.DrawLine($softPen,128,128,128+[Math]::Cos($a)*90,128+[Math]::Sin($a)*90) } }
    "electric" { $g.DrawLines($hardPen, @([System.Drawing.PointF]::new(54,88),[System.Drawing.PointF]::new(116,112),[System.Drawing.PointF]::new(92,134),[System.Drawing.PointF]::new(166,164),[System.Drawing.PointF]::new(146,188),[System.Drawing.PointF]::new(206,200))) }
    "warning" { for ($i=0; $i -lt 8; $i++) { $a=$i*[Math]::PI*2/8; $g.FillRectangle($softBrush, 124 + [Math]::Cos($a)*65, 124 + [Math]::Sin($a)*65, 9, 9) } }
    "crystal" { $g.DrawPolygon($softPen, @([System.Drawing.Point]::new(128,44),[System.Drawing.Point]::new(208,164),[System.Drawing.Point]::new(128,214),[System.Drawing.Point]::new(48,164))) }
    "fracture" { $g.DrawLines($hardPen, @([System.Drawing.PointF]::new(70,70),[System.Drawing.PointF]::new(116,122),[System.Drawing.PointF]::new(96,184))); $g.DrawLines($softPen, @([System.Drawing.PointF]::new(180,62),[System.Drawing.PointF]::new(136,128),[System.Drawing.PointF]::new(190,188))) }
    default { for ($i=0; $i -lt 5; $i++) { $y = 76 + $i * 24; $g.DrawArc($softPen, 50, $y - 40, 156, 80, 195, 150) } }
  }
  $softPen.Dispose(); $hardPen.Dispose(); $softBrush.Dispose()
}

function Draw-Icon($g, $icon, $accent) {
  $pen = [System.Drawing.Pen]::new($accent, 8)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(180, $accent))
  switch ($icon) {
    "spike" { for ($i=0; $i -lt 12; $i++) { $a=$i*[Math]::PI*2/12; $g.DrawLine($pen,128+[Math]::Cos($a)*24,128+[Math]::Sin($a)*24,128+[Math]::Cos($a)*78,128+[Math]::Sin($a)*78) } }
    "sword" { $g.DrawLine($pen, 178, 54, 88, 176); $g.DrawLine($pen, 94, 154, 140, 198); $g.DrawLine($pen, 116, 160, 150, 132) }
    "bow" { $g.DrawArc($pen, 72, 54, 88, 148, -72, 144); $g.DrawLine($pen, 104, 58, 104, 198); $g.DrawLine($pen, 92, 128, 188, 128) }
    "thread" { $g.DrawBezier($pen, 52, 86, 94, 32, 164, 220, 204, 164); $g.DrawBezier($pen, 52, 166, 94, 224, 164, 36, 204, 92) }
    "lance" { $g.DrawLine($pen, 54, 128, 202, 128); $g.DrawLine($pen, 202, 128, 150, 90); $g.DrawLine($pen, 202, 128, 150, 166) }
    "hammer" { $g.FillRectangle($brush, 70, 82, 88, 56); $g.DrawRectangle($pen, 70, 82, 88, 56); $g.DrawLine($pen, 138, 134, 194, 194) }
    "saw" { $g.DrawEllipse($pen, 66, 66, 124, 124); for ($i=0; $i -lt 18; $i++) { $a=$i*[Math]::PI*2/18; $g.DrawLine($pen,128+[Math]::Cos($a)*52,128+[Math]::Sin($a)*52,128+[Math]::Cos($a)*76,128+[Math]::Sin($a)*76) } }
    "flame" { $path = [System.Drawing.Drawing2D.GraphicsPath]::new(); $path.AddBezier(128,48,206,104,158,196,128,208); $path.AddBezier(128,208,62,154,118,100,128,48); $g.DrawPath($pen,$path); $path.Dispose() }
    "frost" { for ($i=0; $i -lt 6; $i++) { $a=$i*[Math]::PI*2/6; $g.DrawLine($pen,128,128,128+[Math]::Cos($a)*78,128+[Math]::Sin($a)*78) } }
    "arc" { $g.DrawLines($pen, @([System.Drawing.PointF]::new(66,76),[System.Drawing.PointF]::new(136,112),[System.Drawing.PointF]::new(108,136),[System.Drawing.PointF]::new(192,180))) }
    "cannon" { $g.FillEllipse($brush, 70, 82, 116, 92); $g.FillRectangle($brush, 126, 104, 68, 48); $g.DrawEllipse($pen, 70, 82, 116, 92) }
    "dagger" { $g.DrawPolygon($pen, @([System.Drawing.Point]::new(198,128),[System.Drawing.Point]::new(128,76),[System.Drawing.Point]::new(58,128),[System.Drawing.Point]::new(128,180))) }
    "mine" { $g.DrawEllipse($pen, 62, 62, 132, 132); for ($i=0; $i -lt 8; $i++) { $a=$i*[Math]::PI*2/8; $g.FillEllipse($brush, 128+[Math]::Cos($a)*66-9,128+[Math]::Sin($a)*66-9,18,18) } }
    "shield" { $g.DrawArc($pen, 56, 54, 144, 144, 14, 152); $g.DrawLine($pen, 72, 132, 128, 202); $g.DrawLine($pen, 184, 132, 128, 202) }
    "drill" { $g.DrawPolygon($pen, @([System.Drawing.Point]::new(202,128),[System.Drawing.Point]::new(72,82),[System.Drawing.Point]::new(72,174))) }
    "boomerang" { $g.DrawArc($pen, 54, 54, 148, 148, -58, 132); $g.DrawArc($pen, 86, 86, 86, 86, -58, 132) }
    "laser" { $g.DrawLine($pen, 50, 128, 206, 128); $g.DrawEllipse($pen, 76, 76, 104, 104) }
    "venom" { $g.FillEllipse($brush, 88, 88, 80, 80); $g.FillEllipse($brush, 52, 152, 28, 28); $g.FillEllipse($brush, 178, 70, 26, 26) }
    "star" { Draw-Star $g 128 128 80 34 5 $pen $null }
    "shrapnel" { $g.DrawPolygon($pen, @([System.Drawing.Point]::new(68,80),[System.Drawing.Point]::new(190,114),[System.Drawing.Point]::new(108,190))) }
    "harpoon" { $g.DrawLine($pen, 58, 128, 200, 128); $g.DrawLine($pen, 200, 128, 150, 88); $g.DrawLine($pen, 200, 128, 150, 168); $g.DrawEllipse($pen, 84, 102, 52, 52) }
    "prism" { $g.DrawPolygon($pen, @([System.Drawing.Point]::new(128,46),[System.Drawing.Point]::new(202,172),[System.Drawing.Point]::new(54,172))) }
    "pulse" { $g.DrawEllipse($pen, 62, 62, 132, 132); $g.DrawEllipse($pen, 92, 92, 72, 72) }
    "anchor" { $g.DrawLine($pen, 50, 128, 206, 128); $g.DrawLine($pen, 66, 82, 36, 128); $g.DrawLine($pen, 66, 174, 36, 128); $g.DrawLine($pen, 190, 82, 220, 128); $g.DrawLine($pen, 190, 174, 220, 128) }
  }
  $pen.Dispose(); $brush.Dispose()
}

foreach ($ball in $balls) {
  $bmp = [System.Drawing.Bitmap]::new(256,256,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $base = ColorFromHex $ball.color
  $accent = ColorFromHex $ball.accent
  $dark = Darken $base 0.34
  $hot = Lighten $accent 18
  $rim = [System.Drawing.Color]::FromArgb(235, $accent)

  $glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(34, $accent))
  $g.FillEllipse($glow, 8, 8, 240, 240)
  $glow.Dispose()

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddEllipse(24,24,208,208)
  $brush = [System.Drawing.Drawing2D.PathGradientBrush]::new($path)
  $brush.CenterPoint = [System.Drawing.PointF]::new(86,68)
  $brush.CenterColor = $hot
  $brush.SurroundColors = @($dark)
  $g.FillEllipse($brush,24,24,208,208)
  $brush.Dispose()

  Draw-Material $g $ball.material $base $accent

  $rimPen = [System.Drawing.Pen]::new($rim, 9)
  $g.DrawEllipse($rimPen, 27, 27, 202, 202)
  $rimPen.Dispose()

  if ($ball.icon -eq "spike") {
    $spikeBrush = [System.Drawing.SolidBrush]::new($accent)
    for ($i=0; $i -lt 12; $i++) {
      $a = $i * [Math]::PI * 2 / 12
      $p1 = [System.Drawing.PointF]::new(128 + [Math]::Cos($a - 0.11)*100, 128 + [Math]::Sin($a - 0.11)*100)
      $p2 = [System.Drawing.PointF]::new(128 + [Math]::Cos($a)*126, 128 + [Math]::Sin($a)*126)
      $p3 = [System.Drawing.PointF]::new(128 + [Math]::Cos($a + 0.11)*100, 128 + [Math]::Sin($a + 0.11)*100)
      $g.FillPolygon($spikeBrush, @($p1,$p2,$p3))
    }
    $spikeBrush.Dispose()
  }

  Draw-Icon $g $ball.icon $accent

  $shine = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(125,255,255,255))
  $g.FillEllipse($shine, 58, 48, 58, 30)
  $shine.Dispose()

  $path.Dispose(); $g.Dispose()
  $file = Join-Path $outDir ($ball.id + ".png")
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Write-Output "Generated $($balls.Count) premium ball assets in $outDir"
