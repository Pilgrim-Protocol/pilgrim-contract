// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.9;

import "../libraries/LibAppStorage.sol";
import "../../shared/libraries/LibDiamond.sol";
import "../../token/PilgrimToken.sol";

contract StakingMigrationFacet {
    AppStorage internal s;

    function migratePilToken(
        address _newPil,
        address _newTreasury
    ) external {
        LibDiamond.enforceIsContractOwner();

        address oldPil = address(s.pilgrim);

        /// 1. Update s.pil
        s.pilgrim = PilgrimToken(_newPil);

        /// 2. Update s.treasury
        s.treasury = _newTreasury;

        /// 3. Transfer New PIL
        uint256 balance = IERC20(oldPil).balanceOf(address(this));
        require(IERC20(_newPil).transferFrom(msg.sender, address(this), balance));
    }
}
