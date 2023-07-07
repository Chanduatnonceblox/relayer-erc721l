import Image from "next/image";
import { Inter } from "next/font/google";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useEnsName,
  useNetwork,
} from "wagmi";
import { useEffect, useState } from "react";
import { useSwitchNetwork } from "wagmi";

import abi from "../utils/abi.json";
import erc721Abi from "../utils/erc721abi.json";
import networks from "../utils/xdapp.config.json";
import { ethers } from "ethers";
import {
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";
import { Approve, Transfer, Withdraw } from "@/Components/Contracts/conttracts";
declare let window: any;

const inter = Inter({ subsets: ["latin"] });

let provider: ethers.providers.Provider | ethers.Signer | undefined;

export default function Home() {
  const { address, connector, isConnected } = useAccount();
  const { switchNetwork } = useSwitchNetwork();
  const { data: ensName } = useEnsName({ address });
  const { chain } = useNetwork();
  const { connect, connectors, error, isLoading, pendingConnector, data } =
    useConnect();
  const { disconnect } = useDisconnect();

  const [domLoaded, setDomLoaded] = useState(false);
  const [isApporved, setIsApproved] = useState(false);
  const [vaaBytes, setVaaBytes] = useState();

  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [selectedChain, setSelectedChain] = useState();
  const [destinationChain, setDestinationChain] = useState();

  let signer = provider?.getSigner();

  let bridgeAddress =
    chain?.id == networks.networks.polygon.chainId
      ? networks.networks.polygon.coreBridgeAddress
      : networks.networks.ethereum.coreBridgeAddress;
  let nftbridgeAddress =
    chain?.id == networks.networks.polygon.chainId
      ? networks.networks.polygon.bridgeAddress
      : networks.networks.ethereum.bridgeAddress;

  let NFTBridgeInstance = new ethers.Contract(nftbridgeAddress, abi, signer);

  useEffect(() => {
    setDomLoaded(true);
    console.log(vaaBytes);
  }, []);

 

  

  const handleSwtichSourceNetwork = async (e: any) => {
    console.log(destinationChain);

    try {
      setSelectedChain(e.target.value);
      setSelectedChain(e.target.value);
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ethers.utils.hexValue(e.target.value) }], // chainId must be in hexadecimal numbers
      });
      provider = new ethers.providers.Web3Provider(window?.ethereum);
      signer = provider?.getSigner();
    } catch (error) {
      console.log(error);
    }
  };

  const handleSwtichDestinationNetwork = async (e: any) => {
    setDestinationChain(e.target.value);
  };

  if (isConnected) {
    return (
      <main>
        {domLoaded && (
          <div className="mt-4">
            <div>{ensName ? `${ensName} (${address})` : address}</div>
            <div>Connected to {connector?.name}</div>
            <button onClick={disconnect}>Disconnect</button>

            <div className="max-w-md mx-auto">
              <form className="w-96">
                <div className="mb-4 grid grid-rows-1 grid-flow-col gap-4">
                  <div>
                    <label
                      htmlFor="SourceChain"
                      className="block text-gray-700 text-sm font-bold mb-2"
                    >
                      Source Chain
                    </label>
                    <div className="mt-2">
                      <select
                        id="SourceChain"
                        name="sourceChain"
                        autoComplete="source-chain"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        onChange={handleSwtichSourceNetwork}
                      >
                        <option value={80001}>Polygon</option>
                        <option value={5}>Ethereum</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="DestinationChain"
                      className="block text-gray-700 text-sm font-bold mb-2"
                    >
                      Destination Chain
                    </label>
                    <div className="mt-2">
                      <select
                        id="DestinationChain"
                        name="DestinationChain"
                        autoComplete="destination-chain"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        onChange={handleSwtichDestinationNetwork}
                      >
                        <option value={5}>Ethereum</option>
                        <option value={80001}>Polygon</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="input1"
                    className="block text-gray-700 text-sm font-bold mb-2"
                  >
                    Token Address:
                  </label>
                  <input
                    id="input1"
                    type="text"
                    value={tokenAddress}
                    placeholder="0xD8E4C2DbDd2e2bd8F1336EA691dBFF6952B1a6eB"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    onChange={(e) => setTokenAddress(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="input2"
                    className="block text-gray-700 text-sm font-bold mb-2"
                  >
                    Token Id:
                  </label>
                  <input
                    id="input2"
                    type="text"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="12345"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
                <div className="flex items-center justify-center">
                  {isApporved ? (
                    <Transfer
                      data={{ tokenAddress: tokenAddress, tokenId: tokenId }}
                      setIsApproved={setIsApproved}
                      setVaaBytes={setVaaBytes}
                    />
                  ) : vaaBytes ? (
                  <Withdraw vaaBytes={vaaBytes} setVaaBytes={setVaaBytes}/>
                  ) : (
                    <Approve
                      tokenAddress={tokenAddress}
                      setIsApproved={setIsApproved}
                    />
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    );
  }
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-24 ${inter.className}`}
    >
      {domLoaded && (
        <div>
          {connectors.map((connector) => (
            <button
              disabled={!connector.ready}
              key={connector.id}
              onClick={() => connect({ connector })}
            >
              {connector.name}
              {!connector.ready && " (unsupported)"}
              {isLoading &&
                connector.id === pendingConnector?.id &&
                " (connecting)"}
            </button>
          ))}

          {error && <div>{error.message}</div>}
        </div>
      )}
    </main>
  );
}
