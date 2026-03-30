const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VerseToken", function () {
  let verseToken, anchor, marketplace;
  let owner, alice, bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const VerseToken = await ethers.getContractFactory("VerseToken");
    verseToken = await VerseToken.deploy();

    const InfluenceAnchor = await ethers.getContractFactory("InfluenceAnchor");
    anchor = await InfluenceAnchor.deploy();

    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(await verseToken.getAddress());

    await verseToken.setInfluenceAnchor(await anchor.getAddress());
    await verseToken.setMarketplace(await marketplace.getAddress());
  });

  describe("Bonding Curve", function () {
    it("should have a starting price", async function () {
      const price = await verseToken.currentPrice();
      expect(price).to.equal(ethers.parseEther("0.0001"));
    });

    it("should mint tokens when buying", async function () {
      await verseToken.connect(alice).buy({ value: ethers.parseEther("0.01") });
      const balance = await verseToken.balanceOf(alice.address);
      expect(balance).to.be.gt(0);
    });

    it("should increase price as supply grows", async function () {
      const priceBefore = await verseToken.currentPrice();
      await verseToken.connect(alice).buy({ value: ethers.parseEther("1.0") });
      const priceAfter = await verseToken.currentPrice();
      expect(priceAfter).to.be.gt(priceBefore);
    });

    it("should allow selling tokens back", async function () {
      // Send ETH to contract first for liquidity
      await owner.sendTransaction({
        to: await verseToken.getAddress(),
        value: ethers.parseEther("1.0"),
      });

      await verseToken.connect(alice).buy({ value: ethers.parseEther("0.01") });

      const balance = await verseToken.balanceOf(alice.address);
      const halfBalance = balance / 4n; // Sell a quarter to stay within liquidity

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      await verseToken.connect(alice).sell(halfBalance);
      const balanceAfter = await ethers.provider.getBalance(alice.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should report tokens for ETH correctly", async function () {
      const amount = await verseToken.tokensForEth(ethers.parseEther("0.01"));
      expect(amount).to.be.gt(0);
    });
  });

  describe("Name and Symbol", function () {
    it("should have correct name and symbol", async function () {
      expect(await verseToken.name()).to.equal("Verse");
      expect(await verseToken.symbol()).to.equal("VERSE");
    });
  });
});

describe("InfluenceAnchor", function () {
  let anchor;
  let owner, submitter;

  beforeEach(async function () {
    [owner, submitter] = await ethers.getSigners();
    const InfluenceAnchor = await ethers.getContractFactory("InfluenceAnchor");
    anchor = await InfluenceAnchor.deploy();
  });

  it("should submit and retrieve snapshots", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
    await anchor.submitSnapshot(1, root, 19);

    const snapshot = await anchor.getSnapshot(1);
    expect(snapshot.merkleRoot).to.equal(root);
    expect(snapshot.nodeCount).to.equal(19);
  });

  it("should track latest epoch", async function () {
    const root1 = ethers.keccak256(ethers.toUtf8Bytes("root-1"));
    const root2 = ethers.keccak256(ethers.toUtf8Bytes("root-2"));

    await anchor.submitSnapshot(1, root1, 10);
    await anchor.submitSnapshot(2, root2, 15);

    expect(await anchor.latestEpoch()).to.equal(2);
  });

  it("should reject older epochs", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("root"));
    await anchor.submitSnapshot(5, root, 10);

    await expect(
      anchor.submitSnapshot(3, root, 10)
    ).to.be.revertedWith("Epoch must be newer");
  });

  it("should authorize additional submitters", async function () {
    await anchor.setSubmitter(submitter.address, true);
    const root = ethers.keccak256(ethers.toUtf8Bytes("root"));
    await anchor.connect(submitter).submitSnapshot(1, root, 10);

    expect(await anchor.latestEpoch()).to.equal(1);
  });

  it("should reject unauthorized submitters", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("root"));
    await expect(
      anchor.connect(submitter).submitSnapshot(1, root, 10)
    ).to.be.revertedWith("Not authorized submitter");
  });
});

describe("Marketplace", function () {
  let verseToken, marketplace;
  let owner, alice, bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const VerseToken = await ethers.getContractFactory("VerseToken");
    verseToken = await VerseToken.deploy();

    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(await verseToken.getAddress());

    await verseToken.setMarketplace(await marketplace.getAddress());

    // Give alice some tokens
    await verseToken.connect(alice).buy({ value: ethers.parseEther("0.1") });
  });

  describe("Bounties", function () {
    it("should post and claim a bounty", async function () {
      const amount = ethers.parseEther("10");
      const tokenAddr = await verseToken.getAddress();
      const mktAddr = await marketplace.getAddress();

      // Approve marketplace
      await verseToken.connect(alice).approve(mktAddr, amount);

      // Post bounty
      await marketplace.connect(alice).postBounty(
        "v4", "Character", "A librarian's apprentice", amount, 30
      );

      // Check bounty
      const bounty = await marketplace.getBounty(0);
      expect(bounty.poster).to.equal(alice.address);
      expect(bounty.amount).to.equal(amount);

      // Bob claims
      await marketplace.connect(bob).claimBounty(0, "v20");
      const bobBalance = await verseToken.balanceOf(bob.address);
      expect(bobBalance).to.equal(amount);
    });
  });

  describe("IP Trading", function () {
    it("should register, list, and sell a node", async function () {
      // Alice registers ownership
      await marketplace.connect(alice).registerNode("v1");
      expect(await marketplace.nodeOwners("v1")).to.equal(alice.address);

      // List for sale
      await marketplace.connect(alice).listNode("v1", ethers.parseEther("50"), 500);

      // Bob buys enough tokens
      await verseToken.connect(bob).buy({ value: ethers.parseEther("1.0") });
      const mktAddr = await marketplace.getAddress();
      await verseToken.connect(bob).approve(mktAddr, ethers.parseEther("50"));
      await marketplace.connect(bob).buyNode("v1");

      expect(await marketplace.nodeOwners("v1")).to.equal(bob.address);
    });
  });

  describe("Governance", function () {
    it("should create and vote on proposals", async function () {
      // Alice needs 100 VERSE to propose
      const aliceBalance = await verseToken.balanceOf(alice.address);
      expect(aliceBalance).to.be.gte(ethers.parseEther("100"));

      await marketplace.connect(alice).propose("Increase merge centrality weight to 0.35");

      // Alice votes for
      await marketplace.connect(alice).vote(0, true);

      const proposal = await marketplace.proposals(0);
      expect(proposal.forVotes).to.be.gt(0);
    });
  });
});
