# Seiton

[English](README.md) · [日本語](README-ja.md) · [Deutsch](README-de.md) · [Español](README-es.md) · [Français](README-fr.md) · [한국어](README-ko.md) · [Português](README-pt_BR.md) · [简体中文](README-zh_cn.md)

Notez d’abord, retrouvez et réutilisez plus tard.

Seiton est un plugin Obsidian pour conserver notes, références, tâches et lectures dans un Vault au format Markdown. Il n’est pas nécessaire de choisir tout de suite un dossier ou des tags : laissez l’élément dans la boîte de réception et organisez-le plus tard.

> Les captures et le GIF utilisent des notes fictives. Seiton ne figure pas encore dans l’annuaire des plugins Obsidian.

![Parcours Seiton : noter, parcourir et organiser](docs/images/readme/workflow.gif)

## Installer la version de développement

Obsidian 1.13.7 ou une version ultérieure est nécessaire. La compilation requiert aussi Git, Node.js et npm. L’installation depuis l’annuaire communautaire n’est pas encore disponible.

1. Récupérez le code source et compilez-le :

   ```sh
   git clone https://github.com/ishibashi-c/obsidian-seiton.git
   cd obsidian-seiton
   npm ci
   npm run build
   ```

2. Créez `<Vault>/.obsidian/plugins/seiton/`, puis copiez-y `main.js`, `manifest.json` et `styles.css` depuis le dépôt.
3. Rechargez Obsidian et activez Seiton dans **Paramètres → Plugins communautaires**. Lors de la configuration initiale, choisissez la langue, les types actifs et les modules facultatifs.

## Noter, retrouver et organiser

1. Notez une idée rapide depuis l’accueil ou créez une note structurée.
2. Laissez dans la boîte de réception les éléments difficiles à classer. Le type, le dossier et les tags peuvent attendre.
3. Recherchez dans les notes Seiton et les dossiers supplémentaires configurés ou parcourez la bibliothèque par dossier, type, tag et liste.
4. Quand c’est utile, changez le dossier ou les métadonnées d’une note, ou déplacez-la dans les archives.

### Choisir les modules facultatifs

Accueil, Recherche, Bibliothèque, organisation de la boîte de réception et Archives couvrent le parcours principal. Les modules facultatifs — bibliothèque de lecture, rétrospective des mémos, cartes enrichies et barre d’outils de l’éditeur — peuvent être activés ou désactivés dans les paramètres.

<details>
<summary>Voir les captures de l’accueil, de la bibliothèque et de l’organisation</summary>

![Accueil avec saisie rapide et accès principaux](docs/images/readme/home.png)

![Bibliothèque avec filtres de dossier, type et liste](docs/images/readme/library.png)

![Boîte de réception avec métadonnées modifiables](docs/images/readme/organize.png)

</details>

## Vos notes et les accès réseau

Les notes restent des fichiers Markdown ordinaires dans le Vault. Seiton conserve les champs frontmatter inconnus et les notes locales restent utilisables sans réseau. La saisie, la recherche et l’organisation ne nécessitent pas d’IA.

### Outils d’IA externes facultatifs

Seiton n’intègre pas de modèle d’IA et n’envoie pas le contenu du Vault à un service d’IA. Si vous utilisez un outil externe, il peut préparer une proposition d’organisation en Markdown. Examinez les déplacements et métadonnées proposés dans Seiton, puis choisissez les changements à appliquer.

### Fonctions utilisant le réseau

Seiton n’a ni compte hébergé, ni analytics, ni télémétrie, ni publicité, ni LLM intégré. Les requêtes réseau concernent seulement des fonctions utilisées ou activées, comme les métadonnées de clips Web, la recherche de livres et la recherche facultative de bibliothèques japonaises. Consultez [confidentialité et réseau](docs/privacy-and-network.md) pour les destinations et les données. N’enregistrez pas d’URL contenant des jetons privés comme clip Web.

Les clips Web récupèrent les métadonnées et les images de la page enregistrée et de ses serveurs d’images. Le service de favicons de Google fournit les icônes de domaine de remplacement. openBD et Open Library fournissent les métadonnées ISBN et les couvertures ; Open Library permet aussi la recherche par titre et auteur.

### Restrictions de domaine des cartes enrichies

Les paramètres permettent d’ajouter et de supprimer les domaines bloqués un par un. Lorsque des domaines sont bloqués, les requêtes automatiques de cartes et de titres utilisent le navigateur et refusent les redirections. En cas de redirection ou de réponse inaccessible à cause de CORS, la carte affiche uniquement l’URL. Les notes et les URL enregistrées restent disponibles. Les images impossibles à récupérer de façon sûre et les favicons distants sont omis ; les images du cache local sont vérifiées selon le réglage actuel. Les cartes existantes sont actualisées après une modification. Sans domaine bloqué, Seiton utilise le transport Obsidian habituel.

La recherche de disponibilité via Calil et la recherche de communes et d’adresses via l’autorité géospatiale du Japon (GSI) sont réservées à l’interface japonaise et aux bibliothèques du Japon. Calil nécessite votre propre clé API. Ces fonctions sont masquées dans les autres langues ; la Bibliothèque de lecture et la recherche de livres restent disponibles.

## Développement

| Commande | Fonction |
|---|---|
| `npm test` | Exécuter les tests |
| `npm run build` | Vérifier les types et compiler le plugin |
| `npm run harness` | Ouvrir UI Lab |
| `npm run lint` | Exécuter le lint |
| `npm run release:check` | Exécuter les tests, les deux compilations et les contrôles de publication |

[Spécification du produit](spec.md) · [Plan d’implémentation](docs/implementation-roadmap.md) · [Routes et jeux de données UI Lab](docs/ui-mock-map.md) · [Liste de vérification avant publication](docs/release-checklist.md) · [Règles de développement](AGENTS.md)

## Licence et sources des données

MIT © 2026 IshibashiCustomize. Voir [LICENSE](LICENSE) et [mentions tierces](THIRD_PARTY_NOTICES.md). Sources des données et couvertures : [openBD](https://openbd.jp/) et [Open Library](https://openlibrary.org/developers/api).
