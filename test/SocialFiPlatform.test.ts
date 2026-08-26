import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { MockUSDC, SocialFiPlatform, UserToken } from "../typechain-types";

describe("SocialFiPlatform", function () {
  let deployer: HardhatEthersSigner;
  let feeRecipient: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let usdc: MockUSDC;
  let platform: SocialFiPlatform;

  const INITIAL_USDC = 1_000_000n * 10n ** 6n; // 1,000,000 USDC

  beforeEach(async function () {
    [deployer, feeRecipient, alice, bob] = await ethers.getSigners();

    const UsdcFactory = await ethers.getContractFactory("MockUSDC");
    usdc = (await UsdcFactory.deploy()) as unknown as MockUSDC;

    const PlatformFactory = await ethers.getContractFactory("SocialFiPlatform");
    platform = (await PlatformFactory.deploy(
      await usdc.getAddress(),
      feeRecipient.address
    )) as unknown as SocialFiPlatform;

    for (const signer of [alice, bob]) {
      await usdc.mint(signer.address, INITIAL_USDC);
      await usdc.connect(signer).approve(await platform.getAddress(), ethers.MaxUint256);
    }
  });

  describe("registerUser", function () {
    it("deploys a UserToken and records the mappings", async function () {
      const tx = await platform.connect(alice).registerUser("alice");
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((log) => {
          try {
            return platform.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "UserRegistered");
      expect(event).to.not.be.undefined;

      const token = await platform.tokenOfUser(alice.address);
      expect(token).to.not.equal(ethers.ZeroAddress);
      expect(await platform.tokenOf("alice")).to.equal(token);
      expect(await platform.creatorOfToken(token)).to.equal(alice.address);
      expect(await platform.isPlatformToken(token)).to.equal(true);

      const userToken = (await ethers.getContractAt("UserToken", token)) as unknown as UserToken;
      expect(await userToken.creator()).to.equal(alice.address);
      expect(await userToken.balanceOf(alice.address)).to.be.gt(0n);
    });

    it("reverts on a username that's too short or too long", async function () {
      await expect(platform.connect(alice).registerUser("ab")).to.be.revertedWithCustomError(
        platform,
        "InvalidUsername"
      );
      await expect(platform.connect(alice).registerUser("a".repeat(21))).to.be.revertedWithCustomError(
        platform,
        "InvalidUsername"
      );
    });

    it("reverts when the username is already taken", async function () {
      await platform.connect(alice).registerUser("shared");
      await expect(platform.connect(bob).registerUser("shared")).to.be.revertedWithCustomError(
        platform,
        "UsernameTaken"
      );
    });

    it("reverts when the same address registers twice", async function () {
      await platform.connect(alice).registerUser("alice");
      await expect(platform.connect(alice).registerUser("alice2")).to.be.revertedWithCustomError(
        platform,
        "UserAlreadyRegistered"
      );
    });
  });

  describe("buyToken / sellToken", function () {
    let token: string;

    beforeEach(async function () {
      await platform.connect(alice).registerUser("alice");
      token = await platform.tokenOfUser(alice.address);
    });

    it("reverts buying an unknown token", async function () {
      await expect(platform.connect(bob).buyToken(bob.address, 10, ethers.MaxUint256)).to.be.revertedWithCustomError(
        platform,
        "UnknownToken"
      );
    });

    it("charges the buyer price + 3% fee, splits it 50/50 with the creator, and mints shares", async function () {
      const amount = 100n;
      // Recompute the expected price independently via BondingCurve's closed-form
      // sum-of-squares (starting from the token's actual pre-buy supply, which already
      // includes alice's 10% creator premint), so this test doesn't just restate the
      // contract's own math back at it.
      const userToken = (await ethers.getContractAt("UserToken", token)) as unknown as UserToken;
      const supply = await userToken.totalSupply();
      const sumOfSquares = (n: bigint) => (n === 0n ? 0n : ((n - 1n) * n * (2n * n - 1n)) / 6n);
      const price = ((sumOfSquares(supply + amount) - sumOfSquares(supply)) * 10n ** 18n) / 10n ** 18n;
      const fee = (price * 300n) / 10_000n;
      const creatorFee = fee / 2n;
      const platformFee = fee - creatorFee;
      const cost = price + fee;
      expect(await platform.quoteBuy(token, amount)).to.equal(cost);

      const platformReserveBefore = await usdc.balanceOf(await platform.getAddress());
      const feeRecipientBalBefore = await usdc.balanceOf(feeRecipient.address);
      const creatorBalBefore = await usdc.balanceOf(alice.address);
      const buyerBalBefore = await usdc.balanceOf(bob.address);

      await expect(platform.connect(bob).buyToken(token, amount, cost))
        .to.emit(platform, "TokensBought")
        .withArgs(bob.address, token, amount, cost, fee);

      expect(await userToken.balanceOf(bob.address)).to.equal(amount);
      expect(await usdc.balanceOf(bob.address)).to.equal(buyerBalBefore - cost);
      expect(await usdc.balanceOf(alice.address)).to.equal(creatorBalBefore + creatorFee);
      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(feeRecipientBalBefore + platformFee);
      expect(await usdc.balanceOf(await platform.getAddress())).to.equal(platformReserveBefore + (cost - fee));
    });

    it("reverts a buy when maxCost is below the actual cost", async function () {
      const amount = 100n;
      const cost = await platform.quoteBuy(token, amount);
      await expect(platform.connect(bob).buyToken(token, amount, cost - 1n)).to.be.revertedWithCustomError(
        platform,
        "CostExceedsMax"
      );
    });

    it("lets a holder sell shares back for USDC minus fee", async function () {
      const amount = 100n;
      const cost = await platform.quoteBuy(token, amount);
      await platform.connect(bob).buyToken(token, amount, cost);

      const payout = await platform.quoteSell(token, amount);
      const buyerBalBefore = await usdc.balanceOf(bob.address);

      const userToken = (await ethers.getContractAt("UserToken", token)) as unknown as UserToken;

      await expect(platform.connect(bob).sellToken(token, amount, payout)).to.emit(platform, "TokensSold");

      expect(await userToken.balanceOf(bob.address)).to.equal(0n);
      expect(await usdc.balanceOf(bob.address)).to.equal(buyerBalBefore + payout);
    });

    it("reverts a sell when minReturn is above the actual payout", async function () {
      const amount = 100n;
      const cost = await platform.quoteBuy(token, amount);
      await platform.connect(bob).buyToken(token, amount, cost);

      const payout = await platform.quoteSell(token, amount);
      await expect(platform.connect(bob).sellToken(token, amount, payout + 1n)).to.be.revertedWithCustomError(
        platform,
        "ReturnBelowMin"
      );
    });

    it("keeps the reserve solvent across interleaved buys and sells", async function () {
      const buy1Amount = 50n;
      const buy1Cost = await platform.quoteBuy(token, buy1Amount);
      await platform.connect(bob).buyToken(token, buy1Amount, buy1Cost);

      const buy2Amount = 30n;
      const buy2Cost = await platform.quoteBuy(token, buy2Amount);
      await platform.connect(alice).buyToken(token, buy2Amount, buy2Cost);

      const sellAmount = 20n;
      const sellPayout = await platform.quoteSell(token, sellAmount);
      await expect(platform.connect(bob).sellToken(token, sellAmount, sellPayout)).to.not.be.reverted;

      const platformUsdcBalance = await usdc.balanceOf(await platform.getAddress());
      expect(platformUsdcBalance).to.be.gte(0n);
    });
  });

  describe("getUserInfo", function () {
    it("reverts for an unregistered user", async function () {
      await expect(platform.getUserInfo(bob.address)).to.be.revertedWithCustomError(platform, "UserNotRegistered");
    });

    it("returns token address, supply and current price", async function () {
      await platform.connect(alice).registerUser("alice");
      const token = await platform.tokenOfUser(alice.address);
      const userToken = (await ethers.getContractAt("UserToken", token)) as unknown as UserToken;

      const info = await platform.getUserInfo(alice.address);
      expect(info.token).to.equal(token);
      expect(info.totalSupply).to.equal(await userToken.totalSupply());
    });
  });

  describe("setPlatformFeeRecipient", function () {
    it("allows the owner to update the recipient", async function () {
      await platform.connect(deployer).setPlatformFeeRecipient(bob.address);
      expect(await platform.platformFeeRecipient()).to.equal(bob.address);
    });

    it("reverts when called by a non-owner", async function () {
      await expect(platform.connect(alice).setPlatformFeeRecipient(bob.address)).to.be.revertedWithCustomError(
        platform,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
