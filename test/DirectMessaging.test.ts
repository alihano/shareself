import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { DirectMessaging, MockUSDC } from "../typechain-types";

describe("DirectMessaging", function () {
  let deployer: HardhatEthersSigner;
  let feeRecipient: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let payer: HardhatEthersSigner;
  let usdc: MockUSDC;
  let messaging: DirectMessaging;

  const UNLOCK_FEE = 1_000_000n; // 1 USDC, 6 decimals
  const INITIAL_USDC = 1_000_000n * 10n ** 6n;

  beforeEach(async function () {
    [deployer, feeRecipient, creator, payer] = await ethers.getSigners();

    const UsdcFactory = await ethers.getContractFactory("MockUSDC");
    usdc = (await UsdcFactory.deploy()) as unknown as MockUSDC;

    const MessagingFactory = await ethers.getContractFactory("DirectMessaging");
    messaging = (await MessagingFactory.deploy(
      await usdc.getAddress(),
      feeRecipient.address
    )) as unknown as DirectMessaging;

    await usdc.mint(payer.address, INITIAL_USDC);
    await usdc.connect(payer).approve(await messaging.getAddress(), ethers.MaxUint256);
  });

  describe("unlockChat", function () {
    it("grants access and splits the fee 50/50 between creator earnings and the platform", async function () {
      const payerBalBefore = await usdc.balanceOf(payer.address);
      const feeRecipientBalBefore = await usdc.balanceOf(feeRecipient.address);

      await expect(messaging.connect(payer).unlockChat(creator.address))
        .to.emit(messaging, "ChatUnlocked")
        .withArgs(payer.address, creator.address, UNLOCK_FEE / 2n, UNLOCK_FEE / 2n);

      expect(await messaging.hasAccessTo(payer.address, creator.address)).to.equal(true);
      expect(await usdc.balanceOf(payer.address)).to.equal(payerBalBefore - UNLOCK_FEE);
      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(feeRecipientBalBefore + UNLOCK_FEE / 2n);
      expect(await messaging.earningsOf(creator.address)).to.equal(UNLOCK_FEE / 2n);
    });

    it("reverts unlocking a chat with yourself", async function () {
      await expect(messaging.connect(payer).unlockChat(payer.address)).to.be.revertedWithCustomError(
        messaging,
        "SelfMessagingNotAllowed"
      );
    });

    it("reverts unlocking the same creator twice", async function () {
      await messaging.connect(payer).unlockChat(creator.address);
      await expect(messaging.connect(payer).unlockChat(creator.address)).to.be.revertedWithCustomError(
        messaging,
        "ChatAlreadyUnlocked"
      );
    });

    it("reverts on the zero address", async function () {
      await expect(messaging.connect(payer).unlockChat(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        messaging,
        "ZeroAddress"
      );
    });

    it("reverts when the payer hasn't approved enough USDC", async function () {
      await usdc.connect(payer).approve(await messaging.getAddress(), 0);
      await expect(messaging.connect(payer).unlockChat(creator.address)).to.be.reverted;
    });

    it("tracks access separately per payer/creator pair", async function () {
      await messaging.connect(payer).unlockChat(creator.address);
      expect(await messaging.hasAccessTo(payer.address, creator.address)).to.equal(true);
      expect(await messaging.hasAccessTo(creator.address, payer.address)).to.equal(false);
    });
  });

  describe("withdrawEarnings", function () {
    it("lets a creator withdraw accrued earnings", async function () {
      await messaging.connect(payer).unlockChat(creator.address);
      const creatorBalBefore = await usdc.balanceOf(creator.address);

      await expect(messaging.connect(creator).withdrawEarnings())
        .to.emit(messaging, "EarningsWithdrawn")
        .withArgs(creator.address, UNLOCK_FEE / 2n);

      expect(await usdc.balanceOf(creator.address)).to.equal(creatorBalBefore + UNLOCK_FEE / 2n);
      expect(await messaging.earningsOf(creator.address)).to.equal(0n);
    });

    it("reverts when there's nothing to withdraw", async function () {
      await expect(messaging.connect(creator).withdrawEarnings()).to.be.revertedWithCustomError(
        messaging,
        "NothingToWithdraw"
      );
    });

    it("accumulates earnings across multiple unlocks before withdrawal", async function () {
      const [, , , , otherPayer] = await ethers.getSigners();
      await usdc.mint(otherPayer.address, INITIAL_USDC);
      await usdc.connect(otherPayer).approve(await messaging.getAddress(), ethers.MaxUint256);

      await messaging.connect(payer).unlockChat(creator.address);
      await messaging.connect(otherPayer).unlockChat(creator.address);

      expect(await messaging.earningsOf(creator.address)).to.equal(UNLOCK_FEE);
    });
  });

  describe("setPlatformFeeRecipient", function () {
    it("allows the owner to update the recipient", async function () {
      await messaging.connect(deployer).setPlatformFeeRecipient(payer.address);
      expect(await messaging.platformFeeRecipient()).to.equal(payer.address);
    });

    it("reverts when called by a non-owner", async function () {
      await expect(messaging.connect(payer).setPlatformFeeRecipient(payer.address)).to.be.revertedWithCustomError(
        messaging,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
