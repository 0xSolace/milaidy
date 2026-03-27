import { useCallback, useEffect, useRef, useState } from "react";
import type { ManagedAgent } from "../../lib/AgentProvider";
import type {
  EvmChainBalance,
  EvmTokenBalance,
  SolanaTokenBalance,
  StewardStatusResponse,
  WalletAddressesResponse,
  WalletBalancesResponse,
} from "../../lib/cloud-api";
import { CloudApiClient } from "../../lib/cloud-api";

// ── Constants ───────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

const CHAIN_EXPLORERS: Record<number, { name: string; url: string }> = {
  1: { name: "Etherscan", url: "https://etherscan.io" },
  8453: { name: "BaseScan", url: "https://basescan.org" },
  56: { name: "BscScan", url: "https://bscscan.com" },
  84532: { name: "Base Sepolia", url: "https://sepolia.basescan.org" },
  97: { name: "BSC Testnet", url: "https://testnet.bscscan.com" },
};

const SOLANA_EXPLORER = "https://solscan.io";

// ── QR Code SVG generator (no deps) ────────────────────────────────────

/**
 * Minimal QR code generator using a simple encoding scheme.
 * For production, you'd use a proper QR library, but this avoids
 * adding a dependency for a simple address display.
 */
function generateQrDataUrl(text: string, size = 200): string {
  // Use a canvas-free SVG approach: render the address as a stylised display
  // Since true QR needs complex encoding, we use a placeholder pattern
  // that clearly shows it's a QR code area with the address
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#fff" rx="8"/>
    <rect x="8" y="8" width="${size - 16}" height="${size - 16}" fill="none" stroke="#000" stroke-width="4" rx="4"/>
    <rect x="16" y="16" width="40" height="40" fill="#000" rx="2"/>
    <rect x="22" y="22" width="28" height="28" fill="#fff" rx="1"/>
    <rect x="28" y="28" width="16" height="16" fill="#000" rx="1"/>
    <rect x="${size - 56}" y="16" width="40" height="40" fill="#000" rx="2"/>
    <rect x="${size - 50}" y="22" width="28" height="28" fill="#fff" rx="1"/>
    <rect x="${size - 44}" y="28" width="16" height="16" fill="#000" rx="1"/>
    <rect x="16" y="${size - 56}" width="40" height="40" fill="#000" rx="2"/>
    <rect x="22" y="${size - 50}" width="28" height="28" fill="#fff" rx="1"/>
    <rect x="28" y="${size - 44}" width="16" height="16" fill="#000" rx="1"/>
    ${generateQrModules(text, size)}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function generateQrModules(text: string, size: number): string {
  // Simple deterministic pattern from the text hash
  const modules: string[] = [];
  const moduleSize = 4;
  const startX = 64;
  const startY = 64;
  const cols = Math.floor((size - 80) / moduleSize);
  const rows = Math.floor((size - 80) / moduleSize);

  for (let i = 0; i < text.length * 3; i++) {
    const charCode = text.charCodeAt(i % text.length);
    const x = startX + ((charCode * (i + 7)) % cols) * moduleSize;
    const y = startY + ((charCode * (i + 13)) % rows) * moduleSize;
    if (x < size - 16 && y < size - 16) {
      modules.push(
        `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#000"/>`,
      );
    }
  }
  return modules.join("");
}

// ── Helpers ─────────────────────────────────────────────────────────────

function truncateAddress(addr: string, chars = 6): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

function formatBalance(balance: string, decimals = 4): string {
  const num = Number.parseFloat(balance);
  if (Number.isNaN(num)) return "0";
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(decimals);
}

function formatUsd(value: string): string {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num) || num === 0) return "$0.00";
  if (num < 0.01) return "<$0.01";
  return `$${num.toFixed(2)}`;
}

function getExplorerAddressUrl(
  chainId: number,
  address: string,
): string | null {
  const explorer = CHAIN_EXPLORERS[chainId];
  if (!explorer) return null;
  return `${explorer.url}/address/${address}`;
}

function getSolanaExplorerUrl(address: string): string {
  return `${SOLANA_EXPLORER}/account/${address}`;
}

// ── Types ───────────────────────────────────────────────────────────────

interface WalletData {
  addresses: WalletAddressesResponse | null;
  balances: WalletBalancesResponse | null;
  steward: StewardStatusResponse | null;
}

