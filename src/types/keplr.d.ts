interface KeplrSignArbitraryResponse {
  readonly signature: string;
  readonly pub_key: {
    readonly type: string;
    readonly value: string;
  };
}

interface Keplr {
  experimentalSuggestChain(chainInfo: unknown): Promise<void>;
  enable(chainId: string): Promise<void>;
  getKey(chainId: string): Promise<{
    bech32Address: string;
    pubKey: Uint8Array;
    name: string;
  }>;
  signArbitrary(
    chainId: string,
    signer: string,
    data: string,
  ): Promise<KeplrSignArbitraryResponse>;
}

interface Window {
  keplr?: Keplr;
}
