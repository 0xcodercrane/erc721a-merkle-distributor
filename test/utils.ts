import { ethers } from "hardhat";

import { BigNumber, Contract, ContractFactory } from "ethers/lib/ethers";

export const MAX_FEE_PER_GAS = BigNumber.from("975000000");

import { Artifact } from "hardhat/types";

const deployFromFactory = async <T extends Contract = Contract>(
  factory: ContractFactory,
  ...args: any[]
) => {
  const contract = await factory.deploy(...args, {
    maxFeePerGas: MAX_FEE_PER_GAS,
  });
  await contract.deployed();
  return contract as T;
};

export const deployContract = async <T extends Contract = Contract>(
  factoryInfo: string | Artifact,
  ...args: any[]
): Promise<T> => {
  let factory: ContractFactory;
  if (typeof factoryInfo === "string") {
    factory = (await ethers.getContractFactory(factoryInfo)) as ContractFactory;
  } else {
    factory = await ethers.getContractFactory(
      factoryInfo.abi,
      factoryInfo.bytecode
    );
  }
  return deployFromFactory(factory, ...args);
};
