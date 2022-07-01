import { task } from "hardhat/config";

export default task("set-deactive", "Start a sale").setAction(
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

    const tx = await fuckFiatContract.endSale();

    console.log("endSale tx: ", tx);
    const receipt = await tx.wait();
    console.log("endSale tx mined: ", receipt.transactionHash);
  }
);
