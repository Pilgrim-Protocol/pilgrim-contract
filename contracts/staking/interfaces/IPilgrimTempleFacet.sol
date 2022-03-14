// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.9;

/// @title  A temple for pilgrims, this contract handles swapping to and from xPIL, Pilgrim's staking token.
///
/// @author rn.ermaid
///
/// @notice You come in with some PIL, and leave with more! The longer you stay, the more PIL you get.
///
interface IPilgrimTempleFacet {

    /// @notice Set minimum lockup period for xPIL token.
    ///
    /// @dev    Calling setLockupPeriod doesn't change the lockup expiry times of existing lockup positions.
    ///
    /// @param  _lockupPeriod   Minimum lockup period of xPIL token in seconds
    ///
    function setLockupPeriod(uint256 _lockupPeriod) external;
    /// @notice Stake and lock PILs, earn some shares in xPIL.
    ///
    /// @dev    Lock PIL and mint xPIL
    ///
    /// @param  _amount  Amount of PIL token to be staked
    ///
    function enter(uint256 _amount) external;

    /// @notice Leave the temple. Claim back your PILs.
    ///
    /// @dev    Unlock the staked + gained PILs and burn xPILs
    ///
    /// @param  _share  Amount of xPILs to be burned
    ///
    function leave(uint256 _share) external;

    /// @notice This method can be used to get current claimable xPIL shares for each holder
    ///
    /// @return _unlockedAmount Unlocked & non-claimed xPIL shares
    ///
    function getUnlockedAmount(address _holder) external view returns (uint256 _unlockedAmount);

    /// @notice This method can be used to get extra claimable xPIL shares in the future
    ///
    /// @return _lockedAmount   Locked xPIL shares
    ///
    function getLockedAmount(address _holder) external view returns (uint256 _lockedAmount);
}
