const { expect } = require("chai");
const { ethers } = require("hardhat");

const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

describe("Periphery Contracts", () => {
  let owner;
  let Transferrer;
  let CampaignV0;
  let CampaignV0Factory;
  let transferrer;
  let campaignV0;
  let campaignV0Factory;

  before(async () => {
    [owner] = await ethers.getSigners();
    Transferrer = await ethers.getContractFactory("Transferrer");
    CampaignV0 = await ethers.getContractFactory("CampaignV0");
    CampaignV0Factory = await ethers.getContractFactory("CampaignV0Factory");
    transferrer = await Transferrer.deploy(daiAddress);
    campaignV0 = await CampaignV0.deploy();
    campaignV0Factory = await CampaignV0Factory.deploy(campaignV0.address);
  })


  it("deployment constructor sanity checks", async () => {
    expect(await transferrer.daiAddress()).to.equal(daiAddress);
    expect(await campaignV0.daiAddress()).to.equal(daiAddress);
    expect(await campaignV0.transferrer()).to.equal(transferrer.address);
    expect(await campaignV0Factory.campaignV0Implementation()).to.equal(campaignV0.address);
  })

  it("create via clonefactory should succeed", async () => {
    const weeks255InSeconds = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = Math.floor((new Date().getTime() / 1000) + weeks255InSeconds);
    const createCampaignTxRes = await campaignV0Factory.createCampaign(deadlineEpoch, "420", "690");
    const receipt = await createCampaignTxRes.wait();
    const cloneAddress = receipt.events[0].args.campaign;
    expect(receipt.events[0].args.creator).to.equal(owner.address);
    const clonedCampaignContract = campaignV0.attach(cloneAddress);
    expect(await clonedCampaignContract.daiAddress()).to.equal(daiAddress);
    expect(await clonedCampaignContract.transferrer()).to.equal(transferrer.address);
    expect(await clonedCampaignContract.admin()).to.equal(owner.address);
  })
})

describe("Campaign Contract", () => {
  let owner;
  let Transferrer;
  let CampaignV0;
  let CampaignV0Factory;
  let transferrer;
  let campaignV0;
  let campaignV0Factory;
  
  before(async () => {
    [owner] = await ethers.getSigners();
    Transferrer = await ethers.getContractFactory("Transferrer");
    CampaignV0 = await ethers.getContractFactory("CampaignV0");
    CampaignV0Factory = await ethers.getContractFactory("CampaignV0Factory");
    transferrer = await Transferrer.deploy(daiAddress);
    campaignV0 = await CampaignV0.deploy();
    campaignV0Factory = await CampaignV0Factory.deploy(campaignV0.address);
  })

  it("create should fail with a deadline over 3 years from now", async () => {
    const weeks257 = 257 * 7 * 24 * 60 * 60;
    const deadlineEpoch = Math.floor((new Date().getTime() / 1000) + weeks257);
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "420", "690")
    ).to.be.revertedWith("Deadline must be within 3 years of the current time");
  })

  it("create should fail with a deadline less than 1 week from now", async () => {
    const deadlineEpoch = Math.floor((new Date().getTime() / 1000));
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "420", "690")
    ).to.be.revertedWith("Deadline must be at least 1 week from current time");
  })

  it("create should fail with a funding max lower than funding goal", async () => {
    const weeks255 = 255 * 7 * 24 * 60 * 60;
    const deadlineEpoch = Math.floor((new Date().getTime() / 1000) + weeks255);
    await expect(
      campaignV0Factory.createCampaign(deadlineEpoch, "690", "420")
    ).to.be.revertedWith("fundingMax cannot exceed fundingGoal");
  })

  it("donate should fail if called directly", async () => {

  })

  it("donate should fail is deadline is passed", async () => {

  })

  it("donate should fail if funding max is reached", async () => {

  })

  it("donate should succeed if everything is koo", async () => {

  })

  it("transfer should fail if not called by owner", async () => {

  })

  it("transfer should succeed if called by owner", async () => {

  })

  it("withdrawOwner should fail if campaign is not finished", async () => {

  })

  it("withdrawOwner should fail if campaign didn't reach it's goal", async () => {

  })

  it("withdrawOwner should succeed with a full withdraw", async () => {

  })

  it("withdrawOwner should succeed with a partial withdraw (donors withdrew part 4 weeks after completion)", async () => {

  })

  it("withdrawDonor should fail if campaign isn't over", async () => {

  })

  it("withdrawDonor should fail if the campaign reached it's goal", async () => {

  })

  it("withdrawDonor should succeed with the correct amount if the campaign didn't reach it's goal", async () => {

  })

  it("withdrawDonor should succeed with the correct amount if the campaign reached it's goal, but the owner hasn't withdrawn for 4 weeks", async () => {
    
  })

  it("withdrawAdmin should fail if called by a non-admin", async () => {

  })

  it("withdrawAdmin should fail if the campaign isn't 24 weeks past deadline", async () => {

  })

  it("withdrawAdmin should succeed if the campaign is 24 weeks past deadline", async () => {

  })

  it("withdrawAdmin should succeed withdrawing random shitcoins that were accidentally deposited", async () => {
    
  })
})
