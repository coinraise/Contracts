const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

//const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";//actual
const daiAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";//mock

describe("Periphery Contracts", () => {
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

  before(async () => {
    [owner, acct2] = await ethers.getSigners();
    MockDai = await ethers.getContractFactory("ERC20");
    Transferrer = await ethers.getContractFactory("Transferrer");
    CampaignV0 = await ethers.getContractFactory("CampaignV0");
    CampaignV0Factory = await ethers.getContractFactory("CampaignV0Factory");
    transferrer = await Transferrer.deploy(daiAddress);
    campaignV0 = await CampaignV0.deploy();
    campaignV0Factory = await CampaignV0Factory.deploy(campaignV0.address);
    await (await campaignV0Factory.setFee("25")).wait();
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = Math.floor((new Date().getTime() / 1000)) + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    expect(receipt.events[0].args.creator).to.equal(owner.address);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    expect(await clonedCampaignContract.daiAddress()).to.equal(daiAddress);
    expect(await clonedCampaignContract.transferrer()).to.equal(transferrer.address);
    expect(await clonedCampaignContract.title()).to.equal("TEST_TITLE");
    expect(await clonedCampaignContract.description()).to.equal("TEST_DESCRIPTION");
    expect(parseInt((await campaignV0Factory.initializedCampaigns(cloneAddress)).toString())).to.approximately(Math.floor((new Date().getTime() / 1000)), 20);
    const allCampaigns = await campaignV0Factory.getAllCampaigns();
    expect(allCampaigns.length).to.equal(1);
    expect(allCampaigns[0]).to.equal(cloneAddress);
  })

  it("transfer benefactor should succeed", async () => {
    const benefactor1 = await campaignV0Factory.feeBenefactor();
    await (await campaignV0Factory.transferBenefactor(acct2.address)).wait();
    const benefactor2 = await campaignV0Factory.feeBenefactor();
    expect(benefactor1).not.to.equal(benefactor2);
    await (await campaignV0Factory.transferBenefactor(owner.address)).wait();
  })

  it("transfer benefactor should fail if not called by admin", async () => {
    await expect(
      campaignV0Factory.connect(acct2).transferBenefactor(owner.address)
    ).to.be.revertedWith("Only the admin can call this function");
  })

  it("transfer admin should succed", async () => {
    const admin1 = await campaignV0Factory.admin();
    await (await campaignV0Factory.transferAdmin(acct2.address));
    const admin2 = await campaignV0Factory.admin();
    expect(admin1).not.to.equal(admin2);
    await (await campaignV0Factory.connect(acct2).transferAdmin(owner.address)).wait();
  })
  
  it("transfer admin should fail if not called by admin", async () => {
    await expect(
      campaignV0Factory.connect(acct2).transferAdmin(owner.address)
    ).to.be.revertedWith("Only the admin can call this function");
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
    await (await campaignV0Factory.setFee("25")).wait();
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
    const weeks155 = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155;
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "690", "420", "TEST_TITLE", "TEST_DESCRIPTION")
    ).to.be.revertedWith("FundingMax cannot exceed fundingGoal");
  })

  it("create should adjust the true target/limit for fees", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "778", "1000", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const trueGoal = Math.floor((778 * 10000) / 9975);
    const trueMax = Math.floor((1000 * 10000) / 9975);
    expect(trueGoal).to.equal(779)//expect it to round down

    expect(await clonedCampaignContract.fundingGoal()).to.equal(trueGoal);
    expect(await clonedCampaignContract.fundingMax()).to.equal(trueMax)
  })

  it("create should not adjust the target/limit if there are no fees", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    await (await campaignV0Factory.setFee("0")).wait();
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "778", "1000", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const clonedCampaignContract = campaignV0.attach(cloneAddress);

    expect(await clonedCampaignContract.fundingGoal()).to.equal("778");
    expect(await clonedCampaignContract.fundingMax()).to.equal("1000");
    await (await campaignV0Factory.setFee("25")).wait();
  })

  it("fee should not change on an existing campaign if fee is updated in factory", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    await (await campaignV0Factory.setFee("0")).wait();
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "778", "1000", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await (await campaignV0Factory.setFee("25")).wait();
    expect(await clonedCampaignContract.fee()).to.equal("0");
  })

  it("init should fail if already initialized", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.init(owner.address, deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION", "25")
    ).to.be.revertedWith("Campaign has already been initialized");
  })

  it("donate should fail if called directly", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.donate(owner.address, 420)
    ).to.be.revertedWith("Only the transferrer can call this function");
  })

  it("donate should fail if deadline is passed", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const trueFundingLimit = Math.floor((690 * 10000) / 9975)
    await expect(
      transferrer.donate(cloneAddress, trueFundingLimit + 1)
    ).to.be.revertedWith("Donation would exceed the funding maximum");
  })

  it("donate should fail if funding max is reached via multiple donos", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const trueFundingLimit = Math.floor((690 * 10000) / 9975)
    await transferrer.donate(cloneAddress, trueFundingLimit);
    await expect(
      transferrer.donate(cloneAddress, "1")
    ).to.be.revertedWith("Donation would exceed the funding maximum");
  })

  it("donate should succeed if everything is koo", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const trueFundingLimit = Math.floor((690 * 10000) / 9975);
    await transferrer.donate(cloneAddress, trueFundingLimit);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    expect(await clonedCampaignContract.totalDonations()).to.equal("691");
    expect(await clonedCampaignContract.availableFunds()).to.equal("691");
  })

  it("transfer should fail if not called by owner", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "690")
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await clonedCampaignContract.transfer(acct2.address);
    expect(await clonedCampaignContract.owner()).to.equal(acct2.address);
  })

  it("withdrawOwner should fail if campaign is not finished", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const trueFundingLimit = Math.floor((420 * 10000) / 9975)
    await transferrer.donate(cloneAddress, trueFundingLimit)
    const preWithdrawBal = await mockDai.balanceOf(owner.address);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    evmTime = deadlineEpoch + 1;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    await clonedCampaignContract.withdrawOwner();
    const postWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(await clonedCampaignContract.availableFunds()).to.equal("0");
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal(trueFundingLimit);
  })

  it("withdrawOwner should succeed with the correct fee amount", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "799", "1000", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const trueFundingLimit = Math.floor((799 * 10000) / 9975)
    await transferrer.donate(cloneAddress, trueFundingLimit)
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
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal("799");
    expect(adminPostWithdrawBal.sub(adminPreWithdrawBal)).to.equal("2");
  })

  it("withdrawOwner should transfer fees to a new owner", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "799", "1000", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const trueFundingLimit = Math.floor((799 * 10000) / 9975)
    await transferrer.donate(cloneAddress, trueFundingLimit)
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
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal("799");
    expect(adminPostWithdrawBal.sub(adminPreWithdrawBal)).to.equal("2");
  })

  it("withdrawOwner should succeed with a partial withdraw (donors withdrew part 4 weeks after completion)", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "400", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await transferrer.donate(cloneAddress, "300")
    await transferrer.connect(acct2).donate(cloneAddress, "300");
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    evmTime = deadlineEpoch + weeks155InSeconds;
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    const donorPreWithdrawBal = await mockDai.balanceOf(acct2.address);
    await clonedCampaignContract.connect(acct2).withdrawDonor();
    const donorPostWithdrawBal = await mockDai.balanceOf(acct2.address);
    expect(donorPostWithdrawBal.sub(donorPreWithdrawBal)).to.equal("300");
    const ownerPreWithdrawBal = await mockDai.balanceOf(owner.address);
    await clonedCampaignContract.withdrawOwner();
    const ownerPostWithdrawBal = await mockDai.balanceOf(owner.address);
    expect(ownerPostWithdrawBal.sub(ownerPreWithdrawBal)).to.equal("300")
  })

  it("withdrawOwner should succeed with a partial withdraw with the correct fee amount", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "900", "1000", "TEST_TITLE", "TEST_DESCRIPTION");
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    const trueFundingLimit = Math.floor((420 * 10000) / 9975)
    await transferrer.donate(cloneAddress, trueFundingLimit)
    evmTime = deadlineEpoch + 4 * 7 * 24 * 60 * 60 - 1;//almost 4 weeks
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    await expect(
      clonedCampaignContract.withdrawDonor()
    ).to.be.revertedWith("Cannot withdraw, campaign reached it's goal and 4 week waiting period has not passed");
  })

  it("withdrawDonor should succeed with the correct amount if the campaign didn't reach it's goal", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
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

  it("withdrawAdmin should get the admin account from the factory", async () => {
    const weeks155InSeconds = 155 * 7 * 24 * 60 * 60;
    const deadlineEpoch = evmTime + weeks155InSeconds;
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690", "TEST_TITLE", "TEST_DESCRIPTION");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    await mockDai.transfer(cloneAddress, "420")
    evmTime = deadlineEpoch + 24 * 7 * 24 * 60 * 60 + 1;//just under 24 weeks
    await hre.network.provider.send("evm_setNextBlockTimestamp", [evmTime]);
    await (await campaignV0Factory.transferAdmin(acct2.address)).wait();
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    const contractDaiBalance = await mockDai.balanceOf(cloneAddress);
    const preWithdrawBal = await mockDai.balanceOf(acct2.address);
    await clonedCampaignContract.connect(acct2).withdrawAdmin(daiAddress, contractDaiBalance);
    const postWithdrawBal = await mockDai.balanceOf(acct2.address);
    expect(postWithdrawBal.sub(preWithdrawBal)).to.equal("420");
    await (await campaignV0Factory.connect(acct2).transferAdmin(acct2.address)).wait();
  })

})
