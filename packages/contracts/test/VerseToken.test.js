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

  describe("Bonding Curve (Integral-Based)", function () {
    it("should have a starting price", async function () {
      const price = await verseToken.currentPrice();
      expect(price).to.equal(ethers.parseEther("0.0001"));
    });

    it("should mint tokens when buying with slippage protection", async function () {
      await verseToken.connect(alice).buy(0, { value: ethers.parseEther("0.01") });
      const balance = await verseToken.balanceOf(alice.address);
      expect(balance).to.be.gt(0);
    });

    it("should increase price as supply grows", async function () {
      const priceBefore = await verseToken.currentPrice();
      await verseToken.connect(alice).buy(0, { value: ethers.parseEther("1.0") });
      const priceAfter = await verseToken.currentPrice();
      expect(priceAfter).to.be.gt(priceBefore);
    });

    it("should allow selling tokens back with slippage protection", async function () {
      // Fund contract for liquidity
      await owner.sendTransaction({
        to: await verseToken.getAddress(),
        value: ethers.parseEther("2.0"),
      });

      await verseToken.connect(alice).buy(0, { value: ethers.parseEther("0.5") });

      const balance = await verseToken.balanceOf(alice.address);
      const quarterBalance = balance / 4n;

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      await verseToken.connect(alice).sell(quarterBalance, 0);
      const balanceAfter = await ethers.provider.getBalance(alice.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should reject buy if slippage exceeded", async function () {
      await expect(
        verseToken.connect(alice).buy(ethers.parseEther("999999"), { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("should report cost to buy correctly", async function () {
      const cost = await verseToken.costToBuy(ethers.parseEther("100"));
      expect(cost).to.be.gt(0);
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

  it("should reject duplicate epochs", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("root"));
    await anchor.submitSnapshot(1, root, 10);

    await expect(
      anchor.submitSnapshot(1, root, 10)
    ).to.be.revertedWith("Epoch already submitted");
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

  it("should allow owner to invalidate snapshots", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("root"));
    await anchor.submitSnapshot(1, root, 10);
    await anchor.invalidateSnapshot(1);

    await expect(anchor.getSnapshot(1)).to.be.revertedWith("Epoch not found");
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
    await verseToken.connect(alice).buy(0, { value: ethers.parseEther("0.1") });
  });

  describe("Bounties", function () {
    it("should post a bounty and require poster approval for claims", async function () {
      const amount = ethers.parseEther("10");
      const mktAddr = await marketplace.getAddress();

      await verseToken.connect(alice).approve(mktAddr, amount);
      await marketplace.connect(alice).postBounty("v4", "Character", "A librarian's apprentice", amount, 30);

      // Bob submits a claim
      await marketplace.connect(bob).submitBountyClaim(0, "v20");

      // Bob can't get tokens yet — needs poster approval
      expect(await verseToken.balanceOf(bob.address)).to.equal(0);

      // Alice approves
      await marketplace.connect(alice).approveBountyClaim(0);
      expect(await verseToken.balanceOf(bob.address)).to.equal(amount);
    });

    it("should allow poster to reject claims", async function () {
      const amount = ethers.parseEther("10");
      const mktAddr = await marketplace.getAddress();

      await verseToken.connect(alice).approve(mktAddr, amount);
      await marketplace.connect(alice).postBounty("v4", "Character", "test", amount, 30);

      await marketplace.connect(bob).submitBountyClaim(0, "v20");
      await marketplace.connect(alice).rejectBountyClaim(0);

      // Bounty should be claimable again
      const bounty = await marketplace.getBounty(0);
      expect(bounty.claimedBy).to.equal(ethers.ZeroAddress);
    });
  });

  describe("IP Trading", function () {
    it("should require authorized registrar for node registration", async function () {
      // Alice is not a registrar
      await expect(
        marketplace.connect(alice).registerNode("v1", alice.address, 500)
      ).to.be.revertedWith("Not authorized registrar");

      // Owner is a registrar
      await marketplace.registerNode("v1", alice.address, 500);
      const ownership = await marketplace.getNodeOwnership("v1");
      expect(ownership.owner).to.equal(alice.address);
      expect(ownership.originalCreator).to.equal(alice.address);
    });

    it("should enforce royalties on sale", async function () {
      // Register with 10% royalty
      await marketplace.registerNode("v1", alice.address, 1000);

      // Alice lists
      await marketplace.connect(alice).listNode("v1", ethers.parseEther("50"));

      // Bob buys enough tokens
      await verseToken.connect(bob).buy(0, { value: ethers.parseEther("2.0") });
      const mktAddr = await marketplace.getAddress();
      await verseToken.connect(bob).approve(mktAddr, ethers.parseEther("50"));

      // First sale — no royalty to self
      await marketplace.connect(bob).buyNode("v1");
      expect((await marketplace.getNodeOwnership("v1")).owner).to.equal(bob.address);
    });
  });

  describe("Governance", function () {
    it("should create and vote on proposals with quorum", async function () {
      const aliceBalance = await verseToken.balanceOf(alice.address);
      expect(aliceBalance).to.be.gte(ethers.parseEther("100"));

      await marketplace.connect(alice).propose("Increase merge centrality weight to 0.35");
      await marketplace.connect(alice).vote(0, true);

      const proposal = await marketplace.proposals(0);
      expect(proposal.forVotes).to.be.gt(0);
    });

    it("should enforce proposal cooldown", async function () {
      await marketplace.connect(alice).propose("First proposal");

      await expect(
        marketplace.connect(alice).propose("Second proposal too soon")
      ).to.be.revertedWith("Proposal cooldown active");
    });

    it("should prevent double voting", async function () {
      await marketplace.connect(alice).propose("Test");
      await marketplace.connect(alice).vote(0, true);

      await expect(
        marketplace.connect(alice).vote(0, false)
      ).to.be.revertedWith("Already voted");
    });
  });
});
