## Frontend Modulleri Hakkinda Kisa Notlar

Tüm ekranlar `DOF` modülünde kaydedilen API bağlantısı **ve (gerekliyse)** token bilgisini kullanır. `DISABLE_AUTH=true` ise token alanı boş bırakılabilir.

- **Dashboard**  
  `GET /dashboard/stats` çağrısı ile belge, şikayet ve CAPA özetini gösterir.

- **Dokümanlar**  
  `GET /documents` sonucunu departman/durum filtreleriyle listeler.

- **Şikayetler**  
  `GET /complaints` verisini öncelik ve durum etiketleriyle sunar.

- **CAPA**  
  `GET /capas` üzerinden CAPA kayıtlarını hedef tarihlerle gösterir.

- **Risk & Ekipman**  
  `GET /dof-tasks/report/summary` ile DOF verisinden türetilen erken uyarı panelleri sağlar.

- **Denetimler**  
  CAPA listesini referans alarak audit özeti oluşturur, örnek denetim planı içerir.

API bağlantısını değiştirdiğinizde sayfaları yenilemeniz yeterlidir; modüller aynı yerel depolama anahtarlarını (`dof_api_url`, `dof_token`) paylaşır.
