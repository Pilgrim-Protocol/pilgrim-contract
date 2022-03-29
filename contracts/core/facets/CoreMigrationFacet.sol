// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/LibAppStorage.sol";
import "../libraries/LibDistribution.sol";
import "../libraries/LibGetters.sol";
import "../../shared/libraries/LibDiamond.sol";

contract CoreMigrationFacet {
    AppStorage internal s;

    function migratePilToken(
        address _newPil,
        address _newTreasury,
        uint128 _rewardParameter,
        uint128 _gasReward,
        uint256 _numPairs,
        address _xPil
    ) external {
        LibDiamond.enforceIsContractOwner();

        address oldPil = s.pil;

        /// 1. Update s.pil
        s.pil = _newPil;

        /// 2. Remove old PIL DistPool
        delete s.distPools[oldPil];

        /// 3. Update PairInfos
        for (uint256 i = 0; i < _numPairs; i++) {
            PairInfo storage pairInfo = s.pairs[i];
            if (pairInfo.baseToken == oldPil) {
                pairInfo.baseToken = _newPil;
            }
            if (pairInfo.extraRewardParameter > 1) {
                pairInfo.extraRewardParameter = 1;
            }
        }

        /// 4. Create new PIL DistPool
        /// Copy of ManagingFacet.createPool
        /// TODO: Revisit this part after new PIL reward distribution implementation
        require(_rewardParameter > 0, "Pilgrim: Invalid rewardParamter");
        DistPoolInfo storage distPoolInfo = s.distPools[_newPil];
        require(distPoolInfo.rewardParameter == 0, "Pilgrim: Duplicated baseToken");
        distPoolInfo.rewardParameter = _rewardParameter;
        distPoolInfo.gasReward = _gasReward;

        /// 5. Update s.treasury
        s.treasury = _newTreasury;

        /// 6. Update extraRewardParameter
        uint32 ethPoolParam = LibGetters._getUniV3ExtraRewardParam(oldPil, s.weth);
        LibDistribution._setUniExtraRewardParam(_newPil, s.weth, ethPoolParam);
        LibDistribution._setUniExtraRewardParam(oldPil, s.weth, 1);

        uint32 xPilPoolParam = LibGetters._getUniV3ExtraRewardParam(oldPil, _xPil);
        LibDistribution._setUniExtraRewardParam(_newPil, _xPil, xPilPoolParam);
        LibDistribution._setUniExtraRewardParam(oldPil, _xPil, 1);

        /// 7. Withdraw old PIL fee
        /// Copy of AMMFacet.withdrawFees
        uint256 feeAmount = s.cumulativeFees[oldPil];
        s.cumulativeFees[oldPil] = 0;
        require(IERC20(oldPil).transfer(s.stakingContract, feeAmount));

        /// 8. Transfer New PIL
        uint256 balance = IERC20(oldPil).balanceOf(address(this));
        require(IERC20(_newPil).transferFrom(msg.sender, address(this), balance));
    }
}
