// SPDX-License-Identifier: LGPL-3.0
pragma solidity ^0.8.9;

interface IPilgrimTreasury {
    function withdraw(address _to, uint256 _amount) external;
}
