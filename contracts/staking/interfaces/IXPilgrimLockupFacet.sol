// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.9;

/// @title  XPILLockup
///
/// @author rn.ermaid
///
/// @notice A contract that queues lock-ups.
///
interface IXPilgrimLockupFacet {
    /// @notice Set minimum lockup period for xPIL token.
    ///
    /// @param  _lockupPeriod   Minimum lockup period of xPIL token in seconds
    ///
    function setLockupPeriod(uint32 _lockupPeriod) external;
    function enqueue(address _holder, uint256 _amount) external returns (uint128 _expiry);
    function dequeue(address _holder) external;
    function peek(address _holder) external view returns (uint256 _amount, uint128 _expiryDateTimestamp);
    function get(address _holder, uint128 _index) external view returns (uint256 _amount, uint128 _expiryDateTimestamp);
}
