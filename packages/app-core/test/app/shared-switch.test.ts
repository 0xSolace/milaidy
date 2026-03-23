// @vitest-environment jsdom
import { Switch } from "@miladyai/ui";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

describe("Switch (re-exported from @miladyai/ui)", () => {
  it("renders without crashing", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(Switch, { checked: false }),
      );
    });

    expect(tree.toJSON()).not.toBeNull();
  });
});
