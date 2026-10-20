/** @jsxImportSource react */

import { useState } from "react";
import type { AgentGuideChoice } from "../../features/onboarding/agentGuide";
import {
  ONBOARDING_PRESETS,
  type OnboardingPreset,
} from "../../features/onboarding/presets";
import { ITEM_TYPES } from "../../shared/constants";
import { LANGS, type Lang, type MessageKey, t } from "../../shared/i18n";
import { DEFAULT_FEATURE_MODULES } from "../../shared/settings";
import type { FeatureModules, ItemType } from "../../shared/types";
import { AnimatePresence, motion, useReducedMotion } from "../motion";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Radio,
  Select,
  Text,
  TextInput,
  Title,
} from "../primitives";

const MODULE_KEYS: (keyof FeatureModules)[] = [
  "bookshelf",
  "richCards",
  "memos",
  "editorToolbar",
  "agentGuide",
];
const LANGUAGE_NAMES: Record<Lang, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  ja: "日本語",
  ko: "한국어",
  "pt-BR": "Português (Brasil)",
  "zh-CN": "简体中文",
};
const GROUPS: Record<string, ItemType[]> = {
  その他: ["profile"],
  創る: ["idea", "article", "project"],
  学ぶ: ["class", "reading", "task"],
  日々の記録: ["memo"],
  集める: ["webclip", "collection"],
};

export interface OnboardingDraft {
  guideChoice: AgentGuideChoice;
  lang: Lang;
  modules: FeatureModules;
  preset: OnboardingPreset | null;
  rootFolder: string;
  searchFolders: string;
  sharedDefault: "memo" | "idea";
  types: ItemType[];
}

export interface OnboardingFlowProps {
  initialGuideChoice?: AgentGuideChoice;
  initialLang?: Lang;
  initialModules?: FeatureModules;
  initialPreset?: OnboardingPreset | null;
  initialRootFolder?: string;
  initialSearchFolders?: string;
  initialSharedDefault?: "memo" | "idea";
  initialTypes?: ItemType[];
  onFinish?: (draft: OnboardingDraft) => Promise<void> | void;
  surfaceClassName: string;
}

const defaultModules = (): FeatureModules => ({ ...DEFAULT_FEATURE_MODULES });

export function AgentGuideChoiceField({
  guideChoice,
  lang,
  onChange,
}: {
  guideChoice: AgentGuideChoice;
  lang: Lang;
  onChange: (value: AgentGuideChoice) => void;
}) {
  return (
    <fieldset className="react-onboarding-guide-fieldset">
      <legend>{t(lang, "onboarding.agentGuide")}</legend>
      <Group gap="md">
        <Radio
          checked={guideChoice === "none"}
          label={t(lang, "onboarding.agentGuide.none")}
          name="agent-guide-choice"
          onChange={() => onChange("none")}
          value="none"
        />
        <Radio
          checked={guideChoice === "create"}
          label={t(lang, "onboarding.agentGuide.create")}
          name="agent-guide-choice"
          onChange={() => onChange("create")}
          value="create"
        />
        <Radio
          checked={guideChoice === "propose"}
          label={t(lang, "onboarding.agentGuide.propose")}
          name="agent-guide-choice"
          onChange={() => onChange("propose")}
          value="propose"
        />
      </Group>
    </fieldset>
  );
}

