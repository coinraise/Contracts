pragma solidity ^0.8.11;
import "./Clones.sol";
import "./CampaignV0.sol";
import "hardhat/console.sol";

contract CampaignV0Factory {
  address public campaignV0Implementation;

  event campaignCreated(address campaign, address indexed creator);

  constructor(address _campaignV0Implementation) {
    campaignV0Implementation = _campaignV0Implementation;
  }

  function createCampaign(uint64 _deadline, uint256 _fundingGoal, uint256 _fundingMax) public returns (address newCampaign) {
    address clone = Clones.clone(campaignV0Implementation);
    CampaignV0(clone).init(msg.sender, _deadline, _fundingGoal, _fundingMax);
    emit campaignCreated(clone, msg.sender);
    //console.log("clone address", clone);
    return clone;
  }
}