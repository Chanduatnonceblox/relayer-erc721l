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
    if (typeof window !== "undefined") {
      provider = new ethers.providers.Web3Provider(window?.ethereum);
      signer = provider?.getSigner();
      NFTBridgeInstance = new ethers.Contract(nftbridgeAddress, abi, signer);
    }
    if (chain?.id != selectedChain) {
      switchNetwork?.(selectedChain);
    }
    switchNetwork?.(destinationChain);
    console.log(chain?.id);
    setDomLoaded(true);
    console.log(vaaBytes);
  }, []);

  const handleApprove = async () => {
    try {
      if (tokenAddress != undefined) {
        provider = new ethers.providers.Web3Provider(window?.ethereum);
        signer = provider?.getSigner();
        const ERC721Instacne = new ethers.Contract(
          tokenAddress,
          erc721Abi,
          signer
        );

        let isApprove = await ERC721Instacne.isApprovedForAll(
          address,
          nftbridgeAddress
        );

        if (!isApprove) {
          let recp = await ERC721Instacne.approve(nftbridgeAddress, tokenId, {
            from: address,
          });
          await recp.wait();
          setIsApproved(true);
        } else {
          setIsApproved(true);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleWithdrawal = async (_vaaBytes: any) => {
    try {
      let recpit = await NFTBridgeInstance.completeTransfer(
        Buffer.from(_vaaBytes, "base64")
      );
      recpit = await recpit.wait();

      console.log(recpit);
      setVaaBytes(undefined);
    } catch (error) {
      console.log(error);
    }
  };

  const handleTransferNFT = async () => {
    try {
      let recipientChain = 2;

      let nonce = Math.floor(4301559040 + Math.random() * 900000);
      let bytecodeAddress;
      if (address != undefined) {
        bytecodeAddress = ethers.utils.keccak256(address);
      }
      let tx = await NFTBridgeInstance.transferNFT(
        tokenAddress,
        tokenId,
        recipientChain,
        bytecodeAddress,
        "2301559040",
        { from: address }
      );
      tx = await tx.wait();
      console.log(tx);

      const emitterAddr = getEmitterAddressEth(nftbridgeAddress);
      const seq = parseSequenceFromLogEth(tx, bridgeAddress);
      const vaaURL = `${networks.wormhole.restAddress}/v1/signed_vaa/${networks.networks.polygon.wormholeChainId}/${emitterAddr}/${seq}`;
      let _vaaBytes = await (await fetch(vaaURL)).json();
      while (!_vaaBytes.vaaBytes) {
        console.log("VAA not found, retrying in 5s!");
        await new Promise((r) => setTimeout(r, 5000)); //Timeout to let Guardiand pick up log and have VAA ready
        _vaaBytes = await (await fetch(vaaURL)).json();
        console.log(_vaaBytes.vaaBytes, "in");
        setVaaBytes(_vaaBytes.vaaBytes);
      }
      setVaaBytes(_vaaBytes.vaaBytes);
      setIsApproved(false);
    } catch (error) {
      console.log(error);
    }
  };

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
                    <button
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                      type="button"
                      onClick={handleTransferNFT}
                    >
                      Transfer
                    </button>
                  ) : vaaBytes ? (
                    chain?.id == destinationChain ? (
                      <button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        type="button"
                        onClick={() => handleWithdrawal(vaaBytes)}
                      >
                        Withdraw
                      </button>
                    ) : (
                      <button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        type="button"
                        onClick={async (e) => {
                          try {
      
                            setSelectedChain(destinationChain);
                            setSelectedChain(destinationChain);
                            await window.ethereum.request({
                              method: "wallet_switchEthereumChain",
                              params: [{ chainId: ethers.utils.hexValue(destinationChain) }], // chainId must be in hexadecimal numbers
                            });
                            provider = new ethers.providers.Web3Provider(window?.ethereum);
                            signer = provider?.getSigner();
                          } catch (error) {
                            console.log(error);
                          }
                        }}
                      >
                        change network
                      </button>
                    )
                  ) : (
                    <button
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                      type="button"
                      onClick={(e) => {
                        handleApprove();
                      }}
                    >
                      Approve
                    </button>
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