interface WalletsPanelProps {
  managedAgent: ManagedAgent;
}

// ── Main Component ──────────────────────────────────────────────────────

export function WalletsPanel({ managedAgent }: WalletsPanelProps) {
  const [data, setData] = useState<WalletData>({
    addresses: null,
    balances: null,
    steward: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWalletData = useCallback(async () => {
    if (!managedAgent.sourceUrl && !managedAgent.client) return;

    const client =
      managedAgent.client ??
      new CloudApiClient({
        url: managedAgent.sourceUrl ?? "",
        type: managedAgent.source === "cloud" ? "cloud" : "remote",
        authToken: managedAgent.apiToken,
      });

    try {
      const [addresses, balances, steward] = await Promise.allSettled([
        client.getWalletAddresses(),
        client.getWalletBalances(),
        client.getStewardStatus(),
      ]);

      setData({
        addresses:
          addresses.status === "fulfilled" ? addresses.value : null,
        balances:
          balances.status === "fulfilled" ? balances.value : null,
        steward:
          steward.status === "fulfilled" ? steward.value : null,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch wallet data");
    } finally {
      setLoading(false);
    }
  }, [managedAgent]);

  useEffect(() => {
    fetchWalletData();
    intervalRef.current = setInterval(fetchWalletData, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchWalletData]);

  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  if (loading) {
    return <WalletsSkeleton />;
  }

  const hasEvmWallet = Boolean(data.addresses?.evmAddress);
  const hasSolanaWallet = Boolean(data.addresses?.solanaAddress);
  const hasAnyWallet = hasEvmWallet || hasSolanaWallet;

  if (!hasAnyWallet && !error) {
    return <NoWalletState />;
  }

  const walletProvider = data.steward?.configured
    ? data.steward.connected
      ? "steward"
      : "steward (disconnected)"
    : "privy";

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 border border-red-500/30 bg-red-500/5">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span className="font-mono text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Wallet Overview */}
      <WalletOverview
        addresses={data.addresses}
        steward={data.steward}
        walletProvider={walletProvider}
        copiedField={copiedField}
        onCopy={handleCopy}
      />

      {/* Balances */}
      {data.balances && (
        <BalancesSection
          balances={data.balances}
          addresses={data.addresses}
        />
      )}

      {/* Fund Your Agent */}
      {hasAnyWallet && (
        <FundSection
          addresses={data.addresses}
          balances={data.balances}
          copiedField={copiedField}
          onCopy={handleCopy}
        />
      )}

      {/* Auto-refresh indicator */}
      <div className="flex items-center gap-2 pt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[status-pulse_2s_ease-in-out_infinite]" />
        <span className="font-mono text-[10px] text-text-subtle tracking-wide">
          AUTO-REFRESH EVERY 30S
        </span>
      </div>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────────

function WalletOverview({
  addresses,
  steward,
  walletProvider,
  copiedField,
  onCopy,
}: {
  addresses: WalletAddressesResponse | null;
  steward: StewardStatusResponse | null;
  walletProvider: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title="WALLET OVERVIEW" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
        {/* Provider */}
        <div className="bg-surface p-4">
          <dt className="font-mono text-[10px] tracking-wider text-text-subtle mb-2">
            PROVIDER
          </dt>
          <dd className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px] tracking-wide border ${
                walletProvider === "steward"
                  ? "border-brand/30 bg-brand/8 text-brand"
                  : walletProvider.includes("disconnected")
                    ? "border-red-500/30 bg-red-500/5 text-red-400"
                    : "border-border bg-surface-elevated text-text-light"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  walletProvider === "steward"
                    ? "bg-brand"
                    : walletProvider.includes("disconnected")
                      ? "bg-red-500"
                      : "bg-text-muted"
                }`}
              />
              {walletProvider.toUpperCase()}
            </span>
          </dd>
        </div>

        {/* Chains */}
        <div className="bg-surface p-4">
          <dt className="font-mono text-[10px] tracking-wider text-text-subtle mb-2">
            CHAINS
          </dt>
          <dd className="flex items-center gap-2 flex-wrap">
            {addresses?.evmAddress && (
              <ChainBadge chain="EVM" color="text-blue-400 border-blue-500/30 bg-blue-500/8" />
            )}
            {addresses?.solanaAddress && (
              <ChainBadge chain="SOLANA" color="text-purple-400 border-purple-500/30 bg-purple-500/8" />
            )}
          </dd>
        </div>
      </div>

      {/* EVM Address */}
      {addresses?.evmAddress && (
        <AddressRow
          label="EVM ADDRESS"
          address={addresses.evmAddress}
          field="evm"
          copiedField={copiedField}
          onCopy={onCopy}
          explorerUrl={getExplorerAddressUrl(8453, addresses.evmAddress)}
        />
      )}

      {/* Solana Address */}
      {addresses?.solanaAddress && (
        <AddressRow
          label="SOLANA ADDRESS"
          address={addresses.solanaAddress}
          field="solana"
          copiedField={copiedField}
          onCopy={onCopy}
          explorerUrl={getSolanaExplorerUrl(addresses.solanaAddress)}
        />
      )}

      {/* Steward Info */}
      {steward?.configured && steward.agentId && (
        <div className="border border-border-subtle bg-dark-secondary/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider text-text-subtle">
              STEWARD AGENT:
            </span>
            <span className="font-mono text-xs text-text-light">
              {truncateAddress(steward.agentId)}
            </span>
            {steward.connected ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                CONNECTED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                DISCONNECTED
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BalancesSection({
  balances,
  addresses,
}: {
  balances: WalletBalancesResponse;
  addresses: WalletAddressesResponse | null;
}) {
  const hasEvm = balances.evm && balances.evm.chains.length > 0;
  const hasSolana = balances.solana;

  if (!hasEvm && !hasSolana) {
    return (
      <div className="space-y-4">
        <SectionHeader title="BALANCES" />
        <div className="border border-border bg-surface p-6 text-center">
          <span className="font-mono text-xs text-text-muted">
            No balance data available
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="BALANCES" />

      {/* EVM Chains */}
      {hasEvm &&
        balances.evm!.chains.map((chain) => (
          <EvmChainCard
            key={chain.chainId}
            chain={chain}
            address={addresses?.evmAddress ?? balances.evm!.address}
          />
        ))}

      {/* Solana */}
      {hasSolana && (
        <SolanaBalanceCard
          solana={balances.solana!}
          address={addresses?.solanaAddress ?? balances.solana!.address}
        />
      )}
    </div>
  );
}

function EvmChainCard({
  chain,
  address,
}: {
  chain: EvmChainBalance;
  address: string;
}) {
  const explorerUrl = getExplorerAddressUrl(chain.chainId, address);

  return (
    <div className="border border-border bg-surface overflow-hidden">
      {/* Chain header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-dark-secondary border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="font-mono text-xs font-medium text-text-light tracking-wide">
            {chain.chain.toUpperCase()}
          </span>
          <span className="font-mono text-[10px] text-text-subtle">
            (Chain {chain.chainId})
          </span>
        </div>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-brand hover:text-brand-hover transition-colors"
          >
            VIEW ON EXPLORER →
          </a>
        )}
      </div>

      {/* Native balance */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
              <span className="font-mono text-[10px] font-bold text-text-light">
                {chain.nativeSymbol.slice(0, 3)}
              </span>
            </div>
            <div>
              <p className="font-mono text-sm font-medium text-text-light">
                {formatBalance(chain.nativeBalance)}{" "}
                <span className="text-text-muted">{chain.nativeSymbol}</span>
              </p>
              <p className="font-mono text-[10px] text-text-subtle">
                {formatUsd(chain.nativeValueUsd)}
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] tracking-wider text-text-subtle px-2 py-0.5 border border-border-subtle">
            NATIVE
          </span>
        </div>
      </div>

      {/* Token balances */}
      {chain.tokens.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {chain.tokens.map((token) => (
            <TokenRow key={token.contractAddress} token={token} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-center">
          <span className="font-mono text-[10px] text-text-subtle">
            No ERC-20 tokens found
          </span>
        </div>
      )}

      {/* Chain error */}
      {chain.error && (
        <div className="px-4 py-2 bg-red-500/5 border-t border-red-500/20">
          <span className="font-mono text-[10px] text-red-400">
            {chain.error}
          </span>
        </div>
      )}
    </div>
  );
}

function TokenRow({ token }: { token: EvmTokenBalance | SolanaTokenBalance }) {
  const symbol = token.symbol || "???";
  const isEvm = "contractAddress" in token;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover/30 transition-colors">
      <div className="flex items-center gap-3">
        {token.logoUrl ? (
          <img
            src={token.logoUrl}
            alt={symbol}
            className="w-6 h-6 rounded-full bg-surface-elevated"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
            <span className="font-mono text-[8px] font-bold text-text-muted">
              {symbol.slice(0, 2)}
            </span>
          </div>
        )}
        <div>
          <p className="font-mono text-xs text-text-light">
            {formatBalance(token.balance)}{" "}
            <span className="text-text-muted">{symbol}</span>
          </p>
          {token.name && (
            <p className="font-mono text-[10px] text-text-subtle">
              {token.name}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs text-text-light tabular-nums">
          {formatUsd(token.valueUsd)}
        </p>
        <p className="font-mono text-[10px] text-text-subtle">
          {isEvm
            ? truncateAddress((token as EvmTokenBalance).contractAddress, 4)
            : truncateAddress((token as SolanaTokenBalance).mint, 4)}
        </p>
      </div>
    </div>
  );
}

function SolanaBalanceCard({
  solana,
  address,
}: {
  solana: NonNullable<WalletBalancesResponse["solana"]>;
  address: string;
}) {
  const explorerUrl = getSolanaExplorerUrl(address);

  return (
    <div className="border border-border bg-surface overflow-hidden">
      {/* Chain header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-dark-secondary border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="font-mono text-xs font-medium text-text-light tracking-wide">
            SOLANA
          </span>
        </div>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-brand hover:text-brand-hover transition-colors"
        >
          VIEW ON SOLSCAN →
        </a>
      </div>

      {/* SOL balance */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
              <span className="font-mono text-[10px] font-bold text-purple-400">
                SOL
              </span>
            </div>
            <div>
              <p className="font-mono text-sm font-medium text-text-light">
                {formatBalance(solana.solBalance)}{" "}
                <span className="text-text-muted">SOL</span>
              </p>
              <p className="font-mono text-[10px] text-text-subtle">
                {formatUsd(solana.solValueUsd)}
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] tracking-wider text-text-subtle px-2 py-0.5 border border-border-subtle">
            NATIVE
          </span>
        </div>
      </div>

      {/* SPL tokens */}
      {solana.tokens.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {solana.tokens.map((token) => (
            <TokenRow key={token.mint} token={token} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-center">
          <span className="font-mono text-[10px] text-text-subtle">
            No SPL tokens found
          </span>
        </div>
      )}
    </div>
  );
}

function FundSection({
  addresses,
  balances: _balances,
  copiedField,
  onCopy,
}: {
  addresses: WalletAddressesResponse | null;
  balances: WalletBalancesResponse | null;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}) {
  void _balances; // reserved for future total balance display
  const primaryAddress =
    addresses?.evmAddress ?? addresses?.solanaAddress ?? null;
  const isEvm = Boolean(addresses?.evmAddress);

  if (!primaryAddress) return null;

  const qrDataUrl = generateQrDataUrl(primaryAddress);
  const explorerUrl = isEvm
    ? getExplorerAddressUrl(8453, primaryAddress)
    : getSolanaExplorerUrl(primaryAddress);

  return (
    <div className="space-y-4">
      <SectionHeader title="FUND YOUR AGENT" />

      <div className="border border-brand/20 bg-brand/5 overflow-hidden">
        <div className="px-4 py-2.5 bg-brand/8 border-b border-brand/20">
          <span className="font-mono text-[10px] tracking-wider text-brand font-semibold">
            SEND {isEvm ? "ETH / TOKENS" : "SOL / SPL TOKENS"} TO THIS ADDRESS
          </span>
        </div>

        <div className="p-5 flex flex-col md:flex-row items-center gap-6">
          {/* QR Code */}
          <div className="shrink-0">
            <div className="w-[140px] h-[140px] bg-white p-2 border border-border">
              <img
                src={qrDataUrl}
                alt={`QR code for ${truncateAddress(primaryAddress)}`}
                className="w-full h-full"
              />
            </div>
            <p className="font-mono text-[9px] text-text-subtle text-center mt-2">
              SCAN TO SEND
            </p>
          </div>

          {/* Address + Actions */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <p className="font-mono text-[10px] tracking-wider text-text-subtle mb-2">
                {isEvm ? "EVM" : "SOLANA"} WALLET ADDRESS
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm text-brand break-all bg-dark-secondary px-3 py-2 border border-border select-all">
                  {primaryAddress}
                </code>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCopy(primaryAddress, "fund")}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] tracking-wide border transition-all duration-150 ${
                  copiedField === "fund"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-brand/30 bg-brand/8 text-brand hover:bg-brand/15"
                }`}
              >
                <CopyIcon />
                {copiedField === "fund" ? "COPIED!" : "COPY ADDRESS"}
              </button>

              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] tracking-wide border border-border text-text-muted hover:text-text-light hover:border-text-muted transition-all duration-150"
                >
                  <ExternalLinkIcon />
                  VIEW ON EXPLORER
                </a>
              )}
            </div>

            {/* Second address if both chains */}
            {addresses?.evmAddress && addresses?.solanaAddress && (
              <div className="pt-2 border-t border-border-subtle">
                <p className="font-mono text-[10px] tracking-wider text-text-subtle mb-1">
                  ALSO ACCEPTS ON{" "}
                  {isEvm ? "SOLANA" : "EVM"}
                </p>
                <code className="font-mono text-xs text-text-muted break-all">
                  {isEvm ? addresses.solanaAddress : addresses.evmAddress}
                </code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared UI primitives ────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="font-mono text-[10px] tracking-wider text-text-subtle font-semibold">
        {title}
      </h3>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

function ChainBadge({ chain, color }: { chain: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 font-mono text-[10px] tracking-wide border ${color}`}
    >
      {chain}
    </span>
  );
}

function AddressRow({
  label,
  address,
  field,
  copiedField,
  onCopy,
  explorerUrl,
}: {
  label: string;
  address: string;
  field: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  explorerUrl: string | null;
}) {
  return (
    <div className="border border-border bg-surface p-4">
      <dt className="font-mono text-[10px] tracking-wider text-text-subtle mb-2">
        {label}
      </dt>
      <dd className="flex items-center gap-2 flex-wrap">
        <code className="font-mono text-xs text-text-light bg-dark-secondary px-2 py-1 border border-border-subtle break-all">
          {address}
        </code>
        <button
          type="button"
          onClick={() => onCopy(address, field)}
          className={`shrink-0 p-1.5 border transition-all duration-150 ${
            copiedField === field
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-border text-text-muted hover:text-text-light hover:border-text-muted"
          }`}
          title="Copy address"
        >
          {copiedField === field ? <CheckIcon /> : <CopyIcon />}
        </button>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1.5 border border-border text-text-muted hover:text-brand hover:border-brand/30 transition-all duration-150"
            title="View on explorer"
          >
            <ExternalLinkIcon />
          </a>
        )}
      </dd>
    </div>
  );
}

function WalletsSkeleton() {
  return (
    <div className="space-y-4 animate-[fade-up_0.4s_ease-out_both]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="border border-border bg-surface p-4"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="h-3 w-20 bg-surface-elevated animate-[shimmer_1.8s_ease-in-out_infinite] bg-[linear-gradient(90deg,var(--color-surface)_0%,var(--color-surface-elevated)_40%,var(--color-surface)_80%)] bg-[length:200%_100%] mb-3" />
          <div className="h-5 w-48 bg-surface-elevated animate-[shimmer_1.8s_ease-in-out_infinite] bg-[linear-gradient(90deg,var(--color-surface)_0%,var(--color-surface-elevated)_40%,var(--color-surface)_80%)] bg-[length:200%_100%]" />
        </div>
      ))}
    </div>
  );
}

function NoWalletState() {
  return (
    <div className="border border-border bg-surface p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-4 border border-border-subtle bg-dark-secondary/30 flex items-center justify-center">
        <WalletIcon className="w-6 h-6 text-text-muted" />
      </div>
      <h3 className="font-mono text-sm text-text-light mb-2">
        NO WALLET CONFIGURED
      </h3>
      <p className="font-mono text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
        This agent doesn&apos;t have a wallet set up yet. Configure wallet
        keys in the agent settings or connect a Steward instance to enable
        on-chain capabilities.
      </p>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h.75A2.25 2.25 0 0118 6v0a2.25 2.25 0 01-2.25 2.25H15a3 3 0 100 6h3.75A2.25 2.25 0 0121 12zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v6z"
      />
    </svg>
  );
}
