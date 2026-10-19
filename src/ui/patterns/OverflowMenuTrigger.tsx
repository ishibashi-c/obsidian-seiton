/** @jsxImportSource react */

import type { ButtonHTMLAttributes, RefObject } from "react";
import { Button, SeitonIcon } from "../primitives";

type OverflowMenuTriggerBaseProps = {
  className?: string;
  controls?: string;
  label: string;
};

type OverflowMenuButtonTriggerProps = OverflowMenuTriggerBaseProps & {
  anchorId?: string;
  as?: "button";
  expanded: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  ref?: RefObject<HTMLButtonElement | null>;
};

type OverflowMenuSummaryTriggerProps = OverflowMenuTriggerBaseProps & {
  as: "summary";
  ref?: RefObject<HTMLElement | null>;
};

export type OverflowMenuTriggerProps =
  | OverflowMenuButtonTriggerProps
  | OverflowMenuSummaryTriggerProps;

export function OverflowMenuTrigger(props: OverflowMenuTriggerProps) {
  const marker = <SeitonIcon name="more" />;
  const className = props.className
    ? `seiton-ui-overflow-trigger ${props.className}`
    : "seiton-ui-overflow-trigger";

  if (props.as === "summary") {
    return (
      <summary
        aria-controls={props.controls}
        aria-label={props.label}
        className={className}
        data-seiton-overflow-trigger=""
        ref={props.ref}
      >
        {marker}
      </summary>
    );
  }

  return (
    <Button
      aria-controls={props.controls}
      aria-expanded={props.expanded}
      aria-haspopup="menu"
      aria-label={props.label}
      className={className}
      data-seiton-menu-anchor={props.anchorId}
      data-seiton-overflow-trigger=""
      onClick={props.onClick}
      ref={props.ref}
      size="xs"
      type="button"
      variant="subtle"
    >
      {marker}
    </Button>
  );
}
