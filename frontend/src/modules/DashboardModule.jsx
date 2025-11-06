import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useApiConnection } from "./useApiConnection";
import { formatDate, formatDateTime, formatNumber } from "./formatters";

const DashboardModule = () => {
  const { apiUrl, headers, isReady, authDisabled, refresh } = useApiConnection();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchOverview = useCallback(async () => {
    if (!isReady) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${apiUrl}/dashboard/overview`, {
        headers,
      });
      setOverview(data);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Veri yuklenemedi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  useEffect(() => {
    if (!isReady) {
      setOverview(null);
      return;
    }
    fetchOverview();
  }, [fetchOverview, isReady]);

  const handleRetry = () => {
    if (!isReady) {
      refresh();
      return;
    }
    fetchOverview();
  };

  const connectionWarning = !isReady;

  const totals = useMemo(() => {
    if (!overview) {
      return [];
    }
    return [
      {
        key: "documents",
        title: "Dokumanlar",
        section: overview.documents,
        description: "Onay ve okuma takibi",
      },
      {
        key: "complaints",
        title: "Sikayetler",
        section: overview.complaints,
        description: "Acil takip gerektiren kayitlar",
      },
      {
        key: "capas",
        title: "CAPA",
        section: overview.capas,
        description: "Duzeltici/Onleyici faaliyetler",
      },
      {
        key: "dof",
        title: "DOF Gorevleri",
        section: overview.dof,
        description: "Planli bakım ve aksiyonlar",
      },
    ];
  }, [overview]);

  const renderItems = (items, emptyMessage) => {
    if (!items || items.length === 0) {
      return <p>{emptyMessage}</p>;
    }
    return (
      <ul className="history-list">
        {items.map((item) => (
          <li key={`${item.module}-${item.id}`}>
            <div className="history-header">
              <div>
                <strong>{item.title}</strong>
                {item.code && (
                  <span style={{ marginLeft: "6px", color: "#64748b" }}>
                    {item.code}
                  </span>
                )}
              </div>
              {item.status && <Badge variant="neutral">{item.status}</Badge>}
            </div>
            <div className="history-meta">
              {item.due_date ? `Hedef: ${formatDate(item.due_date)}` : null}
              {item.description && (
                <span style={{ display: "block", marginTop: "4px" }}>
                  {item.description}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Kontrol Paneli</h1>
          <p>Modullere yayilan bekleyen gorevleri tek ekrandan takip edin.</p>
        </div>
        <Button variant="outline" onClick={handleRetry}>
          Yenile
        </Button>
      </header>

      <section className="module-grid">
        {[
          { path: "/documents", title: "Dokumanlar", description: "Dokuman listesine git" },
          { path: "/complaints", title: "Sikayetler", description: "Sikayet kayitlarini incele" },
          { path: "/capas", title: "CAPA", description: "CAPA durumlarini guncelle" },
          { path: "/dof", title: "DOF Gorevleri", description: "Planli gorevleri yonet" },
        ].map((shortcut) => (
          <Card key={shortcut.path}>
            <CardHeader>
              <CardTitle>{shortcut.title}</CardTitle>
              <CardDescription>{shortcut.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => navigate(shortcut.path)}
              >
                Ac
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {connectionWarning && (
        <Card>
          <CardHeader>
            <CardTitle>Baglanti Bekleniyor</CardTitle>
            <CardDescription>
              API adresi ve gerekirse token bilgisinin DOF sayfasindan girilmesi
              gerekir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Sol menuden &quot;DOF Gorevleri&quot; sayfasini acip API baglantisini
              kaydedin.{" "}
              {authDisabled
                ? "Kimlik dogrulama kapaliysa sadece API adresini girmeniz yeterli."
                : "Token olmadan veri cekilemez."}
            </p>
            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button onClick={handleRetry}>Baglantiyi Kontrol Et</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Hata</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Veriler yukleniyor...</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Lutfen bekleyin.</p>
          </CardContent>
        </Card>
      )}

      {overview && !loading && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Genel Durum</CardTitle>
              <CardDescription>Toplam kayitlar ve bekleyen gorevler.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="stats-grid">
                {totals.map(({ key, title, section, description }) => (
                  <div className="stat-card" key={key}>
                    <span>{title}</span>
                    <strong>{formatNumber(section.total)}</strong>
                    <small>
                      Acik: {formatNumber(section.open)} • Bekleyen:{" "}
                      {formatNumber(section.pending)}
                    </small>
                    <small>{description}</small>
                  </div>
                ))}
                <div className="stat-card">
                  <span>Bildirimler</span>
                  <strong>{formatNumber(overview.notifications)}</strong>
                  <small>Okunmamis bildirimler</small>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dokuman Gorevleri</CardTitle>
              <CardDescription>Onay ve okuma gorevleri listesini inceleyin.</CardDescription>
            </CardHeader>
            <CardContent>
              {renderItems(
                overview.documents.items,
                "Bekleyen dokuman goreviniz bulunmuyor."
              )}
            </CardContent>
          </Card>

          <div className="module-grid">
            <Card>
              <CardHeader>
                <CardTitle>Sikayetler</CardTitle>
                <CardDescription>Acil takip gerektiren sikayet kayitlari.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderItems(
                  overview.complaints.items,
                  "Acil takip gerektiren sikayet bulunmuyor."
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>CAPA Kayıtları</CardTitle>
                <CardDescription>Duzeltici/Onleyici aksiyonların durumu.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderItems(
                  overview.capas.items,
                  "Bekleyen CAPA kaydi bulunmuyor."
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>DOF Gorevleri</CardTitle>
                <CardDescription>Planli bakım ve aksiyon listesi.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderItems(
                  overview.dof.items,
                  "Bekleyen DOF gorevi bulunmuyor."
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardModule;
