import {
  useContractWrite,
  useNetwork,
  usePrepareContractWrite,
  useContractRead,
  useWaitForTransaction,
  useAccount,
  useSwitchNetwork,
} from "wagmi";

import abi from "../../utils/abi.json";
import erc721Abi from "../../utils/erc721abi.json";
import networks from "../../utils/xdapp.config.json";
import {
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import Web3, { Contract } from "web3";

declare let window: any;

export function Approve(props: any) {
  const { chain } = useNetwork();
  const { address, connector, isConnected } = useAccount();
  console.log(address, "xxxxxv");
  let nftbridgeAddress: any =
    chain?.id == networks.networks.polygon.chainId
      ? networks.networks.polygon.bridgeAddress
      : networks.networks.ethereum.bridgeAddress;

  const contractRead = useContractRead({
    address: props.tokenAddress,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: [address, nftbridgeAddress],
    onError(error) {
      console.log("Error", error);
    },
    onSuccess(data) {
      console.log(data);
    },
  });

  const { config } = usePrepareContractWrite({
    // @ts-nocheck
    address: props.tokenAddress,
    abi: erc721Abi,
    functionName: "setApprovalForAll",
    args: [nftbridgeAddress, true],
    onError(error) {
      console.log("Error", error);
    },
    onSuccess(data) {
      console.log(data);
    },
  });
  const { data, isLoading, isSuccess, write } = useContractWrite(config);

  const waitForTransaction = useWaitForTransaction({
    hash: data?.hash,
  });
  console.log(contractRead);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (contractRead?.data) {
            props?.setIsApproved(true);
          } else if (contractRead.data != undefined) {
            write?.();
          }
        }}
      >
        Approve
      </button>
   
      {waitForTransaction.data?.status == "success"
        ? props?.setIsApproved(true)
        : props?.setIsApproved(false)}
    </div>
  );
}

export function Transfer(props: any) {
  let provider: ethers.providers.Provider | ethers.Signer | undefined;
  provider = new ethers.providers.Web3Provider(window?.ethereum);
  let web3 = new Web3(window.ethereum);
  const { switchNetwork } = useSwitchNetwork();
  const { chain } = useNetwork();
  const { address, connector, isConnected } = useAccount();

  let bridgeAddress =
    chain?.id == networks.networks.polygon.chainId
      ? networks.networks.polygon.coreBridgeAddress
      : networks.networks.ethereum.coreBridgeAddress;
  let nftbridgeAddress: any =
    chain?.id == networks.networks.polygon.chainId
      ? networks.networks.polygon.bridgeAddress
      : networks.networks.ethereum.bridgeAddress;
  let recipientChain =
    chain?.id == networks.networks.polygon.chainId
      ? networks.networks.ethereum.wormholeChainId
      : networks.networks.polygon.wormholeChainId;

  let bytecodeAddress;
  if (address != undefined) {
    const splitArray = address.split("0x");
    bytecodeAddress = web3.eth.abi.encodeParameter("address", splitArray[1]); //(("0x"+"000000000000000000000000"+splitArray[1]).toLowerCase())
  }

  console.log(bytecodeAddress);
  const { config } = usePrepareContractWrite({
    address: nftbridgeAddress,
    abi: abi,
    functionName: "transferNFT",
    args: [
      props.data.tokenAddress,
      props.data.tokenId,
      recipientChain,
      bytecodeAddress,
      "2301559040",
    ],
    onError(error) {
      console.log("Error", error);
    },
    onSuccess(data) {
      console.log(data);
    },
  });
  const { data, isLoading, isSuccess, status, write } =
    useContractWrite(config);
  const waitForTransaction = useWaitForTransaction({
    hash: data?.hash,
  });

  console.log(waitForTransaction.data);

  const TransferNFT = async () => {
    if (waitForTransaction?.data.logs[0]?.topics != undefined) {
      console.log(waitForTransaction.data);
      const txReceipt = await provider?.getTransactionReceipt(
        waitForTransaction?.data?.transactionHash
      );

      const emitterAddr = getEmitterAddressEth(nftbridgeAddress);
      const seq = parseSequenceFromLogEth(txReceipt, bridgeAddress);
      const vaaURL = `${
        networks.wormhole.restAddress
      }/v1/signed_vaa/${(recipientChain =
        chain?.id == networks.networks.polygon.chainId
          ? networks.networks.polygon.wormholeChainId:networks.networks.ethereum.wormholeChainId)}/${emitterAddr}/${seq}`;
      let _vaaBytes = await (await fetch(vaaURL)).json();
      while (!_vaaBytes.vaaBytes) {
        console.log("VAA not found, retrying in 5s!");
        await new Promise((r) => setTimeout(r, 5000)); //Timeout to let Guardiand pick up log and have VAA ready
        _vaaBytes = await (await fetch(vaaURL)).json();
        console.log(_vaaBytes.vaaBytes, "in");
        props.setVaaBytes(_vaaBytes.vaaBytes);
      }
      props.setVaaBytes(_vaaBytes.vaaBytes);
      props.setIsApproved(false);
      switchNetwork?.(
        chain?.id == networks.networks.polygon.chainId
          ? networks.networks.ethereum.chainId
          : networks.networks.polygon.chainId
      );
    }
  };

  if (waitForTransaction?.data?.status == "success") {
    TransferNFT();
  }

  // useEffect(() => {
  //   TransferNFT()
  // }, []);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          write?.();
        }}
      >
        Transfer
      </button>
    </div>
  );
}

export function Withdraw(props: any) {
  const { chain } = useNetwork();
  let nftbridgeAddress: any =
    chain?.id == networks.networks.polygon.chainId
      ? networks.networks.polygon.bridgeAddress
      : networks.networks.ethereum.bridgeAddress;

  const handleWithdraw = async () => {
    try {
      let provider = new ethers.providers.Web3Provider(window?.ethereum);
      let signer = provider?.getSigner();
      let NFTBridgeInstance = new ethers.Contract(
        nftbridgeAddress,
        abi,
        signer
      );
      let tx = await NFTBridgeInstance.completeTransfer(
        Buffer.from(props?.vaaBytes, "base64")
      );
      tx = await tx.wait();

      console.log(tx);
      props?.setVaaBytes(undefined);
      window.reload();
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          handleWithdraw();
        }}
      >
        Withdraw
      </button>
    </div>
  );
}
