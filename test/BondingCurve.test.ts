import { expect } from "chai";
import { ethers } from "hardhat";
import type { BondingCurveHarness } from "../typechain-types";

describe("BondingCurve", function () {
  let curve: BondingCurveHarness;

  beforeEach(async function () {
    const factory = await ethers.getContractFactory("BondingCurveHarness");
    curve = (await factory.deploy()) as unknown as BondingCurveHarness;
  });

  describe("getPrice", function () {
    it("returns 0 at zero supply", async function () {
      expect(await curve.getPrice(0)).to.equal(0n);
    });

    it("increases monotonically with supply", async function () {
      const low = await curve.getPrice(100);
      const high = await curve.getPrice(1000);
      expect(high).to.be.gt(low);
    });

    it("matches the s^2 * CURVE_CONSTANT / 1e18 formula", async function () {
      const CURVE_CONSTANT = 10n ** 18n;
      const supply = 12345n;
      const expected = (supply * supply * CURVE_CONSTANT) / 10n ** 18n;
      expect(await curve.getPrice(supply)).to.equal(expected);
    });

    it("reverts above MAX_SUPPLY", async function () {
      const MAX_SUPPLY = 1_000_000_000n;
      await expect(curve.getPrice(MAX_SUPPLY + 1n)).to.be.revertedWithCustomError(curve, "SupplyOverflow");
    });
  });

  describe("getBuyPrice", function () {
    it("reverts on zero amount", async function () {
      await expect(curve.getBuyPrice(0, 0)).to.be.revertedWithCustomError(curve, "ZeroAmount");
    });

    it("reverts when supply + amount exceeds MAX_SUPPLY", async function () {
      const MAX_SUPPLY = 1_000_000_000n;
      await expect(curve.getBuyPrice(MAX_SUPPLY, 1)).to.be.revertedWithCustomError(curve, "SupplyOverflow");
    });

    it("costs more for the same batch size as supply grows", async function () {
      const early = await curve.getBuyPrice(0, 100);
      const later = await curve.getBuyPrice(10_000, 100);
      expect(later).to.be.gt(early);
    });

    it("splitting a buy into two batches costs within 1 wei of one whole batch", async function () {
      // Each getBuyPrice call floors its own division by 1e18, so two sequential
      // calls can lose up to 1 more wei of USDC to rounding than a single batched
      // call — this is expected integer-division behavior, not a pricing bug.
      const whole = await curve.getBuyPrice(0, 200);
      const first = await curve.getBuyPrice(0, 100);
      const second = await curve.getBuyPrice(100, 100);
      expect(whole - (first + second)).to.be.within(0n, 1n);
    });
  });

  describe("getSellPrice", function () {
    it("reverts on zero amount", async function () {
      await expect(curve.getSellPrice(100, 0)).to.be.revertedWithCustomError(curve, "ZeroAmount");
    });

    it("reverts when selling more than current supply", async function () {
      await expect(curve.getSellPrice(100, 101)).to.be.revertedWithCustomError(curve, "InsufficientSupply");
    });

    it("is symmetric with getBuyPrice for the same range", async function () {
      const buyCost = await curve.getBuyPrice(1000, 500);
      const sellReturn = await curve.getSellPrice(1500, 500);
      expect(sellReturn).to.equal(buyCost);
    });
  });
});
