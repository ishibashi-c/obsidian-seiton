import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Lang, t } from "../src/shared/i18n";
import { getProductionDialogCloseButtonLabel } from "../src/ui/patterns/ProductionDialog";
import { Alert, getModalCloseButtonLabel, Select } from "../src/ui/primitives";

describe("localized primitive defaults", () => {
  it.each(["ja", "fr"] as const)(
    "renders legal controls with %s labels",
    (lang: Lang) => {
      const alert = renderToStaticMarkup(
        createElement(
          Alert,
          { lang, onClose: () => undefined, withCloseButton: true },
          "Saved"
        )
      );
      const select = renderToStaticMarkup(
        createElement(Select, {
          clearable: true,
          data: [{ label: "Option", value: "option" }],
          label: "Choice",
          lang,
        })
      );

      expect(alert).toContain(`aria-label="${t(lang, "notify.close")}"`);
      expect(select).toContain(`for="seiton-select-`);
      expect(select).toContain(
        `<option value="" selected="">${t(lang, "common.selectPlaceholder")}</option>`
      );
      expect(select).toContain('<option value="option">Option</option>');
      expect(getModalCloseButtonLabel(lang)).toBe(t(lang, "notify.close"));
      expect(getProductionDialogCloseButtonLabel(lang)).toBe(
        t(lang, "notify.close")
      );
    }
  );
});
