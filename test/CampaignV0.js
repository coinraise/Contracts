const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

//const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";//actual
const daiAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";//mock

describe("Periphery Contracts", () => {
  let owner;
  let Transferrer;
  let CampaignV0;
  let CampaignV0Factory;
  let transferrer;
  let campaignV0;
  let campaignV0Factory;
  let MockDai;
  let mockDai;

  before(async () => {
    [owner] = await ethers.getSigners();
    MockDai = await ethers.getContractFactory("ERC20");
    Transferrer = await ethers.getContractFactory("Transferrer");
    CampaignV0 = await ethers.getContractFactory("CampaignV0");
    CampaignV0Factory = await ethers.getContractFactory("CampaignV0Factory");
    transferrer = await Transferrer.deploy(daiAddress);
    campaignV0 = await CampaignV0.deploy();
    campaignV0Factory = await CampaignV0Factory.deploy(campaignV0.address);
    mockDai = await MockDai.deploy("DAI", "DAI", owner.address);
    await mockDai.approve(transferrer.address, "10000000000000000000000000000000000000000000000000000");
  })

  it("mockDai should allocate all funds to the creator", async () => {
    expect(await mockDai.balanceOf(owner.address)).to.equal("10000000000000000000000000000000000000000");
  })

  it("owner should have approved transferrer to transfer mockDai", async () => {
    expect(await mockDai.allowance(owner.address, transferrer.address)).to.equal("10000000000000000000000000000000000000000000000000000");
  })

  it("deployment constructor sanity checks", async () => {
    expect(await transferrer.daiAddress()).to.equal(daiAddress);
    expect(await campaignV0.daiAddress()).to.equal(daiAddress);
    expect(await campaignV0.transferrer()).to.equal(transferrer.address);
    expect(await campaignV0Factory.campaignV0Implementation()).to.equal(campaignV0.address);
  })

  it("create via clonefactory should succeed", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = Math.floor((new Date().getTime() / 1000)) + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    expect(receipt.events[0].args.creator).to.equal(owner.address);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    expect(await clonedCampaignContract.daiAddress()).to.equal(daiAddress);
    expect(await clonedCampaignContract.transferrer()).to.equal(transferrer.address);
    expect(await clonedCampaignContract.admin()).to.equal(owner.address);
    expect(await clonedCampaignContract.title()).to.equal("TEST_TITLE");
    expect(await clonedCampaignContract.description()).to.equal("TEST_DESCRIPTION");
    expect(await campaignV0Factory.initializedCampaigns(cloneAddress)).to.equal(true);
    const allCampaigns = await campaignV0Factory.getAllCampaigns();
    expect(allCampaigns.length).to.equal(1);
    expect(allCampaigns[0]).to.equal(cloneAddress);
  })
})

