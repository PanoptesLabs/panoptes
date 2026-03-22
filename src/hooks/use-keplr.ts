"use client";

import { useState, useCallback } from "react";
import { REPUBLIC_CHAIN } from "@/lib/constants";

interface KeplrKey {
  bech32Address: string;
  pubKey: Uint8Array;
  name: string;
}

interface KeplrState {
  address: string | null;
  pubKey: string | null;
  name: string | null;
  isConnecting: boolean;
  error: string | null;
}

const CHAIN_ID = REPUBLIC_CHAIN.chainId;

const CHAIN_INFO = {
  chainId: CHAIN_ID,
  chainName: "Republic AI Testnet",
  rpc: REPUBLIC_CHAIN.rpcUrl,
  rest: REPUBLIC_CHAIN.restUrl,
  bip44: { coinType: 60 },
  bech32Config: {
    bech32PrefixAccAddr: "rai",
    bech32PrefixAccPub: "raipub",
    bech32PrefixValAddr: "raivaloper",
    bech32PrefixValPub: "raivaloperpub",
    bech32PrefixConsAddr: "raivalcons",
    bech32PrefixConsPub: "raivalconspub",
  },
  currencies: [{ coinDenom: "RAI", coinMinimalDenom: "arai", coinDecimals: 18 }],
  feeCurrencies: [{ coinDenom: "RAI", coinMinimalDenom: "arai", coinDecimals: 18, gasPriceStep: { low: 0.01, average: 0.025, high: 0.04 } }],
  stakeCurrency: { coinDenom: "RAI", coinMinimalDenom: "arai", coinDecimals: 18 },
  features: ["eth-address-gen", "eth-key-sign"],
};

function getKeplr() {
  if (typeof window === "undefined") return null;
  return window.keplr ?? null;
}

export function useKeplr() {
  const [state, setState] = useState<KeplrState>({
    address: null,
    pubKey: null,
    name: null,
    isConnecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const keplr = getKeplr();
      if (!keplr) {
        setState((s) => ({ ...s, isConnecting: false, error: "Keplr extension not found" }));
        return null;
      }

      // Suggest chain in case it's not added yet
      try {
        await keplr.experimentalSuggestChain(CHAIN_INFO);
      } catch {
        // User may reject, but enable might still work if chain exists
      }

      await keplr.enable(CHAIN_ID);
      const key: KeplrKey = await keplr.getKey(CHAIN_ID);

      const pubKeyBase64 = btoa(
        String.fromCharCode(...key.pubKey),
      );

      setState({
        address: key.bech32Address,
        pubKey: pubKeyBase64,
        name: key.name,
        isConnecting: false,
        error: null,
      });

      return { address: key.bech32Address, pubKey: pubKeyBase64 };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setState((s) => ({ ...s, isConnecting: false, error: message }));
      return null;
    }
  }, []);

  const signArbitrary = useCallback(
    async (data: string, signerAddress?: string) => {
      const keplr = getKeplr();
      const addr = signerAddress ?? state.address;
      if (!keplr || !addr) return null;

      try {
        const response = await keplr.signArbitrary(CHAIN_ID, addr, data);
        return response.signature as string;
      } catch {
        return null;
      }
    },
    [state.address],
  );

  const disconnect = useCallback(() => {
    setState({
      address: null,
      pubKey: null,
      name: null,
      isConnecting: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    isInstalled: typeof window !== "undefined" && !!getKeplr(),
    connect,
    signArbitrary,
    disconnect,
  };
}
