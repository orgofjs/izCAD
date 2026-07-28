export type Locale = "en" | "tr";

const translations = {
  en: {
    tagline: "CAD drawings, clearly.",
    description: "Open DXF and DWG files directly on your device.",
    openDrawing: "Open drawing",
    chooseAnother: "Open another",
    supportedFormats: "DXF & DWG",
    offline: "100% offline",
    privateFiles: "Your files never leave this device.",
    privacyAndLicenses: "Privacy & licenses",
    sourceCode: "Source code",
    loading: "Opening drawing…",
    reading: "Reading file…",
    converting: "Converting DWG…",
    fetch: "Loading drawing…",
    parse: "Reading geometry…",
    prepare: "Preparing view…",
    font: "Preparing text…",
    errorTitle: "Drawing could not be opened",
    tryAgain: "Choose another file",
    unsupportedFormat: "Only DXF and DWG files are supported.",
    fileReadFailed: "The selected file could not be read.",
    dxfOpenFailed: "The DXF file could not be opened.",
    dwgConversionFailed: "The DWG file could not be converted.",
    dwgUnsupportedVersion:
      "This DWG version is not supported by the current drawing engine.",
    dwgCorruptOrEncrypted:
      "The DWG header could not be read. The file may be damaged, incomplete, or protected.",
    dwgParseFailed:
      "The DWG contains data or drawing objects that the current engine could not read.",
    dwgExportFailed:
      "The DWG was read, but a valid drawing could not be prepared for display.",
    dwgMemoryLimit:
      "This drawing exceeded the memory available to the DWG engine on this device.",
    dwgConversionTimeout:
      "Converting this DWG took too long and was stopped.",
    dwgRuntimeMissing:
      "DWG support is not installed in this build. Add the offline LibreDWG runtime.",
    dwgDiagnosticVersion: "DWG version",
    dwgDiagnosticEngineCode: "Engine code",
    renderFailed: "This drawing could not be rendered on this device.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Fit to screen",
    reset: "Reset view",
    close: "Close drawing",
    cancel: "Cancel",
    fileSize: "File size",
    language: "Language",
  },
  tr: {
    tagline: "CAD çizimleri, net biçimde.",
    description: "DXF ve DWG dosyalarını doğrudan cihazınızda açın.",
    openDrawing: "Çizim aç",
    chooseAnother: "Başka dosya aç",
    supportedFormats: "DXF & DWG",
    offline: "%100 çevrimdışı",
    privateFiles: "Dosyalarınız bu cihazdan dışarı çıkmaz.",
    privacyAndLicenses: "Gizlilik ve lisanslar",
    sourceCode: "Kaynak kodu",
    loading: "Çizim açılıyor…",
    reading: "Dosya okunuyor…",
    converting: "DWG dönüştürülüyor…",
    fetch: "Çizim yükleniyor…",
    parse: "Geometri okunuyor…",
    prepare: "Görünüm hazırlanıyor…",
    font: "Metin hazırlanıyor…",
    errorTitle: "Çizim açılamadı",
    tryAgain: "Başka bir dosya seç",
    unsupportedFormat: "Yalnızca DXF ve DWG dosyaları desteklenir.",
    fileReadFailed: "Seçilen dosya okunamadı.",
    dxfOpenFailed: "DXF dosyası açılamadı.",
    dwgConversionFailed: "DWG dosyası dönüştürülemedi.",
    dwgUnsupportedVersion:
      "Bu DWG sürümü mevcut çizim motoru tarafından desteklenmiyor.",
    dwgCorruptOrEncrypted:
      "DWG başlığı okunamadı. Dosya bozuk, eksik veya korumalı olabilir.",
    dwgParseFailed:
      "DWG, mevcut motorun okuyamadığı veriler veya çizim nesneleri içeriyor.",
    dwgExportFailed:
      "DWG okundu ancak görüntüleme için geçerli bir çizim hazırlanamadı.",
    dwgMemoryLimit:
      "Bu çizim, cihazda DWG motoruna ayrılabilen bellek sınırını aştı.",
    dwgConversionTimeout:
      "Bu DWG'nin dönüştürülmesi çok uzun sürdüğü için işlem durduruldu.",
    dwgRuntimeMissing:
      "Bu derlemede DWG desteği kurulu değil. Çevrimdışı LibreDWG çalışma dosyalarını ekleyin.",
    dwgDiagnosticVersion: "DWG sürümü",
    dwgDiagnosticEngineCode: "Motor kodu",
    renderFailed: "Bu çizim cihazda görüntülenemedi.",
    zoomIn: "Yakınlaştır",
    zoomOut: "Uzaklaştır",
    fit: "Ekrana sığdır",
    reset: "Görünümü sıfırla",
    close: "Çizimi kapat",
    cancel: "İptal",
    fileSize: "Dosya boyutu",
    language: "Dil",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export function translate(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
