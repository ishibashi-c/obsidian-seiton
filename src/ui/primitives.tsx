/**
 * Seiton-owned UI primitives.
 *
 * These components intentionally use native HTML semantics and a small,
 * source-owned API. Feature screens must import from here instead of binding
 * directly to a component library or to Obsidian's global CSS.
 */

import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { type Lang, t } from "../shared/i18n";

type Color = "ink" | "accent" | "red" | "green" | "gray" | string;
type Variant = "default" | "light" | "outline" | "subtle";
type Size = "xs" | "sm" | "md" | "lg" | "xl" | "compact-sm";

const spacing: Record<string, string> = {
  lg: "20px",
  md: "14px",
  sm: "8px",
  xl: "28px",
  xs: "4px",
};

function cx(...values: unknown[]): string | undefined {
  const result = values.filter(Boolean).join(" ");
  return result || undefined;
}

function colorClass(color: Color | undefined): string | undefined {
  return color && color !== "ink"
    ? `seiton-color-${color}`
    : color === "ink"
      ? "seiton-color-ink"
      : undefined;
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  color?: Color;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  ref?: RefObject<HTMLButtonElement | null>;
};

export function Button({
  color = "ink",
  variant = "default",
  size = "md",
  loading,
  fullWidth,
  className,
  disabled,
  children,
  "aria-busy": ariaBusy,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || ariaBusy || undefined}
      className={cx(
        "seiton-ui-button",
        `seiton-ui-button-${variant}`,
        `seiton-ui-button-${size}`,
        colorClass(color),
        fullWidth && "seiton-ui-button-full",
        className
      )}
      disabled={disabled || loading}
      ref={ref}
    >
      {loading ? (
        <span aria-hidden="true" className="seiton-ui-button-loading">
          …
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export type SeitonIconName =
  | "card-view"
  | "chevron-down"
  | "filter-clear"
  | "folder"
  | "list-view"
  | "more"
  | "pin";

export function SeitonIcon({
  filled = false,
  name,
}: {
  filled?: boolean;
  name: SeitonIconName;
}) {
  let content: ReactNode;

  switch (name) {
    case "card-view":
      content = (
        <>
          <rect height="7" rx="1" width="7" x="3.5" y="3.5" />
          <rect height="7" rx="1" width="7" x="13.5" y="3.5" />
          <rect height="7" rx="1" width="7" x="3.5" y="13.5" />
          <rect height="7" rx="1" width="7" x="13.5" y="13.5" />
        </>
      );
      break;
    case "chevron-down":
      content = <path d="m6 9 6 6 6-6" />;
      break;
    case "filter-clear":
      content = (
        <>
          <path d="M3.5 5h17l-6.5 7.2v5.5l-4 2.3v-7.8L3.5 5Z" />
          <path d="m16.5 15.5 4 4m0-4-4 4" />
        </>
      );
      break;
    case "folder":
      content = (
        <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.6l2 2H19A1.5 1.5 0 0 1 20.5 9v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17V7Z" />
      );
      break;
    case "list-view":
      content = (
        <>
          <path d="M9 5h11M9 12h11M9 19h11" />
          <path d="M4 5h.01M4 12h.01M4 19h.01" />
        </>
      );
      break;
    case "more":
      content = (
        <>
          <circle cx="5" cy="12" fill="currentColor" r="1.25" stroke="none" />
          <circle cx="12" cy="12" fill="currentColor" r="1.25" stroke="none" />
          <circle cx="19" cy="12" fill="currentColor" r="1.25" stroke="none" />
        </>
      );
      break;
    case "pin":
      content = (
        <>
          <path
            d="M8.5 3.5h7l-.6 5 2.6 3v1.8H6.5v-1.8l2.6-3-.6-5Z"
            fill={filled ? "currentColor" : "none"}
          />
          <path d="M12 13.3v7.2" />
        </>
      );
      break;
    default:
      content = null;
      break;
  }

  return (
    <svg
      aria-hidden="true"
      className="seiton-ui-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      {content}
    </svg>
  );
}

type IconButtonProps = Omit<
  ButtonProps,
  "children" | "aria-label" | "title"
> & {
  filled?: boolean;
  icon: SeitonIconName;
  label: string;
  pressed?: boolean;
  title?: string;
};

export function IconButton({
  className,
  filled,
  icon,
  label,
  pressed,
  size = "compact-sm",
  title,
  type = "button",
  variant = "subtle",
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={label}
      aria-pressed={pressed}
      className={cx("seiton-ui-icon-button", className)}
      size={size}
      title={title ?? label}
      type={type}
      variant={variant}
    >
      <SeitonIcon filled={filled} name={icon} />
    </Button>
  );
}

type SurfaceProps = HTMLAttributes<HTMLElement> &
  Record<string, unknown> & {
    withBorder?: boolean;
    radius?: string;
    padding?: Size;
    p?: Size;
    component?: ElementType;
    style?: CSSProperties;
  };

export function Card({
  component,
  withBorder,
  radius,
  padding,
  p,
  className,
  style,
  children,
  ...props
}: SurfaceProps) {
  const Component = component ?? "div";
  return (
    <Component
      {...props}
      className={cx(
        "seiton-ui-card",
        withBorder && "seiton-ui-card-bordered",
        radius && `seiton-ui-radius-${radius}`,
        (padding ?? p) && `seiton-ui-padding-${padding ?? p}`,
        className
      )}
      style={style}
    >
      {children}
    </Component>
  );
}

export function Paper(props: SurfaceProps) {
  return <Card {...props} />;
}

export function Group({
  gap = "md",
  justify,
  align,
  mt,
  grow,
  className,
  style,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> &
  Record<string, unknown> & {
    gap?: Size | string;
    justify?: CSSProperties["justifyContent"];
    align?: CSSProperties["alignItems"];
    mt?: Size | string;
    grow?: boolean;
  }) {
  return (
    <div
      {...props}
      className={cx("seiton-ui-group", className)}
      style={{
        alignItems: align,
        flexGrow: grow ? 1 : undefined,
        gap: spacing[gap] ?? gap,
        justifyContent: justify,
        marginTop: mt ? (spacing[mt] ?? mt) : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Stack({
  gap = "md",
  className,
  style,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gap?: Size | string }) {
  return (
    <div
      {...props}
      className={cx("seiton-ui-stack", className)}
      style={{ gap: spacing[gap] ?? gap, ...style }}
    >
      {children}
    </div>
  );
}

export function Text({
  size,
  fw,
  component = "div",
  className,
  style,
  children,
  ...props
}: HTMLAttributes<HTMLElement> &
  Record<string, unknown> & {
    size?: Size | string;
    fw?: number;
    component?: ElementType;
  }) {
  const Component = component;
  return (
    <Component
      {...props}
      className={cx(
        "seiton-ui-text",
        size && `seiton-ui-text-${size}`,
        fw && `seiton-ui-weight-${fw}`,
        className
      )}
      style={{ fontWeight: fw, ...style }}
    >
      {children}
    </Component>
  );
}

export function Title({
  order = 1,
  size,
  className,
  style,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  order?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: Size | string;
}) {
  const Component = `h${order}` as ElementType;
  return (
    <Component
      {...props}
      className={cx(
        "seiton-ui-title",
        size && `seiton-ui-title-${size}`,
        className
      )}
      style={style}
    >
      {children}
    </Component>
  );
}

export function Badge({
  color = "accent",
  variant = "light",
  size,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  color?: Color;
  variant?: Variant;
  size?: Size;
  rightSection?: ReactNode;
}) {
  const { rightSection, ...rest } = props;
  return (
    <span
      {...rest}
      className={cx(
        "seiton-ui-badge",
        `seiton-ui-badge-${variant}`,
        size && `seiton-ui-badge-${size}`,
        colorClass(color),
        className
      )}
    >
      {children}
      {rightSection}
    </span>
  );
}

export function Alert({
  lang = "en",
  color = "accent",
  variant = "light",
  withCloseButton,
  closeButtonLabel = t(lang, "notify.close"),
  onClose,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> &
  Record<string, unknown> & {
    lang?: Lang;
    color?: Color;
    variant?: Variant;
    withCloseButton?: boolean;
    closeButtonLabel?: string;
    onClose?: () => void;
  }) {
  return (
    <div
      {...props}
      className={cx(
        "seiton-ui-alert",
        `seiton-ui-alert-${variant}`,
        colorClass(color),
        className
      )}
    >
      {children}
      {withCloseButton && Boolean(onClose) && (
        <button
          aria-label={closeButtonLabel}
          className="seiton-ui-alert-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function Divider({
  className,
  my,
  ...props
}: HTMLAttributes<HTMLHRElement> &
  Record<string, unknown> & { my?: Size | string }) {
  return (
    <hr
      {...props}
      className={cx("seiton-ui-divider", className)}
      style={{
        marginBlock: my ? (spacing[my] ?? my) : undefined,
        ...(props.style as CSSProperties | undefined),
      }}
    />
  );
}

interface FieldBase {
  description?: ReactNode;
  error?: ReactNode;
  label?: ReactNode;
  required?: boolean;
  rightSection?: ReactNode;
}
function Field({
  label,
  description,
  error,
  required,
  id,
  children,
}: FieldBase & { id: string; children: ReactNode }) {
  return (
    <label className="seiton-ui-field" htmlFor={id}>
      {Boolean(label) && (
        <span className="seiton-ui-field-label">
          {label}
          {Boolean(required) && <span aria-hidden="true"> *</span>}
        </span>
      )}
      {children}
      {Boolean(description) && (
        <span className="seiton-ui-field-description">{description}</span>
      )}
      {Boolean(error) && (
        <span className="seiton-ui-field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> &
  FieldBase;
export const TextInput = function TextInput({
  label,
  description,
  error,
  required,
  rightSection,
  autoFocus,
  id: givenId,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  ref,
  ...props
}: TextInputProps & { ref?: RefObject<HTMLInputElement | null> }) {
  const generatedId = useId();
  const id = givenId ?? `seiton-input-${generatedId}`;
  return (
    <Field
      description={description}
      error={error}
      id={id}
      label={label}
      required={required}
    >
      <span className="seiton-ui-input-wrap">
        <input
          {...props}
          aria-describedby={cx(
            ariaDescribedBy,
            error ? `${id}-error` : undefined
          )}
          aria-invalid={error ? true : ariaInvalid}
          autoFocus={autoFocus}
          className={cx(
            "seiton-ui-input",
            error && "seiton-ui-input-error",
            className
          )}
          data-seiton-autofocus={autoFocus ? "" : undefined}
          id={id}
          ref={ref}
          required={required}
        />
        {Boolean(rightSection) && (
          <span className="seiton-ui-input-right">{rightSection}</span>
        )}
      </span>
    </Field>
  );
};

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldBase & { minRows?: number; maxRows?: number; autosize?: boolean };
export const Textarea = function Textarea({
  label,
  description,
  error,
  required,
  minRows,
  maxRows,
  autosize,
  autoFocus,
  id: givenId,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  style,
  ref,
  ...props
}: TextareaProps & { ref?: RefObject<HTMLTextAreaElement | null> }) {
  const generatedId = useId();
  const id = givenId ?? `seiton-textarea-${generatedId}`;
  return (
    <Field
      description={description}
      error={error}
      id={id}
      label={label}
      required={required}
    >
      <textarea
        {...props}
        aria-describedby={cx(
          ariaDescribedBy,
          error ? `${id}-error` : undefined
        )}
        aria-invalid={error ? true : ariaInvalid}
        autoFocus={autoFocus}
        className={cx(
          "seiton-ui-textarea",
          error && "seiton-ui-input-error",
          className
        )}
        data-seiton-autofocus={autoFocus ? "" : undefined}
        id={id}
        ref={ref}
        required={required}
        rows={minRows ?? props.rows}
        style={style}
      />
    </Field>
  );
};

type SelectOption = string | { value: string; label: string };
export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size" | "onChange" | "value"
> &
  FieldBase & {
    lang?: Lang;
    data?: SelectOption[];
    value?: string | null;
    defaultValue?: string;
    onChange?: (value: string | null) => void;
    searchable?: boolean;
    clearable?: boolean;
    comboboxProps?: unknown;
    placeholder?: string;
  };
export function Select({
  lang = "en",
  label,
  description,
  error,
  required,
  data = [],
  value,
  defaultValue,
  onChange,
  id: givenId,
  className,
  placeholder,
  clearable,
  searchable,
  comboboxProps,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const id = givenId ?? `seiton-select-${generatedId}`;
  const options = data.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option
  );
  const selectValueProps =
    value === undefined
      ? { defaultValue: defaultValue ?? "" }
      : { value: value ?? "" };
  return (
    <Field
      description={description}
      error={error}
      id={id}
      label={label}
      required={required}
    >
      <select
        {...props}
        {...selectValueProps}
        aria-describedby={cx(
          ariaDescribedBy,
          error ? `${id}-error` : undefined
        )}
        aria-invalid={error ? true : ariaInvalid}
        className={cx("seiton-ui-select", className)}
        id={id}
        onChange={(event) => onChange?.(event.currentTarget.value || null)}
        required={required}
      >
        {Boolean(placeholder || clearable) && (
          <option value="">
            {placeholder ?? t(lang, "common.selectPlaceholder")}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
}) {
  return (
    <label className={cx("seiton-ui-check", className)}>
      <input
        {...props}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

export function Switch(
  props: Omit<Parameters<typeof Checkbox>[0], "label"> & { label?: ReactNode }
) {
  return (
    <Checkbox {...props} className={cx("seiton-ui-switch", props.className)} />
  );
}

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
};
const RadioBase = ({
  label,
  value,
  checked,
  onChange,
  name,
  className,
  ...props
}: RadioProps) => (
  <label className={cx("seiton-ui-check", className)}>
    <input
      {...props}
      checked={checked}
      name={name}
      onChange={onChange}
      type="radio"
      value={value}
    />
    <span>{label}</span>
  </label>
);
export const Radio = Object.assign(RadioBase, {
  Group({
    onChange,
    children,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    children: ReactNode;
  }) {
    return (
      <div
        className="seiton-ui-radio-group"
        onChange={(event) => {
          const target = event.target as HTMLInputElement;
          if (target.value) {
            onChange?.(target.value);
          }
        }}
      >
        {children}
      </div>
    );
  },
});

export function SegmentedControl({
  value,
  defaultValue,
  data = [],
  onChange,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: string;
  defaultValue?: string;
  data?: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}) {
  const [internal, setInternal] = useState(
    defaultValue ?? data[0]?.value ?? ""
  );
  const current = value ?? internal;
  return (
    <div {...props} className={cx("seiton-ui-segmented", className)}>
      {data.map((item) => (
        <button
          aria-pressed={current === item.value}
          className={cx(
            "seiton-ui-segmented-option",
            current === item.value && "is-selected"
          )}
          key={item.value}
          onClick={() => {
            setInternal(item.value);
            onChange?.(item.value);
          }}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface ModalProps {
  centered?: boolean;
  children?: ReactNode;
  classNames?: Record<string, string>;
  closeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  contentRef?: RefObject<HTMLDivElement | null>;
  focusKey?: string | number;
  lang?: Lang;
  onClose: () => void;
  opened: boolean;
  portalProps?: { target?: HTMLElement | null };
  returnFocusRef?: RefObject<HTMLElement | null>;
  size?: string | number;
  styles?: Record<string, CSSProperties>;
  title?: ReactNode;
  withinPortal?: boolean;
}

export function getModalCloseButtonLabel(
  lang: Lang,
  closeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
): string {
  return closeButtonProps?.["aria-label"] ?? t(lang, "notify.close");
}

export function getActiveElementWithinRoot(
  element: HTMLElement | null
): HTMLElement | null {
  const focusRoot = element?.getRootNode();
  if (focusRoot && "activeElement" in focusRoot) {
    return (focusRoot as Document | ShadowRoot)
      .activeElement as HTMLElement | null;
  }
  return typeof document === "undefined"
    ? null
    : (document.activeElement as HTMLElement | null);
}

export function getModalInitialFocusTarget(
  dialog: HTMLElement | null
): HTMLElement | null {
  if (!dialog) {
    return null;
  }
  return (
    dialog.querySelector<HTMLElement>("[data-seiton-autofocus], [autofocus]") ??
    dialog
  );
}

export function getModalTabWrapTarget(
  dialog: Pick<HTMLElement, "contains">,
  active: HTMLElement | null,
  first: HTMLElement,
  last: HTMLElement,
  reverse: boolean
): HTMLElement | null {
  if (reverse && (active === first || !dialog.contains(active))) {
    return last;
  }
  if (!reverse && (active === last || !dialog.contains(active))) {
    return first;
  }
  return null;
}

export function isTopmostModal(dialog: HTMLElement | null): boolean {
  if (!dialog) {
    return true;
  }
  const focusRoot = dialog.getRootNode();
  if (!("querySelectorAll" in focusRoot)) {
    return true;
  }
  const dialogs = (
    focusRoot as Document | ShadowRoot
  ).querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  return dialogs.length <= 1 || dialogs.item(dialogs.length - 1) === dialog;
}

export function Modal({
  lang = "en",
  opened,
  onClose,
  title,
  children,
  contentRef: contentRefProp,
  focusKey,
  size = "md",
  portalProps,
  returnFocusRef,
  closeButtonProps,
  classNames,
  styles,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusKeyRef = useRef(focusKey);
  const titleId = useId();
  onCloseRef.current = onClose;
  useLayoutEffect(() => {
    if (!opened) {
      previousFocusKeyRef.current = focusKey;
      return;
    }
    if (Object.is(previousFocusKeyRef.current, focusKey)) {
      return;
    }
    previousFocusKeyRef.current = focusKey;
    const dialog = (contentRefProp ?? contentRef).current;
    getModalInitialFocusTarget(dialog)?.focus();
  }, [contentRefProp, focusKey, opened]);
  useEffect(() => {
    if (!opened) {
      return;
    }
    const dialog = (contentRefProp ?? contentRef).current;
    const previous =
      returnFocusRef?.current ?? getActiveElementWithinRoot(dialog);
    getModalInitialFocusTarget(dialog)?.focus();
    const focusableSelector =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostModal(dialog)) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(focusableSelector)
          ).filter((element) => element.getClientRects().length > 0)
        : [];
      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!(first && last)) {
        return;
      }
      const wrappedFocus = dialog
        ? getModalTabWrapTarget(
            dialog,
            getActiveElementWithinRoot(dialog),
            first,
            last,
            event.shiftKey
          )
        : null;
      if (wrappedFocus) {
        event.preventDefault();
        wrappedFocus.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const returnTarget = returnFocusRef?.current ?? previous;
      if (returnTarget?.isConnected) {
        returnTarget.focus();
      }
    };
  }, [contentRefProp, opened, returnFocusRef]);
  if (!opened) {
    return null;
  }
  const target = portalProps?.target ?? document.body;
  const closeLabel = getModalCloseButtonLabel(lang, closeButtonProps);
  const body = (
    <div className={cx("seiton-ui-modal-root", classNames?.root)}>
      <button
        aria-label={closeLabel}
        className="seiton-ui-modal-overlay"
        onMouseDown={onClose}
        type="button"
      />
      <div
        aria-labelledby={title ? titleId : undefined}
        aria-modal="true"
        className={cx("seiton-ui-modal-content", classNames?.content)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCloseRef.current();
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
        ref={contentRefProp ?? contentRef}
        role="dialog"
        style={{
          maxWidth: typeof size === "number" ? `${size}px` : undefined,
          ...styles?.content,
        }}
        tabIndex={-1}
      >
        <header
          className={cx("seiton-ui-modal-header", classNames?.header)}
          style={styles?.header}
        >
          {Boolean(title) && <h2 id={titleId}>{title}</h2>}
          <button
            className="seiton-ui-modal-close"
            type="button"
            {...closeButtonProps}
            aria-label={closeLabel}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div
          className={cx("seiton-ui-modal-body", classNames?.body)}
          style={styles?.body}
        >
          {children}
        </div>
      </div>
    </div>
  );
  return createPortal(body, target);
}

export type ComponentProps<T extends ElementType> = ComponentPropsWithoutRef<T>;
