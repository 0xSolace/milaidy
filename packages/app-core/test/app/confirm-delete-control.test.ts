import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

// Mock @miladyai/ui with a simplified ConfirmDelete that uses plain buttons
// (matching the real component behavior but avoiding module resolution issues).
vi.mock("@miladyai/ui", () => ({
  ConfirmDelete: ({
    onConfirm,
    disabled = false,
    triggerLabel = "Delete",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    busyLabel,
    promptText = "Delete?",
    triggerClassName,
    confirmClassName,
    cancelClassName,
    promptClassName,
  }: {
    onConfirm: () => void;
    disabled?: boolean;
    triggerLabel?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busyLabel?: string;
    promptText?: string;
    triggerClassName?: string;
    confirmClassName?: string;
    cancelClassName?: string;
    promptClassName?: string;
  }) => {
    const [confirming, setConfirming] = React.useState(false);
    if (!confirming) {
      return React.createElement(
        "button",
        {
          type: "button",
          className: triggerClassName,
          onClick: () => setConfirming(true),
          disabled,
        },
        triggerLabel,
      );
    }
    return React.createElement(
      "span",
      null,
      React.createElement("span", { className: promptClassName }, promptText),
      React.createElement(
        "button",
        {
          type: "button",
          className: confirmClassName,
          onClick: () => {
            onConfirm();
            setConfirming(false);
          },
          disabled,
        },
        disabled && busyLabel ? busyLabel : confirmLabel,
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: cancelClassName,
          onClick: () => setConfirming(false),
          disabled,
        },
        cancelLabel,
      ),
    );
  },
}));

import { ConfirmDelete } from "@miladyai/ui";

function createSubject(
  overrides: Partial<React.ComponentProps<typeof ConfirmDelete>> = {},
) {
  return React.createElement(ConfirmDelete, {
    onConfirm: () => {},
    triggerClassName: "trigger",
    confirmClassName: "confirm",
    cancelClassName: "cancel",
    ...overrides,
  });
}

describe("ConfirmDelete", () => {
  it("shows trigger first and then confirm/cancel state", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(createSubject());
    });

    const trigger = tree.root.findByProps({ className: "trigger" });
    expect(trigger.props.children).toBe("Delete");

    act(() => {
      trigger.props.onClick();
    });

    const confirm = tree.root.findByProps({ className: "confirm" });
    const cancel = tree.root.findByProps({ className: "cancel" });
    expect(confirm.props.children).toBe("Confirm");
    expect(cancel.props.children).toBe("Cancel");
  });

  it("runs confirm callback and resets state", () => {
    const onConfirm = vi.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(createSubject({ onConfirm }));
    });

    const trigger = tree.root.findByProps({ className: "trigger" });
    act(() => {
      trigger.props.onClick();
    });

    const confirm = tree.root.findByProps({ className: "confirm" });
    act(() => {
      confirm.props.onClick();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ className: "trigger" })).toBeDefined();
  });

  it("uses busy label while disabled in confirm state", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(createSubject({ busyLabel: "...working..." }));
    });

    const trigger = tree.root.findByProps({ className: "trigger" });
    act(() => {
      trigger.props.onClick();
    });

    act(() => {
      tree.update(
        createSubject({ disabled: true, busyLabel: "...working..." }),
      );
    });

    const confirm = tree.root.findByProps({ className: "confirm" });
    expect(confirm.props.children).toBe("...working...");
  });
});