export function ReactOnboardingFlow({
  initialLang = "ja",
  initialPreset,
  initialTypes = ONBOARDING_PRESETS.basic.types,
  initialModules = defaultModules(),
  initialRootFolder = "Seiton",
  initialSearchFolders = "03_資料",
  initialSharedDefault = "memo",
  initialGuideChoice = "create",
  onFinish,
  surfaceClassName,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [lang, setLang] = useState<Lang>(initialLang);
  const [preset, setPreset] = useState<OnboardingPreset | null>(
    initialPreset ?? null
  );
  const [types, setTypes] = useState<ItemType[]>([...initialTypes]);
  const [modules, setModules] = useState<FeatureModules>({ ...initialModules });
  const [rootFolder, setRootFolder] = useState(initialRootFolder);
  const [searchFolders, setSearchFolders] = useState(initialSearchFolders);
  const [sharedDefault, setSharedDefault] = useState<"memo" | "idea">(
    initialSharedDefault
  );
  const [guideChoice, setGuideChoice] =
    useState<AgentGuideChoice>(initialGuideChoice);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const reduceMotion = useReducedMotion();

  const applyPreset = (value: OnboardingPreset): void => {
    setPreset(value);
    setTypes([...ONBOARDING_PRESETS[value].types]);
    setModules((current) => ({
      ...current,
      ...ONBOARDING_PRESETS[value].modules,
    }));
  };

  const finish = async (): Promise<void> => {
    setError("");
    try {
      await onFinish?.({
        guideChoice,
        lang,
        modules: { ...modules },
        preset,
        rootFolder,
        searchFolders,
        sharedDefault,
        types: [...types],
      });
      setSaved(true);
    } catch {
      setError(t(lang, "notify.saveError"));
    }
  };

  const typeValues = Object.values(GROUPS)
    .flat()
    .filter(
      (value, index, all) =>
        all.indexOf(value) === index && ITEM_TYPES.includes(value)
    );

  return (
    <section
      aria-labelledby="react-onboarding-title"
      className={`${surfaceClassName} react-onboarding-flow`}
    >
      <div className="react-onboarding-panel-heading">
        <div>
          <Title id="react-onboarding-title" order={2} size="h2">
            {t(lang, `onboarding.step${step}` as MessageKey)}
          </Title>
        </div>
        {preset ? (
          <Badge color="ink" variant="outline">
            {t(lang, `onboarding.preset.${preset}` as MessageKey)}
          </Badge>
        ) : null}
      </div>
      <ol
        aria-label={t(lang, `onboarding.step${step}` as MessageKey)}
        className="react-onboarding-progress"
      >
        {["onboarding.step1", "onboarding.step2", "onboarding.step3"].map(
          (key, index) => (
            <li
              className={
                index + 1 === step
                  ? "is-current"
                  : index + 1 < step
                    ? "is-done"
                    : ""
              }
              key={key}
            >
              <span>{index + 1}</span>
              <strong>{t(lang, key as MessageKey)}</strong>
            </li>
          )
        )}
      </ol>

      <AnimatePresence initial={false} mode="wait">
        {step === 1 && (
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="react-onboarding-step seiton-react-onboarding-modal-step"
            exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
            initial={reduceMotion ? false : { opacity: 0, x: 8 }}
            key="step1"
          >
            <Text className="react-onboarding-description">
              {t(lang, "onboarding.languageHint")}
            </Text>
            <Select
              comboboxProps={{ withinPortal: false }}
              data={LANGS.map((value) => ({
                label: LANGUAGE_NAMES[value],
                value,
              }))}
              label={t(lang, "onboarding.step1")}
              onChange={(value) => setLang((value as Lang | null) ?? "ja")}
              value={lang}
            />
            <div className="react-onboarding-preview">
              <Text fw={700} size="sm">
                {t(lang, "onboarding.step1Preview")}
              </Text>
              <Text className="react-onboarding-muted" size="sm">
                {t(lang, "onboarding.step1PreviewDescription")}
              </Text>
              <Badge color="accent" variant="light">
                {LANGUAGE_NAMES[lang]}
              </Badge>
            </div>
          </motion.section>
        )}
        {step === 2 && (
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="react-onboarding-step seiton-react-onboarding-modal-step"
            exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
            initial={reduceMotion ? false : { opacity: 0, x: 8 }}
            key="step2"
          >
            <Text className="react-onboarding-description">
              {t(lang, "onboarding.step2Description")}
            </Text>
            <div className="react-onboarding-preset-grid">
              {(Object.keys(ONBOARDING_PRESETS) as OnboardingPreset[]).map(
                (value) => (
                  <button
                    aria-pressed={preset === value}
                    className={`react-onboarding-preset ${preset === value ? "is-selected" : ""}`}
                    key={value}
                    onClick={() => applyPreset(value)}
                    type="button"
                  >
                    <strong>
                      {t(lang, `onboarding.preset.${value}` as MessageKey)}
                    </strong>
                    <span>
                      {t(lang, `onboarding.preset.${value}.desc` as MessageKey)}
                    </span>
                  </button>
                )
              )}
            </div>
            <fieldset className="react-onboarding-type-fieldset">
              <legend>{t(lang, "settings.enabledTypes")}</legend>
              <div>
                {typeValues.map((value) => (
                  <Checkbox
                    checked={types.includes(value)}
                    key={value}
                    label={t(lang, `type.${value}` as MessageKey)}
                    onChange={() =>
                      setTypes((current) =>
                        current.includes(value)
                          ? current.filter((item) => item !== value)
                          : [...current, value]
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          </motion.section>
        )}
        {step === 3 && (
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="react-onboarding-step seiton-react-onboarding-modal-step"
            exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
            initial={reduceMotion ? false : { opacity: 0, x: 8 }}
            key="step3"
          >
            <Text className="react-onboarding-description">
              {t(lang, "onboarding.step3Description")}
            </Text>
            <div className="react-onboarding-module-grid">
              {MODULE_KEYS.map((key) => (
                <label
                  className="react-onboarding-module"
                  htmlFor={`onboarding-module-${key}`}
                  key={key}
                >
                  <Checkbox
                    checked={modules[key]}
                    id={`onboarding-module-${key}`}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setModules((current) => ({ ...current, [key]: checked }));
                    }}
                  />
                  <span>
                    <strong>
                      {t(lang, `settings.module.${key}` as MessageKey)}
                    </strong>
                    <small>
                      {t(lang, `onboarding.module.${key}` as MessageKey)}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <div className="react-onboarding-fields">
              <TextInput
                label={t(lang, "settings.rootFolder")}
                onChange={(event) => setRootFolder(event.currentTarget.value)}
                value={rootFolder}
              />
              <TextInput
                label={t(lang, "settings.searchFolders")}
                onChange={(event) =>
                  setSearchFolders(event.currentTarget.value)
                }
                value={searchFolders}
              />
              <Select
                comboboxProps={{ withinPortal: false }}
                data={[
                  { label: t(lang, "type.memo"), value: "memo" },
                  { label: t(lang, "type.idea"), value: "idea" },
                ]}
                label={t(lang, "settings.sharedTextDefault")}
                onChange={(value) =>
                  setSharedDefault(value === "idea" ? "idea" : "memo")
                }
                value={sharedDefault}
              />
            </div>
            <AgentGuideChoiceField
              guideChoice={guideChoice}
              lang={lang}
              onChange={setGuideChoice}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {Boolean(error) && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {Boolean(saved) && (
        <Alert
          className="react-onboarding-saved"
          closeButtonLabel={t(lang, "notify.close")}
          color="accent"
          onClose={() => setSaved(false)}
          variant="light"
          withCloseButton
        >
          {t(lang, "onboarding.done")}
        </Alert>
      )}
      <Group
        className="react-onboarding-actions seiton-react-onboarding-modal-actions"
        justify="flex-end"
      >
        <Button
          disabled={step === 1}
          onClick={() => setStep((value) => Math.max(1, value - 1))}
          variant="default"
        >
          {t(lang, "onboarding.back")}
        </Button>
        {step < 3 ? (
          <Button
            color="ink"
            onClick={() => setStep((value) => Math.min(3, value + 1))}
          >
            {t(lang, "onboarding.next")}
          </Button>
        ) : (
          <Button color="ink" onClick={() => void finish()}>
            {t(lang, "onboarding.finish")}
          </Button>
        )}
      </Group>
    </section>
  );
}
