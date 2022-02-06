pragma solidity ^0.8.11;
import "./Clones.sol";
import "./CampaignV0.sol";

contract CampaignV0Factory {
  address campaignV0Implementation;

  event campaignCreated(address campaign, address indexed creator);

  constructor(address _campaignV0Implementation) {
    campaignV0Implementation = _campaignV0Implementation;
  }

  function createCampaign(address _owner, uint64 _deadline, uint256 _fundingGoal, uint256 _fundingMax) public {
    address clone = Clones.clone(campaignV0Implementation);
    CampaignV0(clone).init(_owner, _deadline, _fundingGoal, _fundingMax);
    emit campaignCreated(clone, _owner);
  }
}