import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

// Mock @miladyai/ui Dialog components to render inline (no Radix portals)
// so react-test-renderer does not crash with parentInstance.children.indexOf.
vi.mock("@miladyai/ui", () => {
  const passthrough = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("div", props, children);
  return {
    Dialog: ({
      children,
      open,
    }: React.PropsWithChildren<{ open?: boolean; onOpenChange?: unknown }>) =>
      open ? React.createElement(React.Fragment, null, children) : null,
    DialogContent: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", { role: "dialog", ...props }, children),
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
    DialogFooter: passthrough,
    DialogTrigger: passthrough,
    DialogClose: passthrough,
    DialogOverlay: passthrough,
    DialogPortal: passthrough,
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      React.createElement("button", { type: "button", ...props }, children),
    Input: React.forwardRef<
      HTMLInputElement,
      React.InputHTMLAttributes<HTMLInputElement>
    >((props, ref) => React.createElement("input", { ...props, ref })),
  };
});

vi.mock("@miladyai/app-core/state", () => ({
  useApp: () => ({ t: (key: string) => key }),
}));

import { SaveCommandModal } from "@miladyai/app-core/components";

describe("SaveCommandModal keyboard behavior", () => {
  it("closes only on Escape from dialog keydown", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(SaveCommandModal, {
          open: true,
          text: "test content",
          onSave,
          onClose,
        }),
      );
    });

    const dialog = tree.root.findByProps({ role: "dialog" });
    const preventDefault = vi.fn();

    act(() => {
      dialog.props.onKeyDown({ key: "Enter", preventDefault });
      dialog.props.onKeyDown({ key: " ", preventDefault });
      dialog.props.onKeyDown({ key: "Escape", preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Enter during IME composition", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(SaveCommandModal, {
          open: true,
          text: "test content",
          onSave,
          onClose,
        }),
      );
    });

    const input = tree.root.findByType("input");

    act(() => {
      input.props.onChange({ target: { value: "my-command" } });
      input.props.onKeyDown({
        key: "Enter",
        nativeEvent: { isComposing: true },
      });
    });

    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      input.props.onKeyDown({
        key: "Enter",
        nativeEvent: { isComposing: false },
      });
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("my-command");
  });

  it("wires validation error state to input aria attributes", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(SaveCommandModal, {
          open: true,
          text: "test content",
          onSave,
          onClose,
        }),
      );
    });

    const saveButton = tree.root.find(
      (node) =>
        node.type === "button" && node.props.children === "apikeyconfig.save",
    );

    act(() => {
      saveButton.props.onClick();
    });

    const input = tree.root.find((node) => node.type === "input");
    const errorText = tree.root.find(
      (node) => node.type === "p" && node.props.children === "Name is required",
    );

    expect(input.props["aria-invalid"]).toBe("true");
    expect(input.props["aria-describedby"]).toBe(errorText.props.id);
  });
});
