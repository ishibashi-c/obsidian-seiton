import { type Lang, t } from "../../shared/i18n";
import { Text } from "../primitives";

export function BookDataNotice({ lang }: { lang: Lang }) {
  return (
    <Text size="sm">
      {t(lang, "book.networkNotice")}
      <br />
      <a href="https://openbd.jp/terms/" rel="noreferrer" target="_blank">
        openBD: {t(lang, "book.dataTerms")}
      </a>
      {" / "}
      <a
        href="https://openlibrary.org/developers/licensing"
        rel="noreferrer"
        target="_blank"
      >
        Open Library: {t(lang, "book.dataTerms")}
      </a>
    </Text>
  );
}
