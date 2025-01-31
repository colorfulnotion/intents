import { zeroAddress } from "viem";

export const networkIds = {
  opstack: 357,
  sepolia: 11155111,
  ink: 763373,
};

const knownNetworks = {
  [networkIds.sepolia]: {
    name: "Sepolia",
    chainId: 11155111,
    rpc: "",
    wss: "",
    explorer: "https://sepolia.etherscan.io/",
    icon: "https://static.cx.metamask.io/api/v1/tokenIcons/1/0x0000000000000000000000000000000000000000.png",
  },
  [networkIds.ink]: {
    name: "Ink Sepolia",
    chainId: 763373,
    rpc: "https://rpc-gel-sepolia.inkonchain.com",
    wss: "wss://rpc-gel-sepolia.inkonchain.com",
    explorer: "https://explorer-sepolia.inkonchain.com/",
    docs: "https://blog.kraken.com/product/ink-testnet",
    icon: "http://localhost:3000/ink_sepolia.svg",
  },
  [networkIds.opstack]: {
    name: "OP Stack Rollup",
    chainId: 357,
    rpc: "https://rpc-jam-ccw030wxbz.t.conduit.xyz/Pwe4skpfPaM8HSTPwHDhXzoJoKqdpjfRQ",
    wss: "wss://rpc-jam-ccw030wxbz.t.conduit.xyz/Pwe4skpfPaM8HSTPwHDhXzoJoKqdpjfRQ",
    explorer: "https://explorer-jam-ccw030wxbz.t.conduit.xyz/",
    icon: "http://localhost:3000/op_stack.jpeg",
  },
};

const knownContracts = {
  intentFactory: {
    [networkIds.sepolia]: "0x9065Bd9D33770B38cDAf0761Bc626cf5fA45ae68",
    [networkIds.ink]: "0x9065Bd9D33770B38cDAf0761Bc626cf5fA45ae68",
    [networkIds.opstack]: "0x9065Bd9D33770B38cDAf0761Bc626cf5fA45ae68",
  },
};

export const ExplorerLink = (chainId) => {
  return knownNetworks[chainId].explorer;
};

export const ChainIconLink = (chainId) => {
  return knownNetworks[chainId].icon;
};

export const getContractAddress = (chainId, name) => {
  try {
    return knownContracts[name][chainId];
  } catch (error) {
    return zeroAddress;
  }
};

export const tokenIds = {
  usdt: "usdt",
  wbtc: "wbtc",
};

const knownTokens = {
  usdt: {
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    icon: "https://static.cx.metamask.io/api/v1/tokenIcons/1/0xdac17f958d2ee523a2206206994597c13d831ec7.png",
    addresses: {
      [networkIds.sepolia]: "0xBF882Fc99800A93494fe4844DC0002FcbaA79A7A",
      [networkIds.ink]: "0xBF882Fc99800A93494fe4844DC0002FcbaA79A7A",
      [networkIds.opstack]: "0xBF882Fc99800A93494fe4844DC0002FcbaA79A7A",
    },
  },
  wbtc: {
    name: "wrapped BTC",
    symbol: "WBTC",
    decimals: 18,
    icon: "https://static.cx.metamask.io/api/v1/tokenIcons/1/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png",
    addresses: {
      [networkIds.sepolia]: "0xc580C2C0005798751cd0c221292667deeb991157",
      [networkIds.ink]: "0xc580C2C0005798751cd0c221292667deeb991157",
      [networkIds.opstack]: "0xc580C2C0005798751cd0c221292667deeb991157",
    },
  },
};

export const getToken = (chainId, symbol) => {
  try {
    return {
      ...knownTokens[symbol],
      addresses: undefined,
      address: knownTokens[symbol].addresses[chainId],
    };
  } catch (error) {
    return {
      name: "",
      symbol: "",
      decimals: 18,
      icon: "",
      address: zeroAddress,
    };
  }
};

export const getTokens = () => {
  return [knownTokens.usdt, knownTokens.wbtc];
};
