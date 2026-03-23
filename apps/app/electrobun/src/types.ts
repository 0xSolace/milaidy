export type SendToWebview = (message: string, payload?: unknown) => void;

/**
 * Structural type for accessing evaluateJavascriptWithResponse via requestProxy.
 * `requestProxy` is present at runtime on every createRPC result but is not
 * reflected in the base RPCWithTransport interface exported by electrobun.
 */
export type WebviewEvalRpc = {
  requestProxy?: {
    evaluateJavascriptWithResponse?: (params: {
      script: string;
    }) => Promise<unknown>;
  };
};

export type RpcMessageListener = (payload: unknown) => void;
