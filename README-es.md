# Seiton

[English](README.md) · [日本語](README-ja.md) · [Deutsch](README-de.md) · [Español](README-es.md) · [Français](README-fr.md) · [한국어](README-ko.md) · [Português](README-pt_BR.md) · [简体中文](README-zh_cn.md)

Guarda primero; encuentra y reutiliza después.

Seiton es un plugin de Obsidian para conservar notas, referencias, tareas y lecturas en un Vault basado en Markdown. Al guardar algo no hace falta decidir la carpeta ni las etiquetas: déjalo en la bandeja de entrada y organízalo cuando lo necesites.

> Las capturas y el GIF usan notas ficticias. Seiton aún no aparece en el directorio de plugins de Obsidian.

![Flujo de Seiton: guardar, explorar y organizar](docs/images/readme/workflow.gif)

## Instalar la versión de desarrollo

Requiere Obsidian 1.13.7 o posterior. Para compilar el código fuente también necesitas Git, Node.js y npm. Aún no está disponible en el directorio de plugins de la comunidad.

1. Obtén el código fuente y compílalo:

   ```sh
   git clone https://github.com/ishibashi-c/obsidian-seiton.git
   cd obsidian-seiton
   npm ci
   npm run build
   ```

2. Crea `<Vault>/.obsidian/plugins/seiton/` y copia allí `main.js`, `manifest.json` y `styles.css` desde el repositorio.
3. Vuelve a cargar Obsidian y activa Seiton en **Ajustes → Plugins de la comunidad**. En la configuración inicial, elige el idioma, los tipos activos y los módulos opcionales.

## Guardar, encontrar y organizar

1. Escribe una idea rápida en Inicio o crea una nota estructurada.
2. Deja en la bandeja lo que aún no puedas clasificar. El tipo, la carpeta y las etiquetas pueden esperar.
3. Busca en las notas de Seiton y en las carpetas adicionales configuradas o explora la biblioteca por carpeta, tipo, etiqueta y lista.
4. Cuando sea útil, cambia la carpeta o los metadatos de una nota, o muévela al archivo.

### Elegir los módulos opcionales

Inicio, Buscar, Biblioteca, organización de la bandeja y Archivo cubren el flujo principal. Módulos opcionales como Estantería, revisión de memos, tarjetas enriquecidas y barra del editor se pueden activar o desactivar en Ajustes.

<details>
<summary>Ver capturas de Inicio, Biblioteca y organización</summary>

![Inicio con captura rápida y accesos principales](docs/images/readme/home.png)

![Biblioteca con filtros de carpeta, tipo y lista](docs/images/readme/library.png)

![Bandeja con metadatos editables](docs/images/readme/organize.png)

</details>

## Tus notas y el acceso a la red

Las notas siguen siendo archivos Markdown normales dentro del Vault. Seiton conserva los campos frontmatter desconocidos y las notas locales siguen disponibles sin conexión. Capturar, buscar y organizar no requiere IA.

### Herramientas externas de IA opcionales

Seiton no incluye ni llama a un modelo de IA, y no envía el contenido del Vault a servicios de IA. Si usas una herramienta externa, puede preparar una propuesta de organización en Markdown. Revisa en Seiton las ubicaciones y los metadatos propuestos, y elige qué cambios aplicar.

### Funciones que usan la red

Seiton no tiene cuenta alojada, analítica, telemetría, anuncios ni LLM integrado. Las solicitudes de red se limitan a funciones activadas o usadas de forma explícita, como los metadatos de clips web, la búsqueda de libros y la consulta opcional de bibliotecas japonesas. Consulta [privacidad y red](docs/privacy-and-network.md) para conocer los destinos y datos. No guardes como clip una URL con tokens privados.

Los clips web obtienen metadatos e imágenes de la página guardada y de los servidores de imágenes que esta declara. El servicio de favicons de Google proporciona iconos de dominio alternativos. openBD y Open Library proporcionan metadatos por ISBN y portadas; Open Library también permite buscar por título y autor.

### Restricciones de dominio para tarjetas enriquecidas

En los ajustes puedes añadir y quitar dominios bloqueados uno por uno. Con dominios bloqueados, las solicitudes automáticas de tarjetas y títulos usan un transporte del navegador que rechaza las redirecciones. Si hay una redirección o CORS impide acceder a la respuesta, se muestra una tarjeta solo con la URL. Las notas y las URL guardadas siguen disponibles. Se omiten las imágenes que no se pueden obtener de forma segura y los favicons remotos; las imágenes de la caché local se comprueban según la configuración actual. Las tarjetas existentes se actualizan al cambiarla. Sin dominios bloqueados, se usa el transporte habitual de Obsidian.

La consulta de fondos mediante Calil y la búsqueda de municipios y direcciones mediante la autoridad geoespacial de Japón (GSI) solo están disponibles en la interfaz japonesa y están destinadas a bibliotecas de Japón. Calil requiere tu propia clave de API. Estas funciones de biblioteca se ocultan en otros idiomas; la Estantería y la búsqueda de libros siguen disponibles.

## Desarrollo

| Comando | Función |
|---|---|
| `npm test` | Ejecutar pruebas |
| `npm run build` | Comprobar tipos y compilar el plugin |
| `npm run harness` | Abrir UI Lab |
| `npm run lint` | Ejecutar lint |
| `npm run release:check` | Ejecutar pruebas, ambas compilaciones y controles de publicación |

[Especificación del producto](spec.md) · [Plan de implementación](docs/implementation-roadmap.md) · [Rutas y datos de prueba de UI Lab](docs/ui-mock-map.md) · [Lista de comprobación de publicación](docs/release-checklist.md) · [Normas de desarrollo](AGENTS.md)

## Licencia y fuentes de datos

MIT © 2026 IshibashiCustomize. Consulta [LICENSE](LICENSE) y [avisos de terceros](THIRD_PARTY_NOTICES.md). Fuentes de datos y portadas: [openBD](https://openbd.jp/) y [Open Library](https://openlibrary.org/developers/api).
