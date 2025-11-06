import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useApiConnection } from "./useApiConnection";

const renderBlock = (block, index) => {
  if (!block) {
    return null;
  }
  const key = `block-${index}-${block.type}`;

  if (block.type === "paragraph" && block.text) {
    return (
      <p key={key} className="deployment-block deployment-block--paragraph">
        {block.text}
      </p>
    );
  }

  if (block.type === "unordered_list" && block.items?.length) {
    return (
      <ul key={key} className="deployment-block deployment-block--list">
        {block.items.map((item, itemIndex) => (
          <li key={`${key}-item-${itemIndex}`}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "ordered_list" && block.items?.length) {
    return (
      <ol key={key} className="deployment-block deployment-block--list ordered">
        {block.items.map((item, itemIndex) => (
          <li key={`${key}-item-${itemIndex}`}>{item}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "code") {
    const codeText = (block.lines || []).join("\n");
    return (
      <pre key={key} className="deployment-block deployment-block--code">
        <code>{codeText}</code>
      </pre>
    );
  }

  return null;
};

const DeploymentGuideModule = () => {
  const { apiUrl, headers, isReady, authDisabled, refresh } = useApiConnection();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const deploymentEndpoint = useMemo(() => {
    if (!apiUrl) {
      return "";
    }
    return `${apiUrl}/meta/deployment-guide`;
  }, [apiUrl]);

  const fetchGuide = useCallback(async () => {
    if (!deploymentEndpoint) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(deploymentEndpoint, { headers });
      setGuide(data);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Dagitim rehberi alinamadi.";
      setError(message);
      setGuide(null);
    } finally {
      setLoading(false);
    }
  }, [deploymentEndpoint, headers]);

  useEffect(() => {
    if (!isReady) {
      setGuide(null);
      return;
    }
    fetchGuide();
  }, [fetchGuide, isReady]);

  const handleRefresh = () => {
    if (!isReady) {
      refresh();
      return;
    }
    fetchGuide();
  };

  const connectionWarning = !isReady;

  const onPremSection = useMemo(() => {
    if (!guide?.sections) {
      return null;
    }
    return guide.sections.find((section) =>
      section?.title?.toLowerCase().includes("on-prem")
    );
  }, [guide]);

  const cloudSection = useMemo(() => {
    if (!guide?.sections) {
      return null;
    }
    return guide.sections.find((section) =>
      section?.title?.toLowerCase().includes("cloud")
    );
  }, [guide]);

  const renderSubsections = (subsections) => {
    if (!subsections || !subsections.length) {
      return null;
    }
    return subsections.map((subsection, subIndex) => (
      <div
        key={`subsection-${subIndex}-${subsection.title}`}
        className="deployment-subsection"
      >
        <h3>{subsection.title}</h3>
        {subsection.blocks?.map((block, blockIndex) =>
          renderBlock(block, `${subIndex}-${blockIndex}`)
        )}
      </div>
    ));
  };

  const renderSection = (section, index) => (
    <Card key={`section-${index}-${section.title}`} className="deployment-section-card">
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
        {section.body ? <CardDescription>{section.body}</CardDescription> : null}
      </CardHeader>
      <CardContent className="deployment-section-content">
        {section.blocks?.map((block, blockIndex) =>
          renderBlock(block, `${index}-block-${blockIndex}`)
        )}
        {renderSubsections(section.subsections)}
      </CardContent>
    </Card>
  );

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Dagitim Rehberi</h1>
          <p>Bulut ve on-premise QDMS kurulum adimlarini tek ekrandan takip edin.</p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          Yenile
        </Button>
      </header>

      {connectionWarning && (
        <Card className="deployment-connection-hint">
          <CardHeader>
            <CardTitle>API baglantisi bekleniyor</CardTitle>
            <CardDescription>
              Dagitim rehberini yuklemek icin DOF sayfasindan API adresi ve token bilgisini girin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              {authDisabled
                ? "Kimlik dogrulama kapaliysa yalnizca API adresini kaydetmeniz yeterlidir."
                : "Kimlik dogrulama aktifse gecerli bir token tanimlamadan rehber yuklenemez."}
            </p>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="error-box">
          <CardContent>
            <strong>Hata:</strong> {error}
          </CardContent>
        </Card>
      )}

      {loading && !guide && (
        <Card>
          <CardHeader>
            <CardTitle>Dagitim rehberi yukleniyor...</CardTitle>
          </CardHeader>
        </Card>
      )}

      {guide && (
        <div className="deployment-guide-grid">
          {onPremSection && (
            <Card className="deployment-highlight-card">
              <CardHeader>
                <CardTitle>On-Premise Kurulum Ozeti</CardTitle>
                <CardDescription>
                  Sirket ici kurulum icin on kosullar ve ana adimlarin hizli ozeti.
                </CardDescription>
              </CardHeader>
              <CardContent className="deployment-highlight-content">
                {renderSubsections(onPremSection.subsections)}
              </CardContent>
            </Card>
          )}

          {cloudSection && (
            <Card className="deployment-highlight-card">
              <CardHeader>
                <CardTitle>Bulut (SaaS) Kurulum Ozeti</CardTitle>
                <CardDescription>
                  Container tabanli bulut dagitimi icin gereksinimler ve adimlar.
                </CardDescription>
              </CardHeader>
              <CardContent className="deployment-highlight-content">
                {renderSubsections(cloudSection.subsections)}
              </CardContent>
            </Card>
          )}

          {guide.sections.map((section, index) => renderSection(section, index))}
        </div>
      )}
    </div>
  );
};

export default DeploymentGuideModule;
