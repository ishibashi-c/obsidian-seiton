import { type CSSProperties, useEffect, useRef, useState } from "react";

export interface StringListEditorProps {
  addLabel: string;
  addPlaceholder: string;
  defaultLabel?: string;
  duplicateMessage: string;
  emptyLabel: string;
  itemLabel: string;
  moveDownLabel: string;
  moveUpLabel: string;
  normalize?: (value: string) => string;
  onChange: (values: string[]) => void | Promise<void>;
  removeLabel: string;
  requiredMessage: string;
  requiredValue?: string;
  values: readonly string[];
}

export function StringListEditor({
  addLabel,
  addPlaceholder,
  defaultLabel,
  duplicateMessage,
  emptyLabel,
  itemLabel,
  moveDownLabel,
  moveUpLabel,
  normalize = (value) => value.trim(),
  onChange,
  removeLabel,
  requiredMessage,
  requiredValue,
  values: initialValues,
}: StringListEditorProps) {
  const [values, setValues] = useState([...initialValues]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [addError, setAddError] = useState("");
  const addInput = useRef<HTMLInputElement>(null);

  const persist = (nextValues: string[]): void => {
    setValues(nextValues);
    setRowErrors({});
    void onChange([...nextValues]);
  };
  const validate = (candidate: string, index: number | null): string => {
    if (candidate.length === 0) {
      return requiredMessage;
    }
    return values.some(
      (value, valueIndex) =>
        valueIndex !== index &&
        value.toLocaleLowerCase() === candidate.toLocaleLowerCase()
    )
      ? duplicateMessage
      : "";
  };
  const addValue = (): void => {
    const input = addInput.current;
    if (!input) {
      return;
    }
    const candidate = normalize(input.value);
    const error = validate(candidate, null);
    if (error) {
      setAddError(error);
      input.setAttribute("aria-invalid", "true");
      return;
    }
    setAddError("");
    input.removeAttribute("aria-invalid");
    input.value = "";
    persist([...values, candidate]);
    input.focus();
  };

  return (
    <div className="seiton-settings-list-editor">
      <div className="seiton-settings-list-rows">
        {values.length === 0 ? (
          <div className="seiton-settings-list-empty">{emptyLabel}</div>
        ) : (
          values.map((value, index) => {
            const error = rowErrors[index] ?? "";
            const isRequired = requiredValue === value;
            return (
              <div className="seiton-settings-list-row" key={value}>
                <input
                  aria-invalid={error ? "true" : undefined}
                  aria-label={`${itemLabel} ${index + 1}`}
                  defaultValue={value}
                  onBlur={(event) => {
                    const candidate = normalize(event.currentTarget.value);
                    const validationError = validate(candidate, index);
                    if (validationError) {
                      setRowErrors((current) => ({
                        ...current,
                        [index]: validationError,
                      }));
                      return;
                    }
                    if (candidate !== values[index]) {
                      const nextValues = [...values];
                      nextValues[index] = candidate;
                      persist(nextValues);
                    }
                  }}
                  onChange={() =>
                    setRowErrors((current) => ({ ...current, [index]: "" }))
                  }
                  type="text"
                />
                <div className="seiton-settings-list-row-meta">
                  {index === 0 && defaultLabel ? (
                    <span className="seiton-settings-list-default">
                      {defaultLabel}
                    </span>
                  ) : null}
                </div>
                <div className="seiton-settings-list-actions">
                  <button
                    aria-label={`${moveUpLabel}: ${itemLabel} ${index + 1}`}
                    className="seiton-settings-list-action"
                    disabled={index === 0}
                    onClick={() => {
                      if (index === 0) {
                        return;
                      }
                      const nextValues = [...values];
                      [nextValues[index - 1], nextValues[index]] = [
                        nextValues[index],
                        nextValues[index - 1],
                      ];
                      persist(nextValues);
                    }}
                    title={moveUpLabel}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${moveDownLabel}: ${itemLabel} ${index + 1}`}
                    className="seiton-settings-list-action"
                    disabled={index === values.length - 1}
                    onClick={() => {
                      if (index === values.length - 1) {
                        return;
                      }
                      const nextValues = [...values];
                      [nextValues[index], nextValues[index + 1]] = [
                        nextValues[index + 1],
                        nextValues[index],
                      ];
                      persist(nextValues);
                    }}
                    title={moveDownLabel}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`${removeLabel}: ${itemLabel} ${index + 1}`}
                    className="seiton-settings-list-action is-danger"
                    disabled={isRequired}
                    onClick={() => {
                      if (!isRequired) {
                        persist(
                          values.filter((_, valueIndex) => valueIndex !== index)
                        );
                      }
                    }}
                    title={isRequired ? requiredMessage : removeLabel}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                {error ? (
                  <div className="seiton-settings-list-error" role="alert">
                    {error}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      <div className="seiton-settings-list-add">
        <input
          aria-label={addLabel}
          onChange={(event) => {
            setAddError("");
            event.currentTarget.removeAttribute("aria-invalid");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder={addPlaceholder}
          ref={addInput}
          type="text"
        />
        <button
          className="seiton-settings-list-add-button"
          onClick={addValue}
          type="button"
        >
          {addLabel}
        </button>
        {addError ? (
          <div className="seiton-settings-list-error" role="alert">
            {addError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface TagAliasEditorLabels {
  addAlias: string;
  addMapping: string;
  aliasLabel: string;
  aliasPlaceholder: string;
  canonicalLabel: string;
  duplicateMessage: string;
  emptyLabel: string;
  removeLabel: string;
  requiredMessage: string;
}

interface TagAliasEntry {
  aliases: string[];
  canonical: string;
  id: number;
}

export interface TagAliasEditorProps {
  initialValues: Record<string, string[]>;
  labels: TagAliasEditorLabels;
  onChange: (values: Record<string, string[]>) => void | Promise<void>;
}

export function TagAliasEditor({
  initialValues,
  labels,
  onChange,
}: TagAliasEditorProps) {
  const [entries, setEntries] = useState<TagAliasEntry[]>(() =>
    Object.entries(initialValues).map(([canonical, aliases], id) => ({
      aliases: [...aliases],
      canonical,
      id,
    }))
  );
  const [mappingErrors, setMappingErrors] = useState<Record<number, string>>(
    {}
  );
  const [aliasErrors, setAliasErrors] = useState<Record<string, string>>({});
  const [focusNewMapping, setFocusNewMapping] = useState(false);
  const nextId = useRef(entries.length);
  const newCanonicalInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusNewMapping) {
      newCanonicalInput.current?.focus();
      setFocusNewMapping(false);
    }
  }, [focusNewMapping]);

  const persist = (nextEntries: TagAliasEntry[]): void => {
    setEntries(nextEntries);
    setMappingErrors({});
    setAliasErrors({});
    void onChange(
      Object.fromEntries(
        nextEntries
          .filter((entry) => entry.canonical.length > 0)
          .map((entry) => [entry.canonical, entry.aliases])
      )
    );
  };
  const normalizeTag = (value: string): string =>
    value.trim().replace(/^#+/, "");

  return (
    <div className="seiton-settings-alias-editor">
      <div className="seiton-settings-alias-rows">
        {entries.map((entry, index) => {
          const mappingError = mappingErrors[entry.id] ?? "";
          return (
            <div className="seiton-settings-alias-row" key={entry.id}>
              <div className="seiton-settings-alias-header">
                <input
                  aria-invalid={mappingError ? "true" : undefined}
                  aria-label={labels.canonicalLabel}
                  defaultValue={entry.canonical}
                  onBlur={(event) => {
                    const canonical = normalizeTag(event.currentTarget.value);
                    if (!canonical) {
                      setMappingErrors((current) => ({
                        ...current,
                        [entry.id]: labels.requiredMessage,
                      }));
                      return;
                    }
                    if (
                      entries.some(
                        (candidate) =>
                          candidate.id !== entry.id &&
                          candidate.canonical === canonical
                      )
                    ) {
                      setMappingErrors((current) => ({
                        ...current,
                        [entry.id]: labels.duplicateMessage,
                      }));
                      return;
                    }
                    if (canonical !== entry.canonical) {
                      persist(
                        entries.map((candidate) =>
                          candidate.id === entry.id
                            ? { ...candidate, canonical }
                            : candidate
                        )
                      );
                    }
                  }}
                  onChange={() =>
                    setMappingErrors((current) => ({
                      ...current,
                      [entry.id]: "",
                    }))
                  }
                  placeholder={labels.canonicalLabel}
                  ref={
                    index === entries.length - 1 ? newCanonicalInput : undefined
                  }
                  type="text"
                />
                <button
                  aria-label={`${labels.removeLabel}: ${labels.canonicalLabel} ${entry.canonical}`}
                  className="seiton-settings-list-action is-danger"
                  onClick={() =>
                    persist(
                      entries.filter((candidate) => candidate.id !== entry.id)
                    )
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
              {mappingError ? (
                <div className="seiton-settings-list-error" role="alert">
                  {mappingError}
                </div>
              ) : null}
              <div className="seiton-settings-alias-group">
                <span className="seiton-settings-alias-label">
                  {labels.aliasLabel}
                </span>
                <div className="seiton-settings-alias-values">
                  {entry.aliases.map((alias, aliasIndex) => {
                    const errorKey = `${entry.id}:${aliasIndex}`;
                    const error = aliasErrors[errorKey] ?? "";
                    return (
                      <div
                        className="seiton-settings-alias-value"
                        key={errorKey}
                      >
                        <input
                          aria-invalid={error ? "true" : undefined}
                          aria-label={`${labels.aliasLabel} ${aliasIndex + 1}`}
                          defaultValue={alias}
                          onBlur={(event) => {
                            const value = normalizeTag(
                              event.currentTarget.value
                            );
                            if (!value) {
                              return;
                            }
                            if (
                              entry.aliases.some(
                                (candidate, candidateIndex) =>
                                  candidateIndex !== aliasIndex &&
                                  candidate === value
                              )
                            ) {
                              setAliasErrors((current) => ({
                                ...current,
                                [errorKey]: labels.duplicateMessage,
                              }));
                              return;
                            }
                            if (value !== alias) {
                              persist(
                                entries.map((candidate) =>
                                  candidate.id === entry.id
                                    ? {
                                        ...candidate,
                                        aliases: candidate.aliases.map(
                                          (item, itemIndex) =>
                                            itemIndex === aliasIndex
                                              ? value
                                              : item
                                        ),
                                      }
                                    : candidate
                                )
                              );
                            }
                          }}
                          onChange={() =>
                            setAliasErrors((current) => ({
                              ...current,
                              [errorKey]: "",
                            }))
                          }
                          type="text"
                        />
                        <button
                          aria-label={`${labels.removeLabel}: ${labels.aliasLabel} ${aliasIndex + 1}`}
                          className="seiton-settings-list-action is-danger"
                          onClick={() =>
                            persist(
                              entries.map((candidate) =>
                                candidate.id === entry.id
                                  ? {
                                      ...candidate,
                                      aliases: candidate.aliases.filter(
                                        (_, itemIndex) =>
                                          itemIndex !== aliasIndex
                                      ),
                                    }
                                  : candidate
                              )
                            )
                          }
                          type="button"
                        >
                          ×
                        </button>
                        {error ? (
                          <div
                            className="seiton-settings-list-error"
                            role="alert"
                          >
                            {error}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <AliasAdder
                    entry={entry}
                    labels={labels}
                    onAdd={(alias) =>
                      persist(
                        entries.map((candidate) =>
                          candidate.id === entry.id
                            ? {
                                ...candidate,
                                aliases: [...candidate.aliases, alias],
                              }
                            : candidate
                        )
                      )
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {entries.length === 0 ? (
        <div className="seiton-settings-list-empty">{labels.emptyLabel}</div>
      ) : null}
      <button
        className="seiton-settings-list-add-button"
        onClick={() => {
          setEntries((current) => [
            ...current,
            { aliases: [], canonical: "", id: nextId.current++ },
          ]);
          setFocusNewMapping(true);
        }}
        type="button"
      >
        {labels.addMapping}
      </button>
    </div>
  );
}

function AliasAdder({
  entry,
  labels,
  onAdd,
}: {
  entry: TagAliasEntry;
  labels: TagAliasEditorLabels;
  onAdd: (alias: string) => void;
}) {
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const addAlias = (): void => {
    const value = (input.current?.value ?? "").trim().replace(/^#+/, "");
    if (!value) {
      return;
    }
    if (entry.aliases.includes(value)) {
      setError(labels.duplicateMessage);
      return;
    }
    onAdd(value);
    if (input.current) {
      input.current.value = "";
      input.current.focus();
    }
    setError("");
  };

  return (
    <>
      <div className="seiton-settings-alias-add">
        <input
          aria-label={labels.addAlias}
          onChange={() => setError("")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addAlias();
            }
          }}
          placeholder={labels.aliasPlaceholder}
          ref={input}
          type="text"
        />
        <button
          className="seiton-settings-list-add-button"
          onClick={addAlias}
          type="button"
        >
          {labels.addAlias}
        </button>
      </div>
      {error ? (
        <div className="seiton-settings-list-error" role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}

export interface ColorPaletteEditorProps {
  colors: readonly string[];
  labels: { all: string; hint: string; label: string };
  onChange: (values: string[]) => void | Promise<void>;
  values: readonly string[];
}

export function ColorPaletteEditor({
  colors,
  labels,
  onChange,
  values,
}: ColorPaletteEditorProps) {
  const [selected, setSelected] = useState(() => new Set(values));
  const persist = (next: Set<string>): void => {
    setSelected(next);
    void onChange(colors.filter((color) => next.has(color)));
  };

  return (
    <div className="seiton-settings-color-editor">
      <p className="setting-item-description">{labels.hint}</p>
      <button
        className="seiton-settings-list-add-button"
        onClick={() => persist(new Set())}
        type="button"
      >
        {labels.all}
      </button>
      <div className="seiton-settings-color-palette">
        {colors.map((color) => (
          <button
            aria-label={`${labels.label}: ${color}`}
            aria-pressed={selected.has(color)}
            className="seiton-settings-color-swatch"
            key={color}
            onClick={() => {
              const next = new Set(selected);
              if (next.has(color)) {
                next.delete(color);
              } else {
                next.add(color);
              }
              persist(next);
            }}
            style={{ "--seiton-color": color } as CSSProperties}
            type="button"
          >
            <span className="seiton-settings-color-swatch-dot" />
            <span>{color}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
