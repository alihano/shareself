import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { UserToken } from "../typechain-types";

describe("UserToken", function () {
  let owner: HardhatEthersSigner; // stands in for the SocialFiPlatform address
  let creator: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let token: UserToken;

  const PREMINT_BASIS = 1_000_000n;

  beforeEach(async function () {
    [owner, creator, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("UserToken");
    token = (await factory.deploy("alice", creator.address, owner.address, PREMINT_BASIS)) as unknown as UserToken;
  });

  it("sets username, creator, name and symbol", async function () {
    expect(await token.username()).to.equal("alice");
    expect(await token.creator()).to.equal(creator.address);
    expect(await token.name()).to.equal("alice Shares");
    expect(await token.symbol()).to.equal("S-alice");
  });

  it("premints 10% of the reference supply to the creator", async function () {
    expect(await token.balanceOf(creator.address)).to.equal(PREMINT_BASIS / 10n);
    expect(await token.totalSupply()).to.equal(PREMINT_BASIS / 10n);
  });

  it("sets the platform address as owner", async function () {
    expect(await token.owner()).to.equal(owner.address);
  });

  it("reverts construction on a zero creator address", async function () {
    const factory = await ethers.getContractFactory("UserToken");
    await expect(
      factory.deploy("bob", ethers.ZeroAddress, owner.address, PREMINT_BASIS)
    ).to.be.revertedWithCustomError(token, "ZeroAddress");
  });

  it("reverts construction on a zero platform address (rejected by Ownable itself)", async function () {
    const factory = await ethers.getContractFactory("UserToken");
    await expect(
      factory.deploy("bob", creator.address, ethers.ZeroAddress, PREMINT_BASIS)
    ).to.be.revertedWithCustomError(token, "OwnableInvalidOwner");
  });

  describe("mint", function () {
    it("allows the owner to mint", async function () {
      await token.connect(owner).mint(stranger.address, 1000);
      expect(await token.balanceOf(stranger.address)).to.equal(1000n);
    });

    it("reverts when called by a non-owner", async function () {
      await expect(token.connect(stranger).mint(stranger.address, 1000)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts on zero address or zero amount", async function () {
      await expect(token.connect(owner).mint(ethers.ZeroAddress, 1000)).to.be.revertedWithCustomError(
        token,
        "ZeroAddress"
      );
      await expect(token.connect(owner).mint(stranger.address, 0)).to.be.revertedWithCustomError(
        token,
        "ZeroAmount"
      );
    });
  });

  describe("burn", function () {
    it("allows the owner to burn from a holder", async function () {
      await token.connect(owner).mint(stranger.address, 1000);
      await token.connect(owner).burn(stranger.address, 400);
      expect(await token.balanceOf(stranger.address)).to.equal(600n);
    });

    it("reverts when called by a non-owner", async function () {
      await expect(token.connect(creator).burn(creator.address, 1)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts on zero amount", async function () {
      await expect(token.connect(owner).burn(creator.address, 0)).to.be.revertedWithCustomError(
        token,
        "ZeroAmount"
      );
    });
  });
});
