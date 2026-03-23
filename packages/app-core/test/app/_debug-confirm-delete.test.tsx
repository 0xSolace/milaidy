// @vitest-environment jsdom
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, it } from "vitest";
import { ConfirmDelete } from "@miladyai/ui";

describe("dump", () => {
  it("shows tree", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(ConfirmDelete, {
          onConfirm: () => {},
          triggerClassName: "trigger",
          confirmClassName: "confirm",
          cancelClassName: "cancel",
        })
      );
    });
    console.log("TREE:", JSON.stringify(tree.toJSON(), null, 2));
    console.log("ALL INSTANCES:", JSON.stringify(
      tree.root.findAll(() => true).map(n => ({
        type: typeof n.type === 'string' ? n.type : 'Component',
        props: n.props,
      })),
      null, 2
    ));
  });
});
