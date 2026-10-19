import production from "./production.css?inline";
import responsive from "./responsive.css?inline";
import bookshelf from "./screens/react-bookshelf-prototype.css?inline";
import create from "./screens/react-create-prototype.css?inline";
import home from "./screens/react-home-prototype.css?inline";
import library from "./screens/react-library-prototype.css?inline";
import memo from "./screens/react-memo-prototype.css?inline";
import onboarding from "./screens/react-onboarding-prototype.css?inline";
import organize from "./screens/react-organize-prototype.css?inline";
import search from "./screens/react-search-prototype.css?inline";
import supporting from "./screens/react-supporting-prototype.css?inline";
import settings from "./settings.css?inline";
import tokens from "./tokens.css?inline";

/** CSS bundled into the Shadow DOM boundary used by native Obsidian views. */
export const seitonStyles = [
  tokens,
  home,
  library,
  search,
  organize,
  memo,
  bookshelf,
  create,
  onboarding,
  supporting,
  settings,
  production,
  responsive,
].join("\n");
