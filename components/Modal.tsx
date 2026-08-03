import React, { useEffect } from "react";

/**
 * One modal shell for the whole app.
 *
 * Modals used to be hand-rolled per screen, which drifted: four different
 * z-index values, three backdrop opacities, and no two behaving the same. The
 * layering constants live here so a modal always sits above the sidebar (z-50),
 * the navbar (z-30) and the cart drawer (z-70), and the backdrop always covers
 * the whole viewport.
 */
export const MODAL_Z_INDEX = 100;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible name for the dialog. */
  label: string;
  /** Tailwind max-width class for the panel. */
  size?: string;
  /** Set false for a dialog that must be answered rather than dismissed. */
  dismissible?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  label,
  size = "max-w-2xl",
  dismissible = true,
}) => {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    // Stop the page behind from scrolling while the modal is up. The layout
    // scrolls an inner <main>, not <body>, so both are pinned.
    const { body, documentElement } = document;
    const previousBody = body.style.overflow;
    const previousRoot = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousBody;
      documentElement.style.overflow = previousRoot;
    };
  }, [dismissible, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain p-4"
      style={{ zIndex: MODAL_Z_INDEX }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {/* Full-viewport backdrop. It also swallows every click that isn't on the
          panel, so nothing behind the modal can be interacted with. */}
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
      />

      <div className={`relative my-8 w-full ${size}`}>{children}</div>
    </div>
  );
};

export default Modal;
