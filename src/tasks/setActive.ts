import { task } from "hardhat/config";

export default task("set-active", "Start a sale").setAction(
  async ({}, { deployments, getNamedAccounts, ethers }) => {
    const namedAccounts = await getNamedAccounts();

    console.log("namedAccounts: ", namedAccounts.deployer);

    const fuckFiatDeployment = await deployments.get("FuckFiat");
    const fuckFiatAddress = fuckFiatDeployment.address;
    console.log("fuckFiatAddress: ", fuckFiatAddress);

    const fuckFiatContract = await ethers.getContractAt(
      "FuckFiat",
      fuckFiatAddress
    );

    const tx = await fuckFiatContract.startSale();

    console.log("startSale tx: ", tx);
    const receipt = await tx.wait();
    console.log("startSale tx mined: ", receipt.transactionHash);
  }
);
