# izCAD — Üçüncü Taraf Açık Kaynak Bildirimleri

Son güncelleme: 27 Temmuz 2026

Bu belge, izCAD Android uygulamasının çalışma zamanında kullanılan başlıca
üçüncü taraf bileşenleri listeler. Kullanılmayan LibreDWG çalışma zamanı
projeden ve dağıtım varlıklarından kaldırılmıştır.

## Çalışma zamanı bileşenleri

| Bileşen | Sürüm | Lisans | Tam lisans metni |
|---|---:|---|---|
| React ve React DOM | 19.1.1 | MIT | `LICENSE-REACT-MIT.txt` |
| Three.js | 0.161.0 | MIT | `LICENSE-THREE-MIT.txt` |
| dxf-viewer | 1.0.48 | MPL-2.0 | `LICENSE-MPL-2.0.txt` |
| dxf-viewer içindeki dxf-parser türevi | 1.0.48 ile birlikte | MIT | `LICENSE-DXF-PARSER-MIT.txt` |
| @capacitor/core ve @capacitor/android | 8.4.2 | MIT | `LICENSE-CAPACITOR-MIT.txt` |
| @capacitor/browser | 8.0.4 | MIT | `LICENSE-CAPACITOR-MIT.txt` |
| @mlightcad/libdxfrw-web | 0.1.0 | GPL-2.0-only | `LICENSE` |
| Liberation Sans tabanlı IzCadSans-Regular.ttf | 2.1.5 | SIL Open Font License 1.1 | `LICENSE-FONT-OFL-1.1.txt` |
| AndroidX, Android Core SplashScreen ve Apache Cordova Android çalışma zamanı | Gradle dosyalarında sabitlenen sürümler | Apache License 2.0 | `LICENSE-APACHE-2.0.txt` |

Bağımlılıkların kaynak depoları:

- React: https://github.com/facebook/react
- Three.js: https://github.com/mrdoob/three.js
- dxf-viewer: https://github.com/vagran/dxf-viewer
- Capacitor: https://github.com/ionic-team/capacitor
- libdxfrw-web: https://github.com/mlight-lee/libdxfrw
- AndroidX: https://github.com/androidx/androidx
- Apache Cordova Android: https://github.com/apache/cordova-android

## Telif bildirimleri

- React: Copyright (c) Meta Platforms, Inc. and affiliates.
- Three.js: Copyright © 2010-2024 three.js authors.
- dxf-viewer: Copyright (c) 2024 SIA SPH Engineering ve katkıda bulunanlar.
- dxf-parser türevi: Copyright (c) 2015 GDS Storefront Estimating.
- Capacitor: Copyright (c) 2017-present Drifty Co.
- Liberation font verileri: Copyright (c) 2010 Google Corporation ve
  Copyright (c) 2012 Red Hat, Inc. Reserved Font Name bilgileri font lisans
  metninde yer alır.

libdxfrw için ayrıntılı telif bildirimleri, karşılık gelen kaynak kod
dağıtımındaki dosya başlıklarında korunmalıdır.

## GPL-2.0-only dağıtım notu

izCAD'in DWG motoru `@mlightcad/libdxfrw-web@0.1.0` ve uygulamanın ana lisansı
GPL-2.0-only'dir. Bir APK başka kişilere verildiğinde, APK ile birebir eşleşen
tam kaynak kodunun erişilebilir olması gerekir. GitHub yayını en az şunları
içermelidir:

- izCAD kaynak kodunun APK ile eşleşen sürüm etiketi,
- `package-lock.json` ve kullanılan tüm derleme betikleri,
- libdxfrw/libdxfrw-web kaynaklarının tam sürümü veya commit'i,
- Varsa izCAD için yapılan değişiklikler ve yamalar,
- WASM dosyasını yeniden üretmek için gereken talimatlar.

APK için bir GitHub Release oluşturulmalı ve source tag ile APK sürümü aynı
olmalıdır. libdxfrw'nin karşılık gelen kaynak arşivi de aynı release altında
sunulmalı veya aynı kolaylıkta erişilebilir kesin bir kaynak adresi
verilmelidir.

Bu dosya açık kaynak bildirimidir; hukuki görüş değildir.
