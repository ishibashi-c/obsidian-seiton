/**
 * Lightweight motion boundary. The UI owns transition CSS and honors the
 * user's reduced-motion preference; animation metadata is intentionally not
 * coupled to a third-party runtime.
 */
import {
  type ComponentType,
  createElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function AnimatePresence({
  children,
}: {
  children?: ReactNode;
  initial?: boolean;
  mode?: string;
}) {
  return <>{children}</>;
}

type MotionProps = Record<string, unknown> & {
  children?: ReactNode;
  className?: string;
};
const motionProps = new Set([
  "initial",
  "animate",
  "exit",
  "transition",
  "whileHover",
  "whileTap",
  "layout",
  "layoutId",
]);
const motionComponents = new Map<string, ComponentType<MotionProps>>();
const motion = new Proxy({} as Record<string, ComponentType<MotionProps>>, {
  get: (_target, tag: string) => {
    const existing = motionComponents.get(tag);
    if (existing) {
      return existing;
    }
    const component: ComponentType<MotionProps> = (props) => {
      const cleanProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !motionProps.has(key))
      );
      return createElement(tag, cleanProps, props.children);
    };
    motionComponents.set(tag, component);
    return component;
  },
});

export { motion };
