# Seiton

[English](README.md) · [日本語](README-ja.md) · [Deutsch](README-de.md) · [Español](README-es.md) · [Français](README-fr.md) · [한국어](README-ko.md) · [Português](README-pt_BR.md) · [简体中文](README-zh_cn.md)

Erst festhalten, später wiederfinden und verwenden.

Seiton ist ein Obsidian-Plugin für Notizen, Quellen, Aufgaben und Lesedokumentation in einem Markdown-basierten Vault. Beim Erfassen müssen Sie weder Ordner noch Tags festlegen: Lassen Sie einen Eintrag im Eingang und finden oder ordnen Sie ihn später.

> Die Screenshots und das GIF verwenden erfundene Beispieldaten. Seiton ist derzeit nicht im Obsidian-Community-Verzeichnis gelistet.

![Seiton-Ablauf: erfassen, durchsuchen und ordnen](docs/images/readme/workflow.gif)

## Entwicklungsversion installieren

Erfordert Obsidian 1.13.7 oder neuer. Zum Bauen aus dem Quellcode werden außerdem Git, Node.js und npm benötigt. Die Installation aus dem Community-Verzeichnis ist noch nicht verfügbar.

1. Quellcode herunterladen und bauen:

   ```sh
   git clone https://github.com/ishibashi-c/obsidian-seiton.git
   cd obsidian-seiton
   npm ci
   npm run build
   ```

2. Erstellen Sie `<Vault>/.obsidian/plugins/seiton/` und kopieren Sie `main.js`, `manifest.json` und `styles.css` aus dem Repository hinein.
3. Laden Sie Obsidian neu und aktivieren Sie Seiton unter **Einstellungen → Community-Plugins**. Wählen Sie bei der Ersteinrichtung Sprache, aktive Typen und optionale Module.

## Erfassen, finden und ordnen

1. Halten Sie einen Gedanken auf der Startseite fest oder erstellen Sie eine strukturierte Notiz.
2. Lassen Sie noch nicht eingeordnete Inhalte im Eingang. Typ, Ordner und Tags können später festgelegt werden.
3. Durchsuchen Sie Seiton-Notizen und konfigurierte zusätzliche Ordner oder finden Sie Inhalte in der Bibliothek nach Ordner, Typ, Tag und Liste.
4. Ändern Sie bei Bedarf den Speicherort oder Metadaten, oder verschieben Sie eine Notiz ins Archiv.

### Optionale Module auswählen

Startseite, Suche, Bibliothek, Eingang und Archiv unterstützen den Hauptablauf. Optionale Module wie Leseregal, Memo-Rückblick, Rich Cards und Editor-Symbolleiste lassen sich in den Einstellungen ein- oder ausschalten.

<details>
<summary>Screenshots von Startseite, Bibliothek und Organisation anzeigen</summary>

![Startseite mit Schnellerfassung und Hauptbereichen](docs/images/readme/home.png)

![Bibliothek mit Filtern für Ordner, Typ und Liste](docs/images/readme/library.png)

![Eingang mit bearbeitbaren Metadaten](docs/images/readme/organize.png)

</details>

## Notizen und Netzwerkzugriff

Notizen bleiben gewöhnliche Markdown-Dateien im Vault. Unbekannte Frontmatter-Felder bleiben erhalten, und lokale Notizen sind auch ohne Netzwerk verfügbar. Erfassen, Suchen und Organisieren funktionieren ohne KI.

### Externe KI-Werkzeuge sind optional

Seiton enthält kein KI-Modell und sendet Vault-Inhalte nicht an einen KI-Dienst. Wenn Sie ein externes KI-Werkzeug verwenden, kann es einen Markdown-Organisierungsvorschlag erstellen. Prüfen Sie die vorgeschlagenen Verschiebungen und Metadaten in Seiton und wählen Sie aus, was angewendet wird.

### Funktionen mit Netzwerkzugriff

Seiton hat kein gehostetes Konto, keine Analyse, Telemetrie, Werbung oder integriertes LLM. Netzwerkaufrufe gehören zu ausdrücklich verwendeten Funktionen wie Web-Clip-Metadaten, Buchsuche und der optionalen japanischen Bibliothekssuche. Ziele und Daten sind unter [Datenschutz und Netzwerk](docs/privacy-and-network.md) beschrieben. Speichern Sie keine URLs mit privaten Tokens als Web-Clips.

Für Web-Clips werden Metadaten und Bilder von der gespeicherten Webseite und ihren Bildservern abgerufen. Googles Favicon-Dienst liefert Ersatzsymbole für Domains. openBD und Open Library liefern ISBN-Metadaten und Cover; Open Library übernimmt auch die Suche nach Titel und Autor.

Die Bestandsuche über Calil und die Orts- und Adresssuche über die japanische Geospatial Information Authority (GSI) sind nur in der japanischen Oberfläche verfügbar und für Bibliotheken in Japan vorgesehen. Calil erfordert einen eigenen API-Schlüssel. In anderen Oberflächensprachen werden diese Bibliotheksfunktionen ausgeblendet. Bücherregal und Buchsuche bleiben verfügbar.

## Entwicklung

| Befehl | Zweck |
|---|---|
| `npm test` | Tests ausführen |
| `npm run build` | Typen prüfen und Plugin bauen |
| `npm run harness` | UI Lab starten |
| `npm run lint` | Lint-Prüfungen ausführen |
| `npm run release:check` | Tests, beide Builds und Release-Dateien prüfen |

[Produktspezifikation](spec.md) · [Implementierungsplan](docs/implementation-roadmap.md) · [UI-Lab-Routen und Testdaten](docs/ui-mock-map.md) · [Release-Checkliste](docs/release-checklist.md) · [Entwicklungsregeln](AGENTS.md)

## Lizenz und Datenquellen

MIT © 2026 IshibashiCustomize. Siehe [LICENSE](LICENSE) und [Drittanbieterhinweise](THIRD_PARTY_NOTICES.md). Buchdaten und Cover: [openBD](https://openbd.jp/) und [Open Library](https://openlibrary.org/developers/api).
