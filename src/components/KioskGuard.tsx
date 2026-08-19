"use client";

// Global kiosk hardening that CSS can't express: swallow the browser gestures
// and shortcuts that let a ghost touch, a squeeze, or a stray key knock a guest
// out of the booth. Mounted once in the root layout.
//
// SCOPE: this is the in-browser layer. It stops the *app* from zooming,
// navigating away, opening menus, or crashing on a bad touch. It deliberately
// does NOT try to block Alt+F4, Ctrl+W, the Windows key, Alt+Tab, or Windows
// edge-swipes — a web page cannot intercept those. "Only certain keys may exit"
// is a Windows Keyboard Filter / Assigned Access job. See KIOSK_SETUP.md.

import { useEffect } from "react";

export function KioskGuard() {
  useEffect(() => {
    // Long-press / right-click context menu.
    const onContextMenu = (e: Event) => e.preventDefault();

    // Dragging an image or selection off its place.
    const onDragStart = (e: Event) => e.preventDefault();

    // Ctrl + wheel = zoom. Kill it before the browser reads it.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    // Safari/trackpad pinch events (no-op on the kiosk's Chrome, harmless).
    const onGesture = (e: Event) => e.preventDefault();

    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Backspace navigates "back" when it isn't in a text field — a classic
      // way to fall off the current screen. Only allow it while typing.
      if (e.key === "Backspace" && !isTypingTarget(e.target)) {
        e.preventDefault();
        return;
      }
      // Ctrl +/-/0 zoom the page out of the kiosk layout.
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) {
        e.preventDefault();
      }
    };

    // passive:false is required so preventDefault actually blocks the gesture.
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("gesturestart", onGesture as EventListener);
    document.addEventListener("gesturechange", onGesture as EventListener);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("gesturestart", onGesture as EventListener);
      document.removeEventListener("gesturechange", onGesture as EventListener);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
