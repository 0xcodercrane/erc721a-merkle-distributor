import { waffle, ethers, web3 } from "hardhat";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, constants, utils, Wallet } from "ethers";
use(solidity);

import { FuckFiat } from "../typechain-types";
import BalanceTree from "../src/balance-tree";
import { deployContract } from "./utils";

const createFixturLoader = waffle.createFixtureLoader;
const MINT_COST = utils.parseUnits("2", 16);
describe("FuckFiat.sol", () => {
  const [wallet, addr1, addr2, addr3] =
    waffle.provider.getWallets() as Wallet[];
  let fuckFiat: FuckFiat;

  const whitelist = [
    {
      account: wallet.address,
      amount: BigNumber.from("21"),
    },
    {
      account: addr1.address,
      amount: BigNumber.from("9"),
    },
    {
      account: addr2.address,
      amount: BigNumber.from("1"),
    },
  ];

  let balanceTree = new BalanceTree(whitelist);

  const proof1 = balanceTree.getProof(0, wallet.address, BigNumber.from("21"));
  const proof2 = balanceTree.getProof(1, addr1.address, BigNumber.from("9"));
  const proof3 = balanceTree.getProof(2, addr2.address, BigNumber.from("1"));

  const fixture = async () => {
    fuckFiat = await deployContract<FuckFiat>(
      "FuckFiat",
      balanceTree.getHexRoot()
    );
    return fuckFiat;
  };

  let loadFixture: ReturnType<typeof createFixturLoader>;
  before("create fixture loader", async () => {
    loadFixture = createFixturLoader([wallet, addr1, addr2, addr3]);
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe("#startSale", () => {
    it("should work", async () => {
      let owner = await fuckFiat.owner();
      expect(owner).to.be.eq(wallet.address);
      let tx = await fuckFiat.connect(wallet).startSale();
      await tx.wait();
      expect(tx.hash).to.be.not.eq(constants.HashZero);
      tx = await fuckFiat.connect(wallet).endSale();
      await tx.wait();
      tx = await fuckFiat.connect(wallet).startSale();
      await tx.wait();
    });
    it("revert if not owner", async () => {
      await expect(fuckFiat.connect(addr1).startSale()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("#freeClaimable", () => {
    it("should return proper amount in different cases", async () => {
      // [] - In case of empty proof
      let claimable = await fuckFiat.freeClaimable(0, wallet.address, 3, []);
      expect(claimable).to.be.eq(0);
      claimable = await fuckFiat.freeClaimable(0, wallet.address, 2, []);
      expect(claimable).to.be.eq(0);
      claimable = await fuckFiat.freeClaimable(0, wallet.address, 1, []);
      expect(claimable).to.be.eq(0);
      claimable = await fuckFiat.freeClaimable(0, wallet.address, 0, []);
      expect(claimable).to.be.eq(0);

      // [] - In case `baseAmount` doesn't match with the proof
      claimable = await fuckFiat.freeClaimable(0, wallet.address, 2, proof1);
      expect(claimable).to.be.eq(0);

      // [] - Happy case
      claimable = await fuckFiat.freeClaimable(0, wallet.address, 21, proof1);
      expect(claimable).to.be.eq(3);

      claimable = await fuckFiat.freeClaimable(1, addr1.address, 2, proof1);
      expect(claimable).to.be.eq(0);
      claimable = await fuckFiat.freeClaimable(1, addr1.address, 9, proof2);
      expect(claimable).to.be.eq(2);

      claimable = await fuckFiat.freeClaimable(2, addr2.address, 1, proof1);
      expect(claimable).to.be.eq(0);
      claimable = await fuckFiat.freeClaimable(2, addr2.address, 1, proof2);
      expect(claimable).to.be.eq(0);
      claimable = await fuckFiat.freeClaimable(2, addr2.address, 1, proof3);
      expect(claimable).to.be.eq(1);

      claimable = await fuckFiat.freeClaimable(999, addr3.address, 0, []);
      expect(claimable).to.be.eq(0);
    });
  });

  describe("#mint", () => {
    beforeEach(async () => {
      const tx = await fuckFiat.connect(wallet).startSale();
      await tx.wait();
    });

    it("should be able to mint up to 10,000 tokens", async () => {
      let oldETHBalance = await web3.eth.getBalance(fuckFiat.address);
      let tx = await fuckFiat.connect(addr3).mint(9999, {
        value: MINT_COST.mul(9999),
      });
      await tx.wait();
      let newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(BigNumber.from(newETHBalance).sub(oldETHBalance)).to.be.eq(
        MINT_COST.mul(9999)
      );
      let tokenBalance = await fuckFiat.balanceOf(addr3.address);
      expect(tokenBalance.toString()).to.be.eq("9999");

      await expect(
        fuckFiat.connect(addr3).mint(2, {
          value: MINT_COST.mul(2),
        })
      ).to.be.revertedWith("not enough nfts");

      await expect(
        fuckFiat.connect(wallet).claim(0, 21, proof1)
      ).to.be.revertedWith("not enough nfts");

      oldETHBalance = newETHBalance;
      tx = await fuckFiat.connect(addr3).mint(1, {
        value: MINT_COST.mul(1),
      });
      await tx.wait();
      tokenBalance = await fuckFiat.balanceOf(addr3.address);
      newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(BigNumber.from(newETHBalance).sub(oldETHBalance)).to.be.eq(
        MINT_COST.mul(1)
      );
      expect(tokenBalance.toString()).to.be.eq("10000");

      await tx.wait();

      await expect(
        fuckFiat.connect(addr3).mint(1, {
          value: MINT_COST.mul(1),
        })
      ).to.be.revertedWith("not active");
    });
    it("should pay ETH for non-free amount", async () => {
      // 1 => cost = (amount - freeAmount) * price
      let oldETHBalance = await web3.eth.getBalance(fuckFiat.address);
      let tx = await fuckFiat.connect(wallet).mint(5, {
        value: utils.parseUnits("10", 16),
      });
      await tx.wait();
      let newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(BigNumber.from(newETHBalance).sub(oldETHBalance)).to.be.eq(
        MINT_COST.mul(5)
      );

      oldETHBalance = newETHBalance;
      tx = await fuckFiat.connect(addr2).mint(10, {
        value: utils.parseUnits("50", 16),
      });
      await tx.wait();
      newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(BigNumber.from(newETHBalance).sub(oldETHBalance)).to.be.eq(
        MINT_COST.mul(10)
      );
    });
  });

  describe("#claim", () => {
    beforeEach(async () => {
      const tx = await fuckFiat.connect(wallet).startSale();
      await tx.wait();
    });

    it("should work", async () => {
      // wallet
      let oldBalance = await fuckFiat.balanceOf(wallet.address);
      let oldETHBalance = await web3.eth.getBalance(fuckFiat.address);
      let tx = await fuckFiat.connect(wallet).claim(0, 21, proof1);
      await tx.wait();
      let newBalance = await fuckFiat.balanceOf(wallet.address);
      let newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(Number(newBalance) - Number(oldBalance)).to.be.eq(3);
      expect(
        BigNumber.from(newETHBalance).sub(oldETHBalance).toString()
      ).to.be.eq("0");

      // addr1
      oldBalance = await fuckFiat.balanceOf(addr1.address);
      oldETHBalance = newETHBalance;
      tx = await fuckFiat.connect(addr1).claim(1, 9, proof2);
      await tx.wait();
      newBalance = await fuckFiat.balanceOf(addr1.address);
      newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(Number(newBalance) - Number(oldBalance)).to.be.eq(2);
      expect(
        BigNumber.from(newETHBalance).sub(oldETHBalance).toString()
      ).to.be.eq("0");

      // addr2
      oldBalance = await fuckFiat.balanceOf(addr2.address);
      oldETHBalance = newETHBalance;
      tx = await fuckFiat.connect(addr2).claim(2, 1, proof3);
      await tx.wait();
      newBalance = await fuckFiat.balanceOf(addr2.address);
      newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(Number(newBalance) - Number(oldBalance)).to.be.eq(1);
      expect(
        BigNumber.from(newETHBalance).sub(oldETHBalance).toString()
      ).to.be.eq("0");
    });
    it("should claim onlyOnce", async () => {
      // wallet
      let oldBalance = await fuckFiat.balanceOf(wallet.address);
      let oldETHBalance = await web3.eth.getBalance(fuckFiat.address);
      let tx = await fuckFiat.connect(wallet).claim(0, 21, proof1);
      await tx.wait();
      let newBalance = await fuckFiat.balanceOf(wallet.address);
      let newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(Number(newBalance) - Number(oldBalance)).to.be.eq(3);
      expect(
        BigNumber.from(newETHBalance).sub(oldETHBalance).toString()
      ).to.be.eq("0");

      const freeClaimable = await fuckFiat.freeClaimable(
        0,
        wallet.address,
        21,
        proof1
      );
      expect(freeClaimable.toString()).to.be.eq("0");

      await expect(
        fuckFiat.connect(wallet).claim(0, 21, proof1)
      ).to.be.revertedWith("already claimed!");
    });
    it("revert if not whitelisted", async () => {
      const freeClaimable = await fuckFiat.freeClaimable(
        0,
        addr3.address,
        0,
        []
      );
      expect(freeClaimable.toString()).to.be.eq("0");

      await expect(fuckFiat.connect(addr3).claim(0, 0, [])).to.be.revertedWith(
        "no nfts to claim"
      );
    });
  });

  describe("#withdraw", () => {
    beforeEach(async () => {
      const tx = await fuckFiat.connect(wallet).startSale();
      await tx.wait();
    });

    it("should work if onlyOwner", async () => {
      // 1 => cost = (amount - freeAmount) * price
      let oldETHBalance = await web3.eth.getBalance(fuckFiat.address);
      let tx = await fuckFiat.connect(wallet).mint(5, {
        value: utils.parseUnits("10", 16),
      });
      await tx.wait();
      let newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(BigNumber.from(newETHBalance).sub(oldETHBalance)).to.be.eq(
        MINT_COST.mul(5)
      );

      oldETHBalance = newETHBalance;
      tx = await fuckFiat.connect(addr2).mint(10, {
        value: utils.parseUnits("50", 16),
      });
      await tx.wait();
      newETHBalance = await web3.eth.getBalance(fuckFiat.address);
      expect(BigNumber.from(newETHBalance).sub(oldETHBalance)).to.be.eq(
        MINT_COST.mul(10)
      );

      await expect(fuckFiat.connect(addr1).withdraw()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      const ownerOldBalance = await web3.eth.getBalance(wallet.address);
      tx = await fuckFiat.connect(wallet).withdraw();
      await tx.wait();
      const ownerNewBalance = await web3.eth.getBalance(wallet.address);

      // TODO. needs to implement to.be.eq for more strict assertion
      expect(
        Number(
          utils.formatUnits(
            BigNumber.from(ownerNewBalance).sub(ownerOldBalance),
            16
          )
        )
      ).to.be.lessThan(Number(utils.formatUnits(MINT_COST.mul(15), 16)));

      expect(
        Number(
          utils.formatUnits(
            BigNumber.from(ownerNewBalance).sub(ownerOldBalance),
            16
          )
        )
      ).to.be.greaterThan(Number(utils.formatUnits(MINT_COST.mul(14), 16)));
    });
  });
});
