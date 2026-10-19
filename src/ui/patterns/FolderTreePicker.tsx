/** @jsxImportSource react */

import type { ReactNode } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { type Lang, t } from "../../shared/i18n";
import { buildFolderTree, type FolderTreeNode } from "../../shared/library";

export interface FolderTreePickerOption {
  description?: string;
  label?: string;
  path: string;
  value?: string;
}

export interface FolderTreePickerProps {
  emptyOption?: { label: string; value: string };
  label: string;
  lang: Lang;
  onChange: (value: string) => void;
  options: readonly FolderTreePickerOption[];
  placeholder?: string;
  value: string;
}

function optionValue(option: FolderTreePickerOption): string {
  return option.value ?? option.path;
}

function ancestorPaths(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  return segments
    .slice(0, -1)
    .map((_, index) => segments.slice(0, index + 1).join("/"));
}

export function FolderTreePicker({
  emptyOption,
  label,
  lang,
  onChange,
  options,
  placeholder,
  value,
}: FolderTreePickerProps) {
  const controlId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  const tree = useMemo(() => buildFolderTree(options), [options]);
  const selectedOption = options.find(
    (option) => optionValue(option) === value
  );
  const emptySelected = emptyOption?.value === value;
  const selectedPath = selectedOption?.path ?? "";

  const initialExpandedPaths = useMemo(() => {
    const initialPaths = new Set(tree.map((node) => node.path));
    for (const path of ancestorPaths(selectedPath)) {
      initialPaths.add(path);
    }
    return initialPaths;
  }, [selectedPath, tree]);
  const [expandedPaths, setExpandedPaths] = useState(
    () => initialExpandedPaths
  );

  const openPicker = (): void => {
    if (!opened) {
      setExpandedPaths((current) => {
        const next = new Set(current);
        for (const path of initialExpandedPaths) {
          next.add(path);
        }
        return next;
      });
    }
    setOpened((current) => !current);
  };

  const toggleFolder = (path: string): void => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectValue = (nextValue: string): void => {
    onChange(nextValue);
    setOpened(false);
    triggerRef.current?.focus();
  };

  const renderNodes = (
    nodes: FolderTreeNode<FolderTreePickerOption>[]
  ): ReactNode => (
    <ul className="seiton-folder-tree-list">
      {nodes.map((node) => {
        const option = node.option;
        const isSelected = Boolean(option && optionValue(option) === value);
        const optionButton = option ? (
          <button
            aria-pressed={isSelected}
            className={`seiton-folder-tree-option${isSelected ? "is-selected" : ""}`}
            onClick={() => selectValue(optionValue(option))}
            type="button"
          >
            <span className="seiton-folder-tree-option-main">
              <span className="seiton-folder-tree-name">
                {option.label ?? node.name}
              </span>
              {option.description ? (
                <span className="seiton-folder-tree-description">
                  {option.description}
                </span>
              ) : null}
            </span>
            {isSelected && (
              <span aria-hidden="true" className="seiton-folder-tree-check">
                ✓
              </span>
            )}
          </button>
        ) : (
          <span className="seiton-folder-tree-ancestor">{node.name}</span>
        );
        return (
          <li className="seiton-folder-tree-node" key={node.path}>
            <div className="seiton-folder-tree-row">
              {node.children.length > 0 ? (
                <button
                  aria-expanded={expandedPaths.has(node.path)}
                  aria-label={`${t(lang, "folderPicker.toggle")} ${node.name}`}
                  className="seiton-folder-tree-disclosure"
                  onClick={() => toggleFolder(node.path)}
                  type="button"
                >
                  <span aria-hidden="true" />
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  className="seiton-folder-tree-spacer"
                />
              )}
              {optionButton}
            </div>
            {node.children.length > 0 &&
              expandedPaths.has(node.path) &&
              renderNodes(node.children)}
          </li>
        );
      })}
    </ul>
  );

  const triggerLabel = emptySelected
    ? emptyOption?.label
    : (selectedOption?.path ?? placeholder ?? "");

  return (
    <div
      className="seiton-folder-tree-picker"
      onKeyDown={(event) => {
        if (event.key === "Escape" && opened) {
          event.preventDefault();
          setOpened(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <span className="seiton-folder-tree-label" id={`${controlId}-label`}>
        {label}
      </span>
      <button
        aria-controls={`${controlId}-panel`}
        aria-expanded={opened}
        aria-labelledby={`${controlId}-label ${controlId}-value`}
        className="seiton-folder-tree-trigger"
        onClick={openPicker}
        ref={triggerRef}
        type="button"
      >
        <span
          className="seiton-folder-tree-trigger-value"
          id={`${controlId}-value`}
        >
          {triggerLabel || placeholder}
        </span>
        <span aria-hidden="true" className="seiton-folder-tree-trigger-icon">
          {opened ? "⌃" : "⌄"}
        </span>
      </button>
      {opened ? (
        <div className="seiton-folder-tree-panel" id={`${controlId}-panel`}>
          {emptyOption ? (
            <button
              aria-pressed={emptySelected}
              className={`seiton-folder-tree-empty${emptySelected ? "is-selected" : ""}`}
              onClick={() => selectValue(emptyOption.value)}
              type="button"
            >
              {emptyOption.label}
            </button>
          ) : null}
          {tree.length > 0 ? (
            renderNodes(tree)
          ) : (
            <div className="seiton-folder-tree-empty-state">{placeholder}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
