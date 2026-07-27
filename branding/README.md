# izCAD ikon kaynakları

Android launcher ikonları bu klasördeki kaynaklardan hazırlanmıştır:

1. `icon-only.png` — legacy launcher ikonlarının 1024×1024 kaynağı.
2. `icon-foreground.png` — adaptive launcher ön planının 1024×1024 kaynağı.
3. `icon-background.png` — `#081019` renkli adaptive arka plan.
4. `play-store-icon.png` — Google Play için 512×512, 32-bit PNG.

İkon içinde küçük yazı kullanılmamalı; ana işaret farklı launcher maskelerinde
kesilmemesi için merkeze ve güvenli alana yerleştirilmelidir.

Uygulamanın gerçek Android kaynakları aşağıdaki klasörlere üretilmiştir:

```text
android/app/src/main/res/mipmap-mdpi/
android/app/src/main/res/mipmap-hdpi/
android/app/src/main/res/mipmap-xhdpi/
android/app/src/main/res/mipmap-xxhdpi/
android/app/src/main/res/mipmap-xxxhdpi/
android/app/src/main/res/mipmap-anydpi-v26/
android/app/src/main/res/drawable-v24/
```

Android launcher kaynakları hazırdır. Yeniden üretim yapılacaksa master
dosyaları doğrudan `mipmap-*` klasörlerine kopyalamak yerine Android Studio
Image Asset aracı kullanılmalıdır.

Özel splash görseli kullanılmayacaktır. Android 12 ve üzerindeki zorunlu sistem
başlangıç ekranı tamamen kaldırılamaz; ikon ve düz tema arka planıyla kısa bir
sistem geçişi olarak görünür.
