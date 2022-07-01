import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import BalanceTree from "../src/balance-tree";
import { whitelist } from "../scripts/whitelist";
import { BigNumber } from "ethers";

/**
 * Hardhat task defining the contract deployments
 *
 * @param hre Hardhat environment to deploy to
 */
const func: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
): Promise<void> => {
  const chainId = await hre.getChainId();
  let deployer, alice;
  ({ deployer, alice } = await hre.getNamedAccounts());
  if (!deployer) {
    [deployer] = await hre.getUnnamedAccounts();
  }
  console.log({ chainId, deployer });

  const merkleTree = new BalanceTree(
    whitelist.map((item) => ({
      account: item.account,
      amount: BigNumber.from(item.amount),
    }))
  );

  // Deploy FuckFiat contract
  console.log(`Deploying FuckFiat NFT contract to chain:${chainId}`);
  await hre.deployments.deploy("FuckFiat", {
    from: deployer,
    args: [merkleTree.getHexRoot()],
    log: true,
  });
};

export default func;
