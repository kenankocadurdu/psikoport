"use client";

/**
 * Psikoport Kullanım Kılavuzu — yazdırılabilir / PDF olarak kaydet
 * Tarayıcıdan Ctrl+P → "PDF Olarak Kaydet" ile indirilebilir.
 */
export default function GuidePage() {
  return (
    <div className="min-h-screen bg-white text-black font-sans print:p-0">
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Print butonu — sayfaya basıldığında görünmez */}
      <div className="no-print flex justify-end gap-3 px-6 pt-4 pb-2 border-b bg-gray-50">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 cursor-pointer"
        >
          PDF olarak kaydet / Yazdır
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-100 cursor-pointer"
        >
          Kapat
        </button>
      </div>

      <div className="mx-auto max-w-2xl px-8 py-10 space-y-8">
        {/* Başlık */}
        <div className="border-b pb-6 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold tracking-tight">Psikoport</span>
            <span className="inline-block size-1.5 rounded-full bg-rose-500 mb-2" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Hızlı Başlangıç Kılavuzu</h1>
          <p className="text-sm text-gray-500">
            İlk giriş, iki faktörlü doğrulama kurulumu ve temel kullanım
          </p>
        </div>

        {/* Bölüm 1 */}
        <section className="space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-xs font-bold shrink-0">1</span>
            İlk Girişinizi Yapın
          </h2>
          <ol className="list-none space-y-2 text-sm text-gray-700 pl-8">
            <li className="flex gap-2"><span className="font-semibold shrink-0">a)</span> Tarayıcınızda <strong>app.psikoport.com</strong> adresine gidin.</li>
            <li className="flex gap-2"><span className="font-semibold shrink-0">b)</span> <strong>Giriş Yap</strong> butonuna tıklayın. Auth0 giriş ekranına yönlendirileceksiniz.</li>
            <li className="flex gap-2"><span className="font-semibold shrink-0">c)</span> Kayıt sırasında kullandığınız <strong>e-posta</strong> ve <strong>şifrenizi</strong> girin.</li>
            <li className="flex gap-2"><span className="font-semibold shrink-0">d)</span> İlk girişte 2FA kurulum adımına yönlendirileceksiniz (aşağıdaki bölüme bakın).</li>
          </ol>
        </section>

        {/* Bölüm 2 */}
        <section className="space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">2</span>
            İki Faktörlü Doğrulama (2FA) Kurulumu
          </h2>
          <p className="text-sm text-gray-700 pl-8">
            Hesabınızın güvenliği için 2FA zorunludur. Kurulum yalnızca bir kez yapılır.
          </p>
          <ol className="list-none space-y-2 text-sm text-gray-700 pl-8">
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">a)</span>
              Telefonunuza <strong>Google Authenticator</strong> veya <strong>Authy</strong> uygulamalarından birini kurun
              (App Store / Google Play üzerinden ücretsiz).
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">b)</span>
              Sisteme ilk girişte ekranınızda bir <strong>QR kodu</strong> göreceksiniz.
              Uygulamayı açın, "+" veya "Hesap ekle" seçeneğine dokunun ve QR kodu okutun.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">c)</span>
              Uygulama her 30 saniyede bir <strong>6 haneli kod</strong> üretecektir.
              Bu kodu giriş ekranına girin ve kurulumu tamamlayın.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">d)</span>
              Sonraki girişlerde şifrenizi girdikten sonra uygulamadaki güncel kodu girmeniz yeterlidir.
            </li>
          </ol>
          <div className="ml-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>Önemli:</strong> QR kodunu yedeklemeniz önerilir. Telefonunuzu kaybederseniz
            destek ekibimize başvurarak hesabınıza erişimi yeniden sağlayabilirsiniz.
          </div>
        </section>

        {/* Bölüm 3 */}
        <section className="space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">3</span>
            Temel Özellikler
          </h2>
          <div className="pl-8 grid gap-2 text-sm text-gray-700">
            {[
              ["Danışanlar", "Sol menüden Danışanlar bölümüne girerek yeni danışan ekleyebilir, profil ve seans geçmişini görüntüleyebilirsiniz."],
              ["Takvim & Randevular", "Takvim ekranından seans randevusu oluşturabilir, hatırlatma bildirimlerini yönetebilirsiniz."],
              ["Seans Notları", "Her danışan kaydında güvenli (şifreli) seans notu ekleyebilirsiniz. Notlar yalnızca sizin tarafınızdan okunabilir."],
              ["Psikometrik Testler", "Testler bölümünden danışanlarınıza dijital test formu gönderebilir, sonuçları otomatik olarak raporlayabilirsiniz."],
              ["Gelir Takibi", "Finans ekranından seans ödemelerini kayıt altına alabilir, aylık gelir özetini görüntüleyebilirsiniz."],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-2">
                <span className="mt-0.5 text-rose-500 shrink-0">▸</span>
                <div>
                  <span className="font-semibold">{title}: </span>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bölüm 4 */}
        <section className="space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0">4</span>
            Destek & İletişim
          </h2>
          <div className="pl-8 text-sm text-gray-700 space-y-1">
            <p>Sorularınız için ticket sistemi üzerinden bize ulaşabilirsiniz:</p>
            <p><strong>E-posta:</strong> destek@psikoport.com</p>
            <p><strong>Destek saatleri:</strong> 08:00 – 20:00</p>
            <p><strong>Ticket paneli:</strong> Sistem içi Ayarlar → Destek menüsünden</p>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t pt-4 text-xs text-gray-400 flex justify-between">
          <span>© {new Date().getFullYear()} Psikoport. Tüm hakları saklıdır.</span>
          <span>app.psikoport.com</span>
        </div>
      </div>
    </div>
  );
}