describe("Campaign Contract", () => {
  let owner;
  let acct2;
  let Transferrer;
  let CampaignV0;
  let CampaignV0Factory;
  let transferrer;
  let campaignV0;
  let campaignV0Factory;
  let MockDai;
  let mockDai;
  let evmTime = Math.floor((new Date().getTime() / 1000));
  
  before(async () => {
    await hre.network.provider.send("hardhat_reset");
    [owner, acct2] = await ethers.getSigners();
    Transferrer = await ethers.getContractFactory("Transferrer");
    CampaignV0 = await ethers.getContractFactory("CampaignV0");
    CampaignV0Factory = await ethers.getContractFactory("CampaignV0Factory");
    MockDai = await ethers.getContractFactory("ERC20");
    transferrer = await Transferrer.deploy(daiAddress);
    campaignV0 = await CampaignV0.deploy();
    campaignV0Factory = await CampaignV0Factory.deploy(campaignV0.address);
    mockDai = await MockDai.deploy("DAI", "DAI", owner.address);//0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
    await mockDai.approve(transferrer.address, "10000000000000000000000000000000000000000000000000000");
    await mockDai.connect(acct2).approve(transferrer.address, "10000000000000000000000000000000000000000000000000000");
    await mockDai.transfer(acct2.address, "1000000000000000000000000000000000000000");
  })

  it("create should fail with no title", async () => {
    const weeks4 = 4 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks4;
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "", "TEST_DESCRIPTION")
    ).to.be.revertedWith("Cannot have empty string for title");
  })

  it("create should fail with no description", async () => {
    const weeks4 = 4 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks4;
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "")
    ).to.be.revertedWith("Cannot have empty string for description");
  })

  it("create should fail with a deadline over 3 years from now", async () => {
    const weeks257 = 257 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks257;
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION")
    ).to.be.revertedWith("Deadline must be within 3 years of the current time");
  })

  it("create should fail with a deadline less than 1 week from now", async () => {
    const deadlineEpoch = evmTime;
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION")
    ).to.be.revertedWith("Deadline must be at least 1 week from current time");
  })

  it("create should fail with a funding max lower than funding goal", async () => {
    const weeks255 = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255;
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "690", "420", "TEST_TITLE", "TEST_DESCRIPTION")
    ).to.be.revertedWith("FundingMax cannot exceed fundingGoal");
  })

  it("init should fail if already initialized", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.init(owner.address, deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION")
    ).to.be.revertedWith("Campaign has already been initialized");
  })

  it("donate should fail if called directly", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.donate(owner.address, 420)
    ).to.be.revertedWith("Only the transferrer can call this function");
  })

  it("donate should fail if deadline is passed", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    evmTime = deadlineEpoch + 1;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    await expect(
      transferrer.donate(cloneAddress, "420")
    ).to.be.revertedWith("Cannot donate, campaign is already finished");
    
  })

  it("donate should fail if funding max is reached", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await expect(
      transferrer.donate(cloneAddress, "691")
    ).to.be.revertedWith("Donation would exceed the funding maximum");
  })

  it("donate should fail if funding max is reached via multiple donos", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "690");
    await expect(
      transferrer.donate(cloneAddress, "1")
    ).to.be.revertedWith("Donation would exceed the funding maximum");
  })

  it("donate should succeed if everything is koo", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "690")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    expect(await clonedCampaignContract.totalDonations()).to.equal("690");
    expect(await clonedCampaignContract.availableFunds()).to.equal("690");
  })

  it("transfer should fail if not called by owner", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "690")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect (
      clonedCampaignContract.connect(acct2).transfer(acct2.address)
    ).to.be.revertedWith("Only the owner can call this function");
  })

  it("transfer should succeed if called by owner", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "690")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await clonedCampaignContract.transfer(acct2.address);
    expect(await clonedCampaignContract.owner()).to.equal(acct2.address);
  })

  it("withdrawOwner should fail if campaign is not finished", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "690")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.withdrawOwner()
    ).to.be.revertedWith("Cannot withdraw, this campaign is not finished yet");
  })

  it("withdrawOwner should fail if campaign didn't reach it's goal", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "419")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    evmTime = deadlineEpoch + 1;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    await expect(
      clonedCampaignContract.withdrawOwner()
    ).to.be.revertedWith("Cannot withdraw, this campaign did not reach it's goal");
  })

  it("withdrawOwner should succeed with a full withdraw", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "420")
    const preWithdrawBal = await mockDai.balanceOf(owner.address);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    evmTime = deadlineEpoch + 1;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    await clonedCampaignContract.withdrawOwner();
    const postWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(await clonedCampaignContract.availableFunds()).to.equal("0");
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal("420");
  })

  it("withdrawOwner should succeed with the correct fee amount", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "400", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "400")
    const preWithdrawBal = await mockDai.balanceOf(acct2.address);
    const adminPreWithdrawBal = await mockDai.balanceOf(owner.address);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    evmTime = deadlineEpoch + 1;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    await clonedCampaignContract.transfer(acct2.address);
    await clonedCampaignContract.connect(acct2).withdrawOwner();
    const postWithdrawBal = await mockDai.balanceOf(acct2.address);
    const adminPostWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(await clonedCampaignContract.availableFunds()).to.equal("0");
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal("399");
    expect(adminPostWithdrawBal.sub(adminPreWithdrawBal)).to.equal("1");
  })

  it("withdrawOwner should succeed with a partial withdraw (donors withdrew part 4 weeks after completion)", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "400", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "200")
    await transferrer.connect(acct2).donate(cloneAddress, "200");
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    evmTime = deadlineEpoch + weeks255InSeconds;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    const donorPreWithdrawBal = await mockDai.balanceOf(acct2.address);
    await clonedCampaignContract.connect(acct2).withdrawDonor();
    const donorPostWithdrawBal = await mockDai.balanceOf(acct2.address);
    expect(donorPostWithdrawBal.sub(donorPreWithdrawBal)).to.equal("200");
    const ownerPreWithdrawBal = await mockDai.balanceOf(owner.address);
    await clonedCampaignContract.withdrawOwner();
    const ownerPostWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(ownerPostWithdrawBal.sub(ownerPreWithdrawBal)).to.equal("200")
  })

  it("withdrawOwner should succeed with a partial withdraw with the correct fee amount", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "1000", "1000", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "600")
    await transferrer.connect(acct2).donate(cloneAddress, "400");
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    evmTime = deadlineEpoch + 4 * 7 * 24 * 60 * 60;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    await clonedCampaignContract.transfer(acct2.address);
    const donorPreWithdrawBal = await mockDai.balanceOf(owner.address);
    await clonedCampaignContract.withdrawDonor();
    const donorPostWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(donorPostWithdrawBal.sub(donorPreWithdrawBal)).to.equal("600");
    expect(await clonedCampaignContract.availableFunds()).to.equal("400");
    const ownerPreWithdrawBal = await mockDai.balanceOf(acct2.address);
    const adminPreWithdrawBal = await mockDai.balanceOf(owner.address);
    await clonedCampaignContract.connect(acct2).withdrawOwner();
    const adminPostWithdrawBal = await mockDai.balanceOf(owner.address);
    const ownerPostWithdrawBal = await mockDai.balanceOf(acct2.address);
    expect(adminPostWithdrawBal.sub(adminPreWithdrawBal)).to.equal("1");
    expect(ownerPostWithdrawBal.sub(ownerPreWithdrawBal)).to.equal("399");
    expect(await clonedCampaignContract.availableFunds()).to.equal("0");
  })

  it("withdrawDonor should fail if campaign is not finished", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "420")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.withdrawDonor()
    ).to.be.revertedWith("Cannot withdraw, this campaign isn't over yet");
  })

  it("withdrawDonor should fail if the campaign reached it's goal", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "420")
    evmTime = deadlineEpoch + 4 * 7 * 24 * 60 * 60 - 1;//almost 4 weeks
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.withdrawDonor()
    ).to.be.revertedWith("Cannot withdraw, campaign reached it's goal and 4 week waiting period has not passed");
  })

  it("withdrawDonor should succeed with the correct amount if the campaign didn't reach it's goal", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "419")
    evmTime = deadlineEpoch + 1;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const balanceBeforeWithdraw = await mockDai.balanceOf(owner.address);
    clonedCampaignContract.withdrawDonor()
    const balanceAfterWithdraw = await mockDai.balanceOf(owner.address);
    expect(balanceAfterWithdraw.sub(balanceBeforeWithdraw)).to.equal("419");
  })

  it("withdrawDonor should succeed with the correct amount if the campaign reached it's goal, but the owner hasn't withdrawn for 4 weeks", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "420")
    evmTime = deadlineEpoch + 4 * 7 * 24 * 60 * 60 + 1;//just over 4 weeks
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const balanceBeforeWithdraw = await mockDai.balanceOf(owner.address);
    clonedCampaignContract.withdrawDonor()
    const balanceAfterWithdraw = await mockDai.balanceOf(owner.address);
    expect(balanceAfterWithdraw.sub(balanceBeforeWithdraw)).to.equal("420");
  })

  it("withdrawAdmin should fail if called by a non-admin", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "420")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const contractDaiBalance = await mockDai.balanceOf(cloneAddress);
    await expect(
      clonedCampaignContract.connect(acct2).withdrawAdmin(daiAddress, contractDaiBalance)
    ).to.be.revertedWith("Only CoinRaise admin can call this function");
  })

  it("withdrawAdmin should fail if the campaign isn't 24 weeks past deadline", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "420")
    evmTime = deadlineEpoch + 24 * 7 * 24 * 60 * 60 - 1;//just under 24 weeks
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);

    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const contractDaiBalance = await mockDai.balanceOf(cloneAddress);
    await expect(
      clonedCampaignContract.withdrawAdmin(daiAddress, contractDaiBalance)
    ).to.be.revertedWith("Admin cannot claim forgotten funds before 6 months past the deadline");
  })

  it("withdrawAdmin should succeed if the campaign is 24 weeks past deadline", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "420")
    evmTime = deadlineEpoch + 24 * 7 * 24 * 60 * 60 + 1;//just under 24 weeks
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);

    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const contractDaiBalance = await mockDai.balanceOf(cloneAddress);
    const preWithdrawBal = await mockDai.balanceOf(owner.address);
    await clonedCampaignContract.withdrawAdmin(daiAddress, contractDaiBalance);
    const postWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal("420");
  })

  it("withdrawAdmin should succeed withdrawing random shitcoins that were accidentally deposited", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks255InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await mockDai.transfer(cloneAddress, "420")
    evmTime = deadlineEpoch + 24 * 7 * 24 * 60 * 60 + 1;//just under 24 weeks
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);

    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const contractDaiBalance = await mockDai.balanceOf(cloneAddress);
    const preWithdrawBal = await mockDai.balanceOf(owner.address);
    await clonedCampaignContract.withdrawAdmin(daiAddress, contractDaiBalance);
    const postWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal("420");
  })
})
